import React, { createContext, useContext, useState } from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import Login from "./pages/Login";
import VideoList from "./pages/VideoList";
import VideoDetail from "./pages/VideoDetail";

// ── Auth context ──────────────────────────────────────────────────────────────
const AuthContext = createContext(null);

export function useAuth() {
  return useContext(AuthContext);
}

function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const token = localStorage.getItem("token");
    const username = localStorage.getItem("username");
    return token ? { token, username } : null;
  });

  const signIn = (token, username) => {
    localStorage.setItem("token", token);
    localStorage.setItem("username", username);
    setUser({ token, username });
  };

  const signOut = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("username");
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

// ── App shell ─────────────────────────────────────────────────────────────────
function Header() {
  const { user, signOut } = useAuth();
  const nav = useNavigate();

  if (!user) return null;
  return (
    <header className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-800">
      <button
        onClick={() => nav("/")}
        className="font-bold text-orange-400 tracking-wide"
      >
        🎬 Video Clip Note
      </button>
      <div className="flex items-center gap-3 text-sm">
        <span className="text-gray-400">{user.username}</span>
        <button
          onClick={signOut}
          className="text-gray-500 hover:text-gray-200 transition"
        >
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
          <Route
            path="/"
            element={
              <RequireAuth>
                <VideoList />
              </RequireAuth>
            }
          />
          <Route
            path="/videos/:id"
            element={
              <RequireAuth>
                <VideoDetail />
              </RequireAuth>
            }
          />
        </Routes>
      </div>
    </AuthProvider>
  );
}
