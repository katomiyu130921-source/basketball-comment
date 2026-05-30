import React, { useEffect, useState } from "react";
import {
  superAdminListOrgs, superAdminCreateOrg,
  superAdminGetOrg, superAdminDeleteOrg,
  superAdminCreateTeam, superAdminDeleteTeam,
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
      className="ml-2 text-xs text-gray-500 hover:text-purple-400 transition"
    >
      {copied ? "✓ コピー済" : "コピー"}
    </button>
  );
}

function OrgDetail({ orgId, onClose }) {
  const [org, setOrg] = useState(null);
  const [newTeamName, setNewTeamName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const reload = () => superAdminGetOrg(orgId).then(setOrg).catch(() => {});

  useEffect(() => { reload(); }, [orgId]);

  const createTeam = async (e) => {
    e.preventDefault();
    if (!newTeamName.trim()) return;
    setCreating(true);
    setError("");
    try {
      await superAdminCreateTeam(orgId, newTeamName.trim());
      setNewTeamName("");
      await reload();
    } catch (err) {
      try { setError(JSON.parse(err.message).detail); } catch { setError(err.message); }
    } finally {
      setCreating(false);
    }
  };

  const deleteTeam = async (teamId, name) => {
    if (!confirm(`「${name}」を削除しますか？`)) return;
    await superAdminDeleteTeam(orgId, teamId);
    await reload();
  };

  if (!org) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-xl p-6 w-full max-w-md border border-gray-700 max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">{org.name}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white">✕</button>
        </div>

        {/* 管理者コード */}
        <div className="mb-4 flex items-center gap-2 text-sm">
          <span className="text-gray-500">管理者コード:</span>
          <span className="font-mono text-purple-400 bg-gray-800 px-2 py-0.5 rounded">{org.admin_code}</span>
          <CopyButton text={org.admin_code} />
        </div>

        <div className="overflow-y-auto flex-1 space-y-5">
          {/* チーム管理 */}
          <div>
            <h3 className="text-sm text-gray-400 font-medium mb-2">チーム ({org.teams?.length ?? 0})</h3>

            {/* チーム作成フォーム */}
            <form onSubmit={createTeam} className="flex gap-2 mb-2">
              <input
                type="text"
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
                placeholder="チーム名"
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 text-sm"
              />
              <button
                type="submit"
                disabled={creating || !newTeamName.trim()}
                className="bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition shrink-0"
              >
                作成
              </button>
            </form>
            {error && <p className="text-red-400 text-xs mb-2">{error}</p>}

            {org.teams?.length === 0 ? (
              <p className="text-gray-600 text-xs">チームなし</p>
            ) : (
              org.teams?.map((t) => (
                <div key={t.id} className="flex items-center justify-between text-sm bg-gray-800 rounded px-3 py-2 mb-1 gap-2">
                  <span className="truncate">{t.name}</span>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-gray-500 text-xs font-mono">{t.invite_code}</span>
                    <CopyButton text={t.invite_code} />
                    <button
                      onClick={() => deleteTeam(t.id, t.name)}
                      className="text-red-500 hover:text-red-400 text-xs ml-1"
                    >
                      削除
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* ユーザー一覧 */}
          <div>
            <h3 className="text-sm text-gray-400 font-medium mb-2">ユーザー ({org.users?.length ?? 0})</h3>
            {org.users?.length === 0 ? (
              <p className="text-gray-600 text-xs">ユーザーなし</p>
            ) : (
              org.users?.map((u) => (
                <div key={u.id} className="flex items-center justify-between text-sm bg-gray-800 rounded px-3 py-2 mb-1">
                  <span>{u.username}</span>
                  <span className="text-xs text-gray-500">{u.role}</span>
                </div>
              ))
            )}
          </div>
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

export default function SuperAdmin() {
  const [orgs, setOrgs] = useState([]);
  const [newOrgName, setNewOrgName] = useState("");
  const [creating, setCreating] = useState(false);
  const [selectedOrgId, setSelectedOrgId] = useState(null);

  const load = () => superAdminListOrgs().then(setOrgs).catch(() => {});

  useEffect(() => { load(); }, []);

  const createOrg = async (e) => {
    e.preventDefault();
    if (!newOrgName.trim()) return;
    setCreating(true);
    try {
      await superAdminCreateOrg(newOrgName.trim());
      setNewOrgName("");
      await load();
    } catch {
    } finally {
      setCreating(false);
    }
  };

  const deleteOrg = async (id, name) => {
    if (!confirm(`「${name}」を削除しますか？この組織のすべてのデータが削除されます。`)) return;
    await superAdminDeleteOrg(id);
    await load();
  };

  return (
    <div className="flex-1 p-4 max-w-2xl mx-auto w-full">
      <div className="flex items-center gap-3 mb-6">
        <h2 className="text-xl font-bold">スーパー管理画面</h2>
        <span className="text-xs bg-purple-900 text-purple-300 px-2 py-0.5 rounded">super_admin</span>
      </div>

      {/* 組織作成フォーム */}
      <form onSubmit={createOrg} className="flex gap-2 mb-6">
        <input
          type="text"
          value={newOrgName}
          onChange={(e) => setNewOrgName(e.target.value)}
          placeholder="例: ○○バスケットボールクラブ"
          className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 text-sm"
        />
        <button
          type="submit"
          disabled={creating || !newOrgName.trim()}
          className="bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white px-4 py-2 rounded-lg text-sm font-medium transition shrink-0"
        >
          組織を追加
        </button>
      </form>

      {/* 組織一覧 */}
      {orgs.length === 0 ? (
        <div className="text-center text-gray-600 py-12">
          <p className="text-3xl mb-2">🏢</p>
          <p className="text-sm">組織がまだありません</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orgs.map((org) => (
            <div key={org.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-semibold text-white">{org.name}</h3>
                  <div className="mt-2 flex items-center gap-1 text-sm">
                    <span className="text-gray-500">管理者コード:</span>
                    <span className="font-mono text-purple-400 bg-gray-800 px-2 py-0.5 rounded text-xs">
                      {org.admin_code}
                    </span>
                    <CopyButton text={org.admin_code} />
                  </div>
                  <div className="mt-1 text-xs text-gray-600 space-x-3">
                    <span>ユーザー: {org.user_count}人</span>
                    <span>チーム: {org.team_count}チーム</span>
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => setSelectedOrgId(org.id)}
                    className="text-xs text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 px-2 py-1 rounded transition"
                  >
                    管理
                  </button>
                  <button
                    onClick={() => deleteOrg(org.id, org.name)}
                    className="text-xs text-red-500 hover:text-red-400 border border-red-900 hover:border-red-700 px-2 py-1 rounded transition"
                  >
                    削除
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 使い方 */}
      <div className="mt-6 bg-gray-900 border border-gray-800 rounded-xl p-4 text-sm text-gray-500">
        <p className="font-medium text-gray-400 mb-2">運用フロー</p>
        <ol className="list-decimal list-inside space-y-1">
          <li>「組織を追加」でクライアント組織を作成</li>
          <li>「管理」ボタンからチームを作成 → 招待コードを選手に共有</li>
          <li>選手は「新規登録 → 招待コード」で登録するだけ</li>
        </ol>
      </div>

      {selectedOrgId && (
        <OrgDetail
          orgId={selectedOrgId}
          onClose={() => { setSelectedOrgId(null); load(); }}
        />
      )}
    </div>
  );
}
