import React, { useEffect, useState } from "react";
import {
  adminListTeams, adminCreateTeam, adminDeleteTeam,
  adminGetTeam, adminListUsers, adminDeleteUser,
} from "../api";

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={copy}
      className="ml-2 text-xs text-gray-500 hover:text-orange-400 transition"
    >
      {copied ? "✓ コピー済" : "コピー"}
    </button>
  );
}

function TeamCard({ team, onDelete, onSelect }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold text-white">{team.name}</h3>
          <div className="mt-2 flex items-center gap-1 text-sm">
            <span className="text-gray-500">招待コード:</span>
            <span className="font-mono text-orange-400 bg-gray-800 px-2 py-0.5 rounded">
              {team.invite_code}
            </span>
            <CopyButton text={team.invite_code} />
          </div>
          <div className="mt-1 text-xs text-gray-600 space-x-3">
            <span>メンバー: {team.member_count}人</span>
            <span>動画: {team.video_count}本</span>
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => onSelect(team.id)}
            className="text-xs text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 px-2 py-1 rounded transition"
          >
            詳細
          </button>
          <button
            onClick={() => onDelete(team.id, team.name)}
            className="text-xs text-red-500 hover:text-red-400 border border-red-900 hover:border-red-700 px-2 py-1 rounded transition"
          >
            削除
          </button>
        </div>
      </div>
    </div>
  );
}

function TeamDetail({ teamId, onClose }) {
  const [team, setTeam] = useState(null);

  useEffect(() => {
    adminGetTeam(teamId).then(setTeam).catch(() => {});
  }, [teamId]);

  if (!team) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-xl p-6 w-full max-w-md border border-gray-700 max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">{team.name}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white">✕</button>
        </div>
        <div className="mb-3 flex items-center gap-2 text-sm">
          <span className="text-gray-500">招待コード:</span>
          <span className="font-mono text-orange-400 bg-gray-800 px-2 py-0.5 rounded">{team.invite_code}</span>
          <CopyButton text={team.invite_code} />
        </div>
        <h3 className="text-sm text-gray-500 mb-2">メンバー ({team.members?.length ?? 0}人)</h3>
        <div className="overflow-y-auto flex-1 space-y-2">
          {team.members?.length === 0 ? (
            <p className="text-gray-600 text-sm">まだメンバーがいません</p>
          ) : (
            team.members?.map((m) => (
              <div key={m.id} className="flex items-center justify-between text-sm bg-gray-800 rounded px-3 py-2">
                <span>{m.username}</span>
                <span className="text-gray-600 text-xs">{new Date(m.joined_at).toLocaleDateString("ja-JP")}</span>
              </div>
            ))
          )}
        </div>
        <button
          onClick={onClose}
          className="mt-4 w-full py-2 border border-gray-700 rounded-lg text-gray-400 hover:text-white transition text-sm"
        >
          閉じる
        </button>
      </div>
    </div>
  );
}

export default function Admin() {
  const [teams, setTeams] = useState([]);
  const [users, setUsers] = useState([]);
  const [newTeamName, setNewTeamName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [selectedTeamId, setSelectedTeamId] = useState(null);
  const [tab, setTab] = useState("teams"); // "teams" | "users"

  const load = async () => {
    const [t, u] = await Promise.all([adminListTeams(), adminListUsers()]);
    setTeams(t);
    setUsers(u);
  };

  useEffect(() => { load(); }, []);

  const createTeam = async (e) => {
    e.preventDefault();
    if (!newTeamName.trim()) return;
    setCreating(true);
    setCreateError("");
    try {
      await adminCreateTeam(newTeamName.trim());
      setNewTeamName("");
      await load();
    } catch (err) {
      try {
        const parsed = JSON.parse(err.message);
        setCreateError(parsed.detail ?? err.message);
      } catch {
        setCreateError(err.message);
      }
    } finally {
      setCreating(false);
    }
  };

  const deleteTeam = async (id, name) => {
    if (!confirm(`「${name}」を削除しますか？メンバーの動画も削除されます。`)) return;
    await adminDeleteTeam(id);
    await load();
  };

  const deleteUser = async (id, username) => {
    if (!confirm(`「${username}」を削除しますか？`)) return;
    await adminDeleteUser(id);
    await load();
  };

  return (
    <div className="flex-1 p-4 max-w-2xl mx-auto w-full">
      <h2 className="text-xl font-bold mb-6">管理画面</h2>

      {/* タブ */}
      <div className="flex gap-2 mb-6 border-b border-gray-800">
        {[["teams", "チーム管理"], ["users", "ユーザー管理"]].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`pb-2 px-1 text-sm font-medium border-b-2 transition ${
              tab === key ? "border-orange-500 text-orange-400" : "border-transparent text-gray-500 hover:text-white"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* チーム管理 */}
      {tab === "teams" && (
        <div className="space-y-4">
          {/* チーム作成フォーム */}
          <form onSubmit={createTeam} className="space-y-2">
            <div className="flex gap-2">
              <input
                type="text"
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
                placeholder="例: チームA、U18男子"
                className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-600 focus:outline-none focus:border-orange-500 text-sm"
              />
              <button
                type="submit"
                disabled={creating || !newTeamName.trim()}
                className="bg-orange-500 hover:bg-orange-400 disabled:opacity-40 text-white px-4 py-2 rounded-lg text-sm font-medium transition shrink-0"
              >
                チーム作成
              </button>
            </div>
            {createError && <p className="text-red-400 text-sm">{createError}</p>}
          </form>

          {/* チーム一覧 */}
          {teams.length === 0 ? (
            <div className="text-center text-gray-600 py-12">
              <p className="text-3xl mb-2">👥</p>
              <p className="text-sm">チームがまだありません</p>
            </div>
          ) : (
            <div className="space-y-3">
              {teams.map((t) => (
                <TeamCard
                  key={t.id}
                  team={t}
                  onDelete={deleteTeam}
                  onSelect={setSelectedTeamId}
                />
              ))}
            </div>
          )}

          {/* 使い方の説明 */}
          <div className="mt-6 bg-gray-900 border border-gray-800 rounded-xl p-4 text-sm text-gray-500">
            <p className="font-medium text-gray-400 mb-2">招待コードの使い方</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>チームを作成すると招待コードが発行されます</li>
              <li>招待コードを選手に共有（LINEなど）</li>
              <li>選手はログイン画面の「新規登録」で招待コードを入力</li>
              <li>登録するとそのチームの動画が見られるようになります</li>
            </ol>
          </div>
        </div>
      )}

      {/* ユーザー管理 */}
      {tab === "users" && (
        <div className="space-y-2">
          {users.map((u) => (
            <div key={u.id} className="bg-gray-900 border border-gray-800 rounded-lg px-4 py-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{u.username}</span>
                  {u.role === "org_admin" && (
                    <span className="text-xs bg-orange-900 text-orange-400 px-2 py-0.5 rounded">管理者</span>
                  )}
                </div>
                <p className="text-xs text-gray-600 mt-0.5">
                  {u.team_name ? `チーム: ${u.team_name}` : "チーム未所属"}
                </p>
              </div>
              {u.role === "member" && (
                <button
                  onClick={() => deleteUser(u.id, u.username)}
                  className="text-xs text-red-500 hover:text-red-400 shrink-0"
                >
                  削除
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {selectedTeamId && (
        <TeamDetail teamId={selectedTeamId} onClose={() => setSelectedTeamId(null)} />
      )}
    </div>
  );
}
