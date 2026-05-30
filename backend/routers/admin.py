import secrets
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from db import get_conn
from auth import get_current_user

router = APIRouter(prefix="/api/admin", tags=["admin"])


def require_admin(user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(403, "管理者専用です")
    return user


class TeamCreate(BaseModel):
    name: str


# ── チーム ────────────────────────────────────────────────────────────────────

@router.post("/teams", status_code=201)
def create_team(body: TeamCreate, user=Depends(require_admin)):
    if not body.name.strip():
        raise HTTPException(400, "チーム名を入力してください")
    code = secrets.token_urlsafe(8)
    conn = get_conn()
    conn.execute("INSERT INTO teams (name, invite_code) VALUES (?, ?)", (body.name.strip(), code))
    conn.commit()
    team_id = conn.execute("SELECT id FROM teams WHERE invite_code = ?", (code,)).fetchone()["id"]
    conn.close()
    return {"id": team_id, "name": body.name.strip(), "invite_code": code}


@router.get("/teams")
def list_teams(user=Depends(require_admin)):
    conn = get_conn()
    rows = conn.execute("""
        SELECT t.id, t.name, t.invite_code, t.created_at,
               COUNT(DISTINCT tm.user_id) AS member_count,
               COUNT(DISTINCT v.id)       AS video_count
        FROM teams t
        LEFT JOIN team_members tm ON t.id = tm.team_id
        LEFT JOIN videos v        ON t.id = v.team_id
        GROUP BY t.id
        ORDER BY t.created_at DESC
    """).fetchall()
    conn.close()
    return [dict(r) for r in rows]


@router.get("/teams/{team_id}")
def get_team(team_id: int, user=Depends(require_admin)):
    conn = get_conn()
    team = conn.execute("SELECT * FROM teams WHERE id = ?", (team_id,)).fetchone()
    if not team:
        conn.close()
        raise HTTPException(404, "チームが見つかりません")
    members = conn.execute("""
        SELECT u.id, u.username, u.created_at, tm.joined_at
        FROM team_members tm JOIN users u ON tm.user_id = u.id
        WHERE tm.team_id = ?
        ORDER BY tm.joined_at DESC
    """, (team_id,)).fetchall()
    conn.close()
    return {**dict(team), "members": [dict(m) for m in members]}


@router.delete("/teams/{team_id}", status_code=204)
def delete_team(team_id: int, user=Depends(require_admin)):
    conn = get_conn()
    conn.execute("DELETE FROM teams WHERE id = ?", (team_id,))
    conn.commit()
    conn.close()


# ── ユーザー ──────────────────────────────────────────────────────────────────

@router.get("/users")
def list_users(user=Depends(require_admin)):
    conn = get_conn()
    rows = conn.execute("""
        SELECT u.id, u.username, u.role, u.created_at,
               t.id AS team_id, t.name AS team_name
        FROM users u
        LEFT JOIN team_members tm ON u.id = tm.user_id
        LEFT JOIN teams t ON tm.team_id = t.id
        ORDER BY u.created_at DESC
    """).fetchall()
    conn.close()
    return [dict(r) for r in rows]


@router.delete("/users/{user_id}", status_code=204)
def delete_user(user_id: int, user=Depends(require_admin)):
    conn = get_conn()
    conn.execute("DELETE FROM users WHERE id = ? AND role != 'admin'", (user_id,))
    conn.commit()
    conn.close()
