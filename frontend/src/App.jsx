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
  if (!["org_admin", "super_admin"].includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

function RequireSuperAdmin({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== "super_admin") return <Navigate to="/" replace />;
  return children;
}

function Header() {
  const { user, signOut } = useAuth();
  const nav = useNavigate();
  if (!user) return null;
  return (
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
        <span className="text-gray-400">{user.username}</span>
        <button onClick={signOut} className="text-gray-500 hover:text-gray-200 transition">
          ログアウト
        </button>
      </div>
    </header>
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
