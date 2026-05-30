const BASE = import.meta.env.VITE_API_URL ?? "";

function authHeaders() {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function req(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: { ...authHeaders(), ...opts.headers },
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => res.statusText);
    throw new Error(msg);
  }
  if (res.status === 204) return null;
  return res.json();
}

// ── Auth ──────────────────────────────────────────────────────────────────────
export const register = (username, password) =>
  req("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });

export const login = (username, password) =>
  req("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });

// ── Videos ───────────────────────────────────────────────────────────────────
export const listVideos = () => req("/api/videos");

export const getVideo = (id) => req(`/api/videos/${id}`);

export const getTracking = (id) => req(`/api/videos/${id}/tracking`);

export const uploadVideo = (formData) =>
  req("/api/videos", { method: "POST", body: formData });

export const streamUrl = (id) => `${BASE}/api/videos/${id}/stream`;

// ── Comments ─────────────────────────────────────────────────────────────────
export const listComments = (videoId) => req(`/api/videos/${videoId}/comments`);

export const addComment = (videoId, data) =>
  req(`/api/videos/${videoId}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

export const deleteComment = (id) =>
  req(`/api/comments/${id}`, { method: "DELETE" });
