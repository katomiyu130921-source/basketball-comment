import json
import os
import uuid
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import StreamingResponse, FileResponse

from auth import get_current_user
from db import get_conn

router = APIRouter(prefix="/api/videos", tags=["videos"])

_default_uploads = Path(__file__).parent.parent / "uploads"
UPLOAD_DIR = Path(os.environ.get("UPLOAD_DIR", str(_default_uploads)))
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_VIDEO_TYPES = {"video/mp4", "video/quicktime", "video/x-msvideo", "video/webm"}
MAX_VIDEO_MB = 2048


def video_dir(video_id: str) -> Path:
    d = UPLOAD_DIR / video_id
    d.mkdir(exist_ok=True)
    return d


# ── Upload ────────────────────────────────────────────────────────────────────

@router.post("", status_code=201)
async def upload_video(
    title: str = Form(...),
    video: UploadFile = File(...),
    tracking: Optional[UploadFile] = File(None),
    user=Depends(get_current_user),
):
    if video.content_type not in ALLOWED_VIDEO_TYPES:
        raise HTTPException(400, f"Unsupported video type: {video.content_type}")

    video_id = str(uuid.uuid4())
    vdir = video_dir(video_id)

    suffix = Path(video.filename).suffix or ".mp4"
    video_path = vdir / f"video{suffix}"

    # Stream video to disk
    size = 0
    with video_path.open("wb") as f:
        while chunk := await video.read(1024 * 1024):
            size += len(chunk)
            if size > MAX_VIDEO_MB * 1024 * 1024:
                video_path.unlink(missing_ok=True)
                raise HTTPException(413, f"Video exceeds {MAX_VIDEO_MB} MB limit")
            f.write(chunk)

    # Parse tracking.json metadata
    fps = total_frames = width = height = None
    has_tracking = False

    if tracking:
        tracking_bytes = await tracking.read()
        try:
            meta = json.loads(tracking_bytes)
            fps = meta.get("fps")
            total_frames = meta.get("total_frames")
            width = meta.get("width")
            height = meta.get("height")
        except json.JSONDecodeError:
            raise HTTPException(400, "Invalid tracking.json")
        (vdir / "tracking.json").write_bytes(tracking_bytes)
        has_tracking = True

    conn = get_conn()
    conn.execute(
        """INSERT INTO videos (id, title, filename, fps, width, height, total_frames, has_tracking, uploaded_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (video_id, title, video.filename, fps, width, height, total_frames, int(has_tracking), user["id"]),
    )
    conn.commit()
    conn.close()

    return {"id": video_id, "title": title}


# ── List ──────────────────────────────────────────────────────────────────────

@router.get("")
def list_videos(user=Depends(get_current_user)):
    conn = get_conn()
    rows = conn.execute(
        """SELECT v.id, v.title, v.fps, v.width, v.height, v.total_frames,
                  v.has_tracking, v.created_at, u.username AS uploader
           FROM videos v JOIN users u ON v.uploaded_by = u.id
           ORDER BY v.created_at DESC"""
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


# ── Detail (with players from tracking.json) ──────────────────────────────────

@router.get("/{video_id}")
def get_video(video_id: str, user=Depends(get_current_user)):
    conn = get_conn()
    row = conn.execute("SELECT * FROM videos WHERE id = ?", (video_id,)).fetchone()
    conn.close()
    if row is None:
        raise HTTPException(404, "Video not found")

    data = dict(row)
    tracking_path = video_dir(video_id) / "tracking.json"
    if tracking_path.exists():
        meta = json.loads(tracking_path.read_text())
        data["players"] = meta.get("players", [])
        data["homography"] = meta.get("homography")
    else:
        data["players"] = []
        data["homography"] = None

    return data


# ── Tracking JSON (full, for playback) ───────────────────────────────────────

@router.get("/{video_id}/tracking")
def get_tracking(video_id: str, user=Depends(get_current_user)):
    path = video_dir(video_id) / "tracking.json"
    if not path.exists():
        raise HTTPException(404, "Tracking data not found")
    return FileResponse(path, media_type="application/json")


# ── Video stream (Range-aware for mobile seek support) ────────────────────────

@router.get("/{video_id}/stream")
async def stream_video(video_id: str, request: Request):
    vdir = video_dir(video_id)
    video_files = list(vdir.glob("video.*"))
    if not video_files:
        raise HTTPException(404, "Video file not found")

    video_path = video_files[0]
    file_size = video_path.stat().st_size

    range_header = request.headers.get("range")
    if range_header:
        start, end = _parse_range(range_header, file_size)
        chunk_size = end - start + 1
        headers = {
            "Content-Range":  f"bytes {start}-{end}/{file_size}",
            "Content-Length": str(chunk_size),
            "Accept-Ranges":  "bytes",
        }
        return StreamingResponse(
            _iter_file(video_path, start, end),
            status_code=206,
            headers=headers,
            media_type=_guess_mime(video_path),
        )

    return FileResponse(video_path, media_type=_guess_mime(video_path))


def _parse_range(header: str, file_size: int) -> tuple[int, int]:
    unit, _, rng = header.partition("=")
    start_str, _, end_str = rng.partition("-")
    start = int(start_str) if start_str else 0
    end = int(end_str) if end_str else file_size - 1
    end = min(end, file_size - 1)
    return start, end


async def _iter_file(path: Path, start: int, end: int, chunk: int = 1024 * 64):
    with path.open("rb") as f:
        f.seek(start)
        remaining = end - start + 1
        while remaining > 0:
            data = f.read(min(chunk, remaining))
            if not data:
                break
            remaining -= len(data)
            yield data


def _guess_mime(path: Path) -> str:
    return {
        ".mp4": "video/mp4",
        ".mov": "video/quicktime",
        ".avi": "video/x-msvideo",
        ".webm": "video/webm",
    }.get(path.suffix.lower(), "video/mp4")
