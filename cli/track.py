#!/usr/bin/env python3
"""
SAM 2 basketball player tracking CLI.
Usage: python track.py --video game.mp4 [--output tracking.json] [--checkpoint path]
"""

import argparse
import json
import sys
from pathlib import Path
from typing import Optional
import cv2
import numpy as np

# BGR color palette for up to 10 players
PLAYER_COLORS = [
    (246, 130, 59),   # blue
    (129, 185, 16),   # green
    (11, 158, 245),   # orange
    (246, 92, 139),   # pink
    (252, 211, 77),   # yellow
    (20, 184, 166),   # teal
    (168, 85, 247),   # purple
    (249, 115, 22),   # orange-red
    (239, 68, 68),    # red
    (34, 197, 94),    # light green
]

# 4 court corners for homography: (name, normalized_court_coord)
# (0,0) = bottom-left, (1,1) = top-right of the full court
COURT_CORNERS = [
    ("Bottom-left corner",  (0.0, 0.0)),
    ("Bottom-right corner", (1.0, 0.0)),
    ("Top-right corner",    (1.0, 1.0)),
    ("Top-left corner",     (0.0, 1.0)),
]
COURT_W, COURT_H = 940, 500  # court template pixel size


# ── Interactive player selection ─────────────────────────────────────────────

class PlayerSelector:
    def __init__(self, frame: np.ndarray):
        self.frame = frame.copy()
        self.display = frame.copy()
        self.players: list[dict] = []
        self.pending_points: list[tuple[int, int]] = []

    def _redraw(self):
        self.display = self.frame.copy()
        for i, p in enumerate(self.players):
            color = PLAYER_COLORS[i % len(PLAYER_COLORS)]
            for pt in p["points"]:
                cv2.circle(self.display, tuple(pt), 8, color, -1)
                cv2.circle(self.display, tuple(pt), 10, (255, 255, 255), 2)
            cx = int(np.mean([pt[0] for pt in p["points"]]))
            cy = int(np.mean([pt[1] for pt in p["points"]]))
            label = f"#{p['number']} {p['name']}"
            cv2.putText(self.display, label, (cx - 40, cy - 15),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 0), 3)
            cv2.putText(self.display, label, (cx - 40, cy - 15),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 1)
        for pt in self.pending_points:
            cv2.circle(self.display, pt, 6, (200, 200, 200), -1)

    def _on_mouse(self, event, x, y, flags, param):
        if event == cv2.EVENT_LBUTTONDOWN:
            self.pending_points.append((x, y))

    def run(self) -> list[dict]:
        cv2.namedWindow("Player Selection", cv2.WINDOW_NORMAL)
        cv2.setMouseCallback("Player Selection", self._on_mouse)

        print("\n=== Step 1: Player Selection ===")
        print("  Click on a player → ENTER to register → input name/number in terminal")
        print("  R: remove last point   D: done\n")

        while True:
            self._redraw()
            lines = [
                "Click player → ENTER to add info",
                f"Players: {len(self.players)}  |  Pending pts: {len(self.pending_points)}",
                "R=remove last pt  D=done",
            ]
            for i, line in enumerate(lines):
                cv2.putText(self.display, line, (10, 28 + i * 24),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.65, (0, 0, 0), 3)
                cv2.putText(self.display, line, (10, 28 + i * 24),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.65, (255, 255, 255), 1)
            cv2.imshow("Player Selection", self.display)
            key = cv2.waitKey(1) & 0xFF

            if key in (ord('d'), ord('D')):
                break
            elif key in (ord('r'), ord('R')) and self.pending_points:
                self.pending_points.pop()
            elif key in (13, 10) and self.pending_points:  # Enter
                cv2.destroyWindow("Player Selection")
                idx = len(self.players)
                color = PLAYER_COLORS[idx % len(PLAYER_COLORS)]
                print(f"  Player {idx + 1}  (color index {idx})")
                name   = input("    Name   (e.g. Brown): ").strip()
                number = input("    Number (e.g. 7):     ").strip()
                team   = input("    Team   [home/away]:  ").strip().lower()
                if team not in ("home", "away"):
                    team = "home"
                self.players.append({
                    "id":     idx + 1,
                    "name":   name,
                    "number": number,
                    "team":   team,
                    "color":  list(color),
                    "points": [list(pt) for pt in self.pending_points],
                    "labels": [1] * len(self.pending_points),
                })
                self.pending_points = []
                cv2.namedWindow("Player Selection", cv2.WINDOW_NORMAL)
                cv2.setMouseCallback("Player Selection", self._on_mouse)

        cv2.destroyAllWindows()
        return self.players


# ── Court homography calibration ─────────────────────────────────────────────

class CourtCalibrator:
    def __init__(self, frame: np.ndarray):
        self.frame = frame.copy()
        self.display = frame.copy()
        self.clicks: list[tuple[int, int]] = []

    def _on_mouse(self, event, x, y, flags, param):
        idx = len(self.clicks)
        if event == cv2.EVENT_LBUTTONDOWN and idx < len(COURT_CORNERS):
            self.clicks.append((x, y))
            label = COURT_CORNERS[idx][0]
            cv2.circle(self.display, (x, y), 8, (0, 255, 0), -1)
            cv2.putText(self.display, label, (x + 10, y),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0, 255, 0), 2)

    def run(self) -> Optional[np.ndarray]:
        print("\n=== Step 2: Court Calibration (optional) ===")
        print("  Click the 4 court corners in order:")
        for i, (name, _) in enumerate(COURT_CORNERS):
            print(f"    {i+1}. {name}")
        print("  ENTER after 4 clicks to confirm   S to skip\n")

        cv2.namedWindow("Court Calibration", cv2.WINDOW_NORMAL)
        cv2.setMouseCallback("Court Calibration", self._on_mouse)

        while True:
            overlay = self.display.copy()
            idx = len(self.clicks)
            if idx < len(COURT_CORNERS):
                msg = f"Click: {COURT_CORNERS[idx][0]}  ({idx}/4)"
            else:
                msg = "4 points set — ENTER to confirm"
            cv2.putText(overlay, msg, (10, 32),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 0), 3)
            cv2.putText(overlay, msg, (10, 32),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 0), 2)
            cv2.imshow("Court Calibration", overlay)
            key = cv2.waitKey(1) & 0xFF

            if key in (ord('s'), ord('S')):
                cv2.destroyAllWindows()
                print("  Skipped.")
                return None
            if key in (13, 10) and len(self.clicks) == 4:
                break

        cv2.destroyAllWindows()

        src = np.float32([[x, y] for x, y in self.clicks])
        dst = np.float32([
            [coord[0] * COURT_W, (1.0 - coord[1]) * COURT_H]
            for _, coord in COURT_CORNERS
        ])
        H, _ = cv2.findHomography(src, dst)
        print("  Calibration complete.")
        return H


# ── Tracking helpers ──────────────────────────────────────────────────────────

def mask_to_bbox_center(mask: np.ndarray) -> Optional[tuple[list, list]]:
    ys, xs = np.where(mask)
    if len(xs) == 0:
        return None
    x1, x2 = int(xs.min()), int(xs.max())
    y1, y2 = int(ys.min()), int(ys.max())
    cx = (x1 + x2) / 2.0
    cy = (y1 + y2) / 2.0
    return [float(x1), float(y1), float(x2 - x1), float(y2 - y1)], [cx, cy]


def to_court_coords(H: np.ndarray, center: list[float]) -> list[float]:
    pt = np.array([[[center[0], center[1]]]], dtype=np.float32)
    out = cv2.perspectiveTransform(pt, H)
    rx, ry = float(out[0][0][0]), float(out[0][0][1])
    # Normalize back to [0, 1]
    return [round(rx / COURT_W, 4), round(1.0 - ry / COURT_H, 4)]


# ── SAM 2 tracking ────────────────────────────────────────────────────────────

def run_tracking(video_path: str, fps: float, players: list[dict],
                 H: Optional[np.ndarray], checkpoint: str, model_cfg: str) -> list[dict]:
    try:
        from sam2.build_sam import build_sam2_video_predictor
        import torch
    except ImportError:
        print("ERROR: sam2 not installed.\n  pip install git+https://github.com/facebookresearch/sam2.git")
        sys.exit(1)

    device = "cuda" if torch.cuda.is_available() else "cpu"
    if device == "cpu":
        print("WARNING: No GPU detected — tracking will be very slow.")

    print(f"\n=== Step 3: SAM 2 Tracking (device={device}) ===")
    predictor = build_sam2_video_predictor(model_cfg, checkpoint, device=device)

    frames_data: list[dict] = []

    with torch.inference_mode(), torch.autocast(device, dtype=torch.bfloat16):
        state = predictor.init_state(video_path=video_path)
        total = int(state["num_frames"])
        print(f"  Total frames: {total}")

        for player in players:
            points = np.array(player["points"], dtype=np.float32)
            labels = np.array(player["labels"], dtype=np.int32)
            predictor.add_new_points_or_box(
                state, frame_idx=0, obj_id=player["id"],
                points=points, labels=labels,
            )

        print("  Propagating...")
        for frame_idx, obj_ids, mask_logits in predictor.propagate_in_video(state):
            if frame_idx % 60 == 0:
                print(f"  {frame_idx}/{total}", end="\r", flush=True)

            masks = (mask_logits > 0).cpu().numpy()  # [N, 1, H, W]
            player_entries = []

            for i, obj_id in enumerate(obj_ids):
                result = mask_to_bbox_center(masks[i, 0])
                if result is None:
                    continue
                bbox, center = result
                player_entries.append({
                    "player_id": int(obj_id),
                    "bbox":      bbox,
                    "center":    center,
                    "court_pos": to_court_coords(H, center) if H is not None else None,
                })

            frames_data.append({
                "frame_idx": frame_idx,
                "timestamp": round(frame_idx / fps, 3),
                "players":   player_entries,
            })

    print(f"\n  Done. {len(frames_data)} frames tracked.")
    return frames_data


# ── Entry point ───────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Track basketball players with SAM 2 and export tracking.json"
    )
    parser.add_argument("--video",      required=True,
                        help="Input video file")
    parser.add_argument("--output",     default="tracking.json",
                        help="Output JSON path (default: tracking.json)")
    parser.add_argument("--checkpoint", default="checkpoints/sam2.1_hiera_large.pt",
                        help="SAM 2 model checkpoint")
    parser.add_argument("--model-cfg",  default="configs/sam2.1/sam2.1_hiera_l.yaml",
                        help="SAM 2 model config YAML")
    parser.add_argument("--skip-calibration", action="store_true",
                        help="Skip court homography calibration")
    args = parser.parse_args()

    video_path = args.video
    if not Path(video_path).exists():
        print(f"ERROR: Video not found: {video_path}")
        sys.exit(1)

    cap = cv2.VideoCapture(video_path)
    ret, first_frame = cap.read()
    fps          = cap.get(cv2.CAP_PROP_FPS)
    width        = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height       = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    cap.release()

    if not ret:
        print("ERROR: Cannot read video.")
        sys.exit(1)

    print(f"Video: {video_path}  ({width}x{height} @ {fps:.1f}fps, {total_frames} frames)")

    # Step 1: Select players
    players = PlayerSelector(first_frame).run()
    if not players:
        print("No players selected. Exiting.")
        sys.exit(0)
    print(f"\n{len(players)} player(s) selected:")
    for p in players:
        print(f"  #{p['number']} {p['name']}  [{p['team']}]")

    # Step 2: Court calibration
    H_matrix = None
    if not args.skip_calibration:
        H_matrix = CourtCalibrator(first_frame).run()

    # Step 3: SAM 2 tracking
    frames_data = run_tracking(
        video_path, fps, players, H_matrix,
        args.checkpoint, args.model_cfg,
    )

    # Step 4: Save JSON
    output = {
        "video":        Path(video_path).name,
        "fps":          fps,
        "width":        width,
        "height":       height,
        "total_frames": total_frames,
        "players": [
            {k: v for k, v in p.items() if k not in ("points", "labels")}
            for p in players
        ],
        "homography": H_matrix.tolist() if H_matrix is not None else None,
        "frames":     frames_data,
    }

    out_path = Path(args.output)
    out_path.write_text(json.dumps(output, indent=2, ensure_ascii=False))
    size_mb = out_path.stat().st_size / 1024 / 1024
    print(f"\nSaved → {out_path}  ({size_mb:.1f} MB)")


if __name__ == "__main__":
    main()
