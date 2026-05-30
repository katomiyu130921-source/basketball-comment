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
export const register = (username, password, invite_code, admin_code) =>
  req("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password, invite_code, admin_code }),
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

// ── Admin (org_admin) ─────────────────────────────────────────────────────────
export const adminListTeams = () => req("/api/admin/teams");
export const adminCreateTeam = (name) =>
  req("/api/admin/teams", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
export const adminDeleteTeam = (id) =>
  req(`/api/admin/teams/${id}`, { method: "DELETE" });
export const adminGetTeam = (id) => req(`/api/admin/teams/${id}`);
export const adminListUsers = () => req("/api/admin/users");
export const adminDeleteUser = (id) =>
  req(`/api/admin/users/${id}`, { method: "DELETE" });

// ── Super Admin ───────────────────────────────────────────────────────────────
export const superAdminListOrgs = () => req("/api/super-admin/orgs");
export const superAdminCreateOrg = (name) =>
  req("/api/super-admin/orgs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
export const superAdminGetOrg = (id) => req(`/api/super-admin/orgs/${id}`);
export const superAdminDeleteOrg = (id) =>
  req(`/api/super-admin/orgs/${id}`, { method: "DELETE" });
