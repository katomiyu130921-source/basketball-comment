import React, { useState, useRef, useEffect } from "react";
import { addComment, deleteComment } from "../api";
import { useAuth } from "../App";

function fmt(sec) {
  if (sec == null) return "";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function PlayerBadge({ player }) {
  if (!player) return <span className="text-gray-500 text-xs">全体</span>;
  const [r, g, b] = player.color;
  return (
    <span
      className="text-xs font-bold px-2 py-0.5 rounded"
      style={{ background: `rgba(${r},${g},${b},0.2)`, color: `rgb(${r},${g},${b})` }}
    >
      #{player.number} {player.name}
    </span>
  );
}

function CommentItem({ comment, players, onDelete, onJump }) {
  const { user } = useAuth();
  const player = players.find((p) => p.id === comment.player_id) ?? null;

  return (
    <div className="border-b border-gray-800 py-3 group">
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => onJump(comment.timestamp)}
            className="text-xs text-orange-400 hover:text-orange-300 font-mono"
          >
            {fmt(comment.timestamp)}
          </button>
          <PlayerBadge player={player} />
          <span className="text-xs text-gray-600">{comment.author}</span>
        </div>
        {user?.username === comment.author && (
          <button
            onClick={() => onDelete(comment.id)}
            className="text-gray-700 hover:text-red-400 transition opacity-0 group-hover:opacity-100 text-xs"
          >
            削除
          </button>
        )}
      </div>
      <p className="text-sm text-gray-200 leading-relaxed">{comment.text}</p>
    </div>
  );
}

function AddCommentForm({ videoId, players, currentTime, onAdded }) {
  const [playerId, setPlayerId] = useState("");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    setLoading(true);
    try {
      const comment = await addComment(videoId, {
        player_id: playerId === "" ? null : Number(playerId),
        timestamp: currentTime,
        text: text.trim(),
      });
      onAdded(comment);
      setText("");
    } catch {
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="border-t border-gray-800 pt-3 space-y-2">
      <div className="flex gap-2">
        <span className="text-xs text-orange-400 font-mono self-center shrink-0">
          {fmt(currentTime)}
        </span>
        <select
          value={playerId}
          onChange={(e) => setPlayerId(e.target.value)}
          className="flex-1 bg-gray-800 border border-gray-700 rounded text-sm px-2 py-1 text-white focus:outline-none focus:border-orange-500"
        >
          <option value="">全体</option>
          {players.map((p) => (
            <option key={p.id} value={p.id}>
              #{p.number} {p.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="コメントを入力..."
          className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-orange-500"
        />
        <button
          type="submit"
          disabled={loading || !text.trim()}
          className="bg-orange-500 hover:bg-orange-400 disabled:opacity-40 text-white px-3 py-2 rounded-lg text-sm font-medium transition shrink-0"
        >
          送信
        </button>
      </div>
    </form>
  );
}

export default function CommentPanel({
  videoId,
  players,
  comments,
  setComments,
  currentTime,
  onJumpTo,
}) {
  const listRef = useRef(null);

  const handleDelete = async (id) => {
    try {
      await deleteComment(id);
      setComments((prev) => prev.filter((c) => c.id !== id));
    } catch {}
  };

  const handleAdded = (comment) => {
    setComments((prev) =>
      [...prev, comment].sort((a, b) => a.timestamp - b.timestamp)
    );
  };

  // Highlight comment nearest to currentTime
  const nearest = comments.reduce((best, c) => {
    return Math.abs(c.timestamp - currentTime) < Math.abs((best?.timestamp ?? Infinity) - currentTime)
      ? c
      : best;
  }, null);

  return (
    <div className="flex flex-col h-full bg-gray-900 border-l border-gray-800">
      <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
        <h3 className="font-semibold text-sm">コメント</h3>
        <span className="text-xs text-gray-500">{comments.length}件</span>
      </div>

      <div ref={listRef} className="flex-1 overflow-y-auto px-4">
        {comments.length === 0 ? (
          <p className="text-center text-gray-600 text-sm mt-8">
            まだコメントがありません
          </p>
        ) : (
          comments.map((c) => (
            <div
              key={c.id}
              className={nearest?.id === c.id ? "opacity-100" : "opacity-60"}
            >
              <CommentItem
                comment={c}
                players={players}
                onDelete={handleDelete}
                onJump={onJumpTo}
              />
            </div>
          ))
        )}
      </div>

      <div className="px-4 pb-4">
        <AddCommentForm
          videoId={videoId}
          players={players}
          currentTime={currentTime}
          onAdded={handleAdded}
        />
      </div>
    </div>
  );
}
