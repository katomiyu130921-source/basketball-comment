import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { login, register } from "../api";
import { useAuth } from "../App";

export default function Login() {
  const { signIn } = useAuth();
  const nav = useNavigate();
  const [mode, setMode] = useState("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [adminCode, setAdminCode] = useState("");
  const [codeType, setCodeType] = useState("invite"); // "invite" | "admin"
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      let data;
      if (mode === "login") {
        data = await login(username, password);
      } else {
        const invite = codeType === "invite" ? inviteCode || undefined : undefined;
        const admin  = codeType === "admin"  ? adminCode  || undefined : undefined;
        data = await register(username, password, invite, admin);
      }
      signIn(data.token, data.username, data.role);
      if (data.role === "super_admin") nav("/super-admin");
      else if (data.role === "org_admin") nav("/admin");
      else nav("/");
    } catch (err) {
      try {
        const parsed = JSON.parse(err.message);
        setError(parsed.detail ?? err.message);
      } catch {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-center mb-8 text-orange-400">
          🎬 Video Clip Note
        </h1>
        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
          <div className="flex mb-6 rounded-lg overflow-hidden border border-gray-700">
            {["login", "register"].map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(""); }}
                className={`flex-1 py-2 text-sm font-medium transition ${
                  mode === m ? "bg-orange-500 text-white" : "text-gray-400 hover:text-white"
                }`}
              >
                {m === "login" ? "ログイン" : "新規登録"}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">ユーザー名</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-600 focus:outline-none focus:border-orange-500"
                placeholder="username"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">パスワード</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-600 focus:outline-none focus:border-orange-500"
                placeholder="6文字以上"
              />
            </div>

            {mode === "register" && (
              <div>
                <div className="flex gap-2 mb-2">
                  {[["invite", "招待コード"], ["admin", "管理者コード"]].map(([v, label]) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setCodeType(v)}
                      className={`flex-1 text-xs py-1.5 rounded border transition ${
                        codeType === v
                          ? "border-orange-500 text-orange-400 bg-orange-950"
                          : "border-gray-700 text-gray-500 hover:text-white"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {codeType === "invite" ? (
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">
                      招待コード
                      <span className="text-gray-600 ml-1 text-xs">（チームの招待コード）</span>
                    </label>
                    <input
                      type="text"
                      value={inviteCode}
                      onChange={(e) => setInviteCode(e.target.value)}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-600 focus:outline-none focus:border-orange-500 font-mono"
                      placeholder="例: abc123xy"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">
                      管理者コード
                      <span className="text-gray-600 ml-1 text-xs">（組織の管理者コード）</span>
                    </label>
                    <input
                      type="text"
                      value={adminCode}
                      onChange={(e) => setAdminCode(e.target.value)}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-600 focus:outline-none focus:border-orange-500 font-mono"
                      placeholder="例: XyZ9kLmN2Q"
                    />
                  </div>
                )}
              </div>
            )}

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-orange-500 hover:bg-orange-400 disabled:opacity-50 text-white font-medium py-2 rounded-lg transition"
            >
              {loading ? "処理中..." : mode === "login" ? "ログイン" : "登録"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
