import React, { createContext, useContext, useState } from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import Login from "./pages/Login";
import VideoList from "./pages/VideoList";
import VideoDetail from "./pages/VideoDetail";
import Admin from "./pages/Admin";
import SuperAdmin from "./pages/SuperAdmin";

const AuthContext = createContext(null);
export function useAuth() { return useContext(AuthContext); }

function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const token    = localStorage.getItem("token");
    const username = localStorage.getItem("username");
    const role     = localStorage.getItem("role");
    return token ? { token, username, role } : null;
  });

  const signIn = (token, username, role) => {
    localStorage.setItem("token",    token);
    localStorage.setItem("username", username);
    localStorage.setItem("role",     role ?? "member");
    setUser({ token, username, role: role ?? "member" });
  };

  const signOut = () => {
    ["token", "username", "role"].forEach(k => localStorage.removeItem(k));
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

function RequireAuth({ children }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" replace />;
}

function RequireOrgAdmin({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === "super_admin") return <Navigate to="/super-admin" replace />;
  if (user.role !== "org_admin") return <Navigate to="/" replace />;
  return children;
}

function RequireSuperAdmin({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== "super_admin") return <Navigate to="/" replace />;
  return children;
}

function ChangePasswordModal({ onClose }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("/api/auth/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ current_password: current, new_password: next }),
      });
      if (!res.ok) {
        const msg = await res.json().catch(() => ({}));
        throw new Error(msg.detail ?? "エラーが発生しました");
      }
      setDone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-xl p-6 w-full max-w-sm border border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold">パスワード変更</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white">✕</button>
        </div>
        {done ? (
          <div className="text-center py-4">
            <p className="text-green-400 mb-4">パスワードを変更しました</p>
            <button onClick={onClose} className="w-full py-2 bg-orange-500 hover:bg-orange-400 text-white rounded-lg text-sm">
              閉じる
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <div>
              <label className="block text-sm text-gray-400 mb-1">現在のパスワード</label>
              <input
                type="password"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                required
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-orange-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">新しいパスワード（6文字以上）</label>
              <input
                type="password"
                value={next}
                onChange={(e) => setNext(e.target.value)}
                required
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-orange-500 text-sm"
              />
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 bg-orange-500 hover:bg-orange-400 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition"
            >
              {loading ? "変更中..." : "変更する"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function Header() {
  const { user, signOut } = useAuth();
  const nav = useNavigate();
  const [showPwModal, setShowPwModal] = useState(false);
  if (!user) return null;
  return (
    <>
      <header className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-800 shrink-0">
        <button
          onClick={() => nav(user.role === "super_admin" ? "/super-admin" : "/")}
          className="font-bold text-orange-400 tracking-wide"
        >
          🎬 Video Clip Note
        </button>
        <div className="flex items-center gap-4 text-sm">
          {user.role === "super_admin" && (
            <button
              onClick={() => nav("/super-admin")}
              className="text-purple-300 hover:text-purple-200 transition font-medium"
            >
              スーパー管理
            </button>
          )}
          {user.role === "org_admin" && (
            <button
              onClick={() => nav("/admin")}
              className="text-orange-300 hover:text-orange-200 transition font-medium"
            >
              管理画面
            </button>
          )}
          <button
            onClick={() => setShowPwModal(true)}
            className="text-gray-400 hover:text-white transition"
            title="パスワード変更"
          >
            {user.username}
          </button>
          <button onClick={signOut} className="text-gray-500 hover:text-gray-200 transition">
            ログアウト
          </button>
        </div>
      </header>
      {showPwModal && <ChangePasswordModal onClose={() => setShowPwModal(false)} />}
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <div className="min-h-screen flex flex-col">
        <Header />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<RequireAuth><VideoList /></RequireAuth>} />
          <Route path="/videos/:id" element={<RequireAuth><VideoDetail /></RequireAuth>} />
          <Route path="/admin" element={<RequireOrgAdmin><Admin /></RequireOrgAdmin>} />
          <Route path="/super-admin" element={<RequireSuperAdmin><SuperAdmin /></RequireSuperAdmin>} />
        </Routes>
      </div>
    </AuthProvider>
  );
}
