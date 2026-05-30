import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getVideo, getTracking, listComments } from "../api";
import VideoPlayer from "../components/VideoPlayer";
import CourtView from "../components/CourtView";
import CommentPanel from "../components/CommentPanel";

export default function VideoDetail() {
  const { id } = useParams();
  const nav = useNavigate();

  const [video, setVideo] = useState(null);
  const [tracking, setTracking] = useState(null);
  const [comments, setComments] = useState([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [error, setError] = useState("");
  const videoRef = useRef(null); // forwarded into VideoPlayer for seek

  useEffect(() => {
    Promise.all([
      getVideo(id),
      listComments(id),
    ])
      .then(([v, c]) => {
        setVideo(v);
        setComments(c);
        if (v.has_tracking) {
          getTracking(id)
            .then(setTracking)
            .catch(() => {});
        }
      })
      .catch((err) => setError(err.message));
  }, [id]);

  // Find the closest frame in tracking data for current playback time
  const currentFrame = useMemo(() => {
    if (!tracking?.frames?.length) return null;
    const fps = tracking.fps || 30;
    const idx = Math.min(
      Math.round(currentTime * fps),
      tracking.frames.length - 1
    );
    return tracking.frames[idx] ?? null;
  }, [currentTime, tracking]);

  const handleJumpTo = (timestamp) => {
    // Find the <video> element and seek it
    const video = document.querySelector("video");
    if (video) {
      video.currentTime = timestamp;
      setCurrentTime(timestamp);
    }
  };

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center text-red-400">
        {error}
      </div>
    );
  }

  if (!video) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500">
        読み込み中...
      </div>
    );
  }

  const players = video.players ?? [];

  return (
    <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
      {/* ── Left: Video + Court ─────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-1 min-w-0">
        {/* Back + title */}
        <div className="flex items-center gap-3 px-3 py-2 border-b border-gray-800 bg-gray-900">
          <button
            onClick={() => nav("/")}
            className="text-gray-500 hover:text-white text-sm transition"
          >
            ← 戻る
          </button>
          <h1 className="font-semibold truncate text-sm">{video.title}</h1>
        </div>

        <VideoPlayer
          videoId={id}
          tracking={tracking}
          currentFrame={currentFrame}
          onTimeUpdate={setCurrentTime}
        />

        <CourtView tracking={tracking} currentFrame={currentFrame} />

        {/* Player legend */}
        {players.length > 0 && (
          <div className="px-3 py-2 flex flex-wrap gap-2 border-t border-gray-800 bg-gray-950">
            {players.map((p) => (
              <span
                key={p.id}
                className="text-xs px-2 py-1 rounded"
                style={{
                  background: `rgba(${p.color[0]},${p.color[1]},${p.color[2]},0.2)`,
                  color: `rgb(${p.color[0]},${p.color[1]},${p.color[2]})`,
                }}
              >
                #{p.number} {p.name}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ── Right: Comment panel ────────────────────────────────────────── */}
      <div className="w-full lg:w-80 xl:w-96 flex flex-col min-h-64 lg:min-h-0 border-t lg:border-t-0 border-gray-800">
        <CommentPanel
          videoId={id}
          players={players}
          comments={comments}
          setComments={setComments}
          currentTime={currentTime}
          onJumpTo={handleJumpTo}
        />
      </div>
    </div>
  );
}
