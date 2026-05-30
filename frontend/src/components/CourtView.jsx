import React, { useRef, useEffect } from "react";

const CW = 470;  // canvas width (half court shown × 2)
const CH = 250;  // canvas height
const M = 8;     // margin

function drawCourt(ctx) {
  ctx.fillStyle = "#0a0a0a";
  ctx.fillRect(0, 0, CW, CH);

  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 1.5;

  const iw = CW - M * 2;
  const ih = CH - M * 2;

  // Boundary
  ctx.strokeRect(M, M, iw, ih);

  // Center line
  ctx.beginPath();
  ctx.moveTo(CW / 2, M);
  ctx.lineTo(CW / 2, CH - M);
  ctx.stroke();

  // Center circle (r ≈ 6% of court width)
  ctx.beginPath();
  ctx.arc(CW / 2, CH / 2, iw * 0.06, 0, Math.PI * 2);
  ctx.stroke();

  // Keys (paint) — left and right
  const keyW = iw * 0.155;   // ~4.9m / 28m
  const keyH = ih * 0.47;    // ~4.9m / 15m × court height
  const keyDepth = iw * 0.19; // ~5.8m / 28m × half

  for (const side of [-1, 1]) {
    const kx = side === -1 ? M : CW - M - keyDepth;
    const ky = CH / 2 - keyH / 2;
    ctx.strokeRect(kx, ky, keyDepth, keyH);

    // Free throw circle
    const fcx = side === -1 ? M + keyDepth : CW - M - keyDepth;
    ctx.beginPath();
    ctx.arc(fcx, CH / 2, keyH / 2, 0, Math.PI * 2);
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Basket
    const bx = side === -1 ? M + iw * 0.055 : CW - M - iw * 0.055;
    ctx.beginPath();
    ctx.arc(bx, CH / 2, iw * 0.015, 0, Math.PI * 2);
    ctx.fillStyle = "#ff6b00";
    ctx.fill();

    // 3-point arc
    const arcR = iw * 0.237;
    const startAngle = side === -1 ? -Math.PI / 2 : Math.PI / 2;
    ctx.beginPath();
    ctx.arc(bx, CH / 2, arcR, startAngle, startAngle + Math.PI);
    ctx.stroke();

    // 3-point corner lines
    const cornerY1 = CH / 2 - ih * 0.44;
    const cornerY2 = CH / 2 + ih * 0.44;
    const cornerX = side === -1 ? M + iw * 0.145 : CW - M - iw * 0.145;
    ctx.beginPath();
    ctx.moveTo(side === -1 ? M : CW - M, cornerY1);
    ctx.lineTo(cornerX, cornerY1);
    ctx.moveTo(side === -1 ? M : CW - M, cornerY2);
    ctx.lineTo(cornerX, cornerY2);
    ctx.stroke();
  }
}

function drawPlayers(ctx, frameData, players) {
  if (!frameData) return;
  const iw = CW - M * 2;
  const ih = CH - M * 2;

  for (const fp of frameData.players) {
    if (!fp.court_pos) continue;
    const player = players.find((p) => p.id === fp.player_id);
    if (!player) continue;

    const px = M + fp.court_pos[0] * iw;
    const py = M + (1 - fp.court_pos[1]) * ih;

    // Shadow
    ctx.beginPath();
    ctx.arc(px, py, 11, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.fill();

    // Player dot
    ctx.beginPath();
    ctx.arc(px, py, 9, 0, Math.PI * 2);
    ctx.fillStyle = `rgb(${player.color[0]},${player.color[1]},${player.color[2]})`;
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Number label
    ctx.fillStyle = "#000";
    ctx.font = "bold 8px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(player.number, px, py);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  }
}

export default function CourtView({ tracking, currentFrame }) {
  const canvasRef = useRef(null);
  const players = tracking?.players ?? [];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    drawCourt(ctx);
    drawPlayers(ctx, currentFrame, players);
  }, [currentFrame, players]);

  if (!tracking) return null;

  return (
    <div className="bg-gray-950 border-t border-gray-800 p-2">
      <p className="text-xs text-gray-600 mb-1 px-1">コート俯瞰図</p>
      <canvas
        ref={canvasRef}
        width={CW}
        height={CH}
        className="w-full rounded"
        style={{ maxHeight: 160 }}
      />
    </div>
  );
}
