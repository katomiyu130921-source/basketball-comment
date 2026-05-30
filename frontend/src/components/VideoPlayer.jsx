import React, { useRef, useEffect, useCallback } from "react";
import { streamUrl } from "../api";

function toRgb([r, g, b]) {
  return `rgb(${r},${g},${b})`;
}

function drawOverlay(canvas, video, frame, players) {
  if (!canvas || !video || !frame) return;
  const dw = video.clientWidth;
  const dh = video.clientHeight;
  if (!dw || !dh || !video.videoWidth) return;

  canvas.width = dw;
  canvas.height = dh;

  const sx = dw / video.videoWidth;
  const sy = dh / video.videoHeight;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, dw, dh);

  for (const fp of frame.players) {
    const player = players.find((p) => p.id === fp.player_id);
    if (!player) continue;

    const color = toRgb(player.color);
    const [bx, by, bw, bh] = fp.bbox;
    const [cx] = fp.center;

    // Bounding box
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.strokeRect(bx * sx, by * sy, bw * sx, bh * sy);

    // Transparent fill
    ctx.fillStyle = `rgba(${player.color[0]},${player.color[1]},${player.color[2]},0.15)`;
    ctx.fillRect(bx * sx, by * sy, bw * sx, bh * sy);

    // Label badge
    const label = `#${player.number} ${player.name}`;
    ctx.font = "bold 13px sans-serif";
    const tw = ctx.measureText(label).width;
    const lx = bx * sx;
    const ly = by * sy - 22;

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(lx, Math.max(0, ly), tw + 10, 20, 4);
    ctx.fill();

    ctx.fillStyle = "#000";
    ctx.fillText(label, lx + 5, Math.max(15, ly + 14));
  }
}

export default function VideoPlayer({ videoId, tracking, currentFrame, onTimeUpdate }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const players = tracking?.players ?? [];

  const redraw = useCallback(() => {
    drawOverlay(canvasRef.current, videoRef.current, currentFrame, players);
  }, [currentFrame, players]);

  useEffect(() => { redraw(); }, [redraw]);

  // Redraw on resize
  useEffect(() => {
    const obs = new ResizeObserver(redraw);
    if (videoRef.current) obs.observe(videoRef.current);
    return () => obs.disconnect();
  }, [redraw]);

  return (
    <div className="relative bg-black w-full">
      <video
        ref={videoRef}
        src={streamUrl(videoId)}
        controls
        playsInline
        className="w-full block"
        onTimeUpdate={(e) => onTimeUpdate(e.target.currentTime)}
        onSeeked={(e) => onTimeUpdate(e.target.currentTime)}
      />
      {tracking && (
        <canvas
          ref={canvasRef}
          className="absolute inset-0 pointer-events-none"
          style={{ width: "100%", height: "100%" }}
        />
      )}
    </div>
  );
}
