import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { listVideos, uploadVideo } from "../api";

function UploadModal({ onClose, onUploaded }) {
  const [title, setTitle] = useState("");
  const [videoFile, setVideoFile] = useState(null);
  const [trackingFile, setTrackingFile] = useState(null);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    if (!videoFile) return;
    setError("");
    setProgress("アップロード中...");
    try {
      const fd = new FormData();
      fd.append("title", title || videoFile.name);
      fd.append("video", videoFile);
      if (trackingFile) fd.append("tracking", trackingFile);
      await uploadVideo(fd);
      setProgress("完了！");
      onUploaded();
    } catch (err) {
      setError(err.message);
      setProgress("");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-xl p-6 w-full max-w-md border border-gray-700">
        <h2 className="text-lg font-bold mb-4">動画をアップロード</h2>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">タイトル</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例: vs チームA 第1Q"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-orange-500"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">
              動画ファイル <span className="text-orange-400">*</span>
            </label>
            <input
              type="file"
              accept="video/*"
              required
              onChange={(e) => setVideoFile(e.target.files[0])}
              className="w-full text-sm text-gray-400 file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:bg-orange-500 file:text-white"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">
              tracking.json（任意）
            </label>
            <input
              type="file"
              accept=".json,application/json"
              onChange={(e) => setTrackingFile(e.target.files[0])}
              className="w-full text-sm text-gray-400 file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:bg-gray-700 file:text-white"
            />
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}
          {progress && <p className="text-green-400 text-sm">{progress}</p>}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 rounded-lg border border-gray-700 text-gray-400 hover:text-white transition"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={!!progress}
              className="flex-1 py-2 rounded-lg bg-orange-500 hover:bg-orange-400 disabled:opacity-50 font-medium transition"
            >
              アップロード
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function VideoList() {
  const [videos, setVideos] = useState([]);
  const [showUpload, setShowUpload] = useState(false);
  const nav = useNavigate();

  const load = async () => {
    try {
      setVideos(await listVideos());
    } catch {}
  };

  useEffect(() => { load(); }, []);

  const fmt = (sec) => {
    if (!sec) return "--:--";
    const m = Math.floor(sec / 60);
    const s = Math.round(sec % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  return (
    <div className="flex-1 p-4 max-w-3xl mx-auto w-full">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold">動画一覧</h2>
        <button
          onClick={() => setShowUpload(true)}
          className="bg-orange-500 hover:bg-orange-400 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
        >
          + アップロード
        </button>
      </div>

      {videos.length === 0 ? (
        <div className="text-center text-gray-600 mt-20">
          <p className="text-4xl mb-3">🎬</p>
          <p>動画がまだありません</p>
        </div>
      ) : (
        <div className="space-y-3">
          {videos.map((v) => (
            <button
              key={v.id}
              onClick={() => nav(`/videos/${v.id}`)}
              className="w-full bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-gray-700 rounded-xl p-4 text-left transition"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-semibold truncate">{v.title}</p>
                  <p className="text-sm text-gray-500 mt-1">
                    {v.uploader} · {new Date(v.created_at).toLocaleDateString("ja-JP")}
                  </p>
                </div>
                <div className="text-right text-sm text-gray-500 shrink-0">
                  {v.total_frames && v.fps
                    ? fmt(v.total_frames / v.fps)
                    : ""}
                  {v.has_tracking ? (
                    <span className="ml-2 bg-green-900 text-green-400 text-xs px-2 py-0.5 rounded">
                      tracking
                    </span>
                  ) : null}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {showUpload && (
        <UploadModal
          onClose={() => setShowUpload(false)}
          onUploaded={() => { setShowUpload(false); load(); }}
        />
      )}
    </div>
  );
}
