import secrets
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from db import get_conn
from auth import get_current_user

router = APIRouter(prefix="/api/super-admin", tags=["super_admin"])


def require_super_admin(user=Depends(get_current_user)):
    if user.get("role") != "super_admin":
        raise HTTPException(403, "スーパー管理者専用です")
    return user


class OrgCreate(BaseModel):
    name: str

class TeamCreate(BaseModel):
    name: str


# ── 組織 ──────────────────────────────────────────────────────────────────────

@router.post("/orgs", status_code=201)
def create_org(body: OrgCreate, user=Depends(require_super_admin)):
    if not body.name.strip():
        raise HTTPException(400, "組織名を入力してください")
    admin_code = secrets.token_urlsafe(10)
    conn = get_conn()
    conn.execute(
        "INSERT INTO organizations (name, admin_code) VALUES (?, ?)",
        (body.name.strip(), admin_code),
    )
    conn.commit()
    org_id = conn.execute(
        "SELECT id FROM organizations WHERE admin_code = ?", (admin_code,)
    ).fetchone()["id"]
    conn.close()
    return {"id": org_id, "name": body.name.strip(), "admin_code": admin_code}


@router.get("/orgs")
def list_orgs(user=Depends(require_super_admin)):
    conn = get_conn()
    rows = conn.execute("""
        SELECT o.id, o.name, o.admin_code, o.created_at,
               COUNT(DISTINCT u.id)  AS user_count,
               COUNT(DISTINCT t.id)  AS team_count
        FROM organizations o
        LEFT JOIN users u ON u.org_id = o.id
        LEFT JOIN teams t ON t.org_id = o.id
        GROUP BY o.id
        ORDER BY o.created_at DESC
    """).fetchall()
    conn.close()
    return [dict(r) for r in rows]


@router.get("/orgs/{org_id}")
def get_org(org_id: int, user=Depends(require_super_admin)):
    conn = get_conn()
    org = conn.execute("SELECT * FROM organizations WHERE id = ?", (org_id,)).fetchone()
    if not org:
        conn.close()
        raise HTTPException(404, "組織が見つかりません")
    teams = conn.execute("""
        SELECT t.id, t.name, t.invite_code,
               COUNT(tm.user_id) AS member_count
        FROM teams t
        LEFT JOIN team_members tm ON t.id = tm.team_id
        WHERE t.org_id = ?
        GROUP BY t.id
        ORDER BY t.created_at DESC
    """, (org_id,)).fetchall()
    users = conn.execute("""
        SELECT id, username, role, created_at FROM users WHERE org_id = ?
        ORDER BY created_at DESC
    """, (org_id,)).fetchall()
    conn.close()
    return {
        **dict(org),
        "teams": [dict(t) for t in teams],
        "users": [dict(u) for u in users],
    }


@router.delete("/orgs/{org_id}", status_code=204)
def delete_org(org_id: int, user=Depends(require_super_admin)):
    conn = get_conn()
    conn.execute("DELETE FROM organizations WHERE id = ?", (org_id,))
    conn.commit()
    conn.close()


# ── 組織内チーム管理 ───────────────────────────────────────────────────────────

@router.post("/orgs/{org_id}/teams", status_code=201)
def create_team(org_id: int, body: TeamCreate, user=Depends(require_super_admin)):
    if not body.name.strip():
        raise HTTPException(400, "チーム名を入力してください")
    conn = get_conn()
    org = conn.execute("SELECT id FROM organizations WHERE id = ?", (org_id,)).fetchone()
    if not org:
        conn.close()
        raise HTTPException(404, "組織が見つかりません")
    code = secrets.token_urlsafe(8)
    conn.execute(
        "INSERT INTO teams (name, invite_code, org_id) VALUES (?, ?, ?)",
        (body.name.strip(), code, org_id),
    )
    conn.commit()
    team_id = conn.execute("SELECT id FROM teams WHERE invite_code = ?", (code,)).fetchone()["id"]
    conn.close()
    return {"id": team_id, "name": body.name.strip(), "invite_code": code}


@router.delete("/orgs/{org_id}/teams/{team_id}", status_code=204)
def delete_team(org_id: int, team_id: int, user=Depends(require_super_admin)):
    conn = get_conn()
    conn.execute("DELETE FROM teams WHERE id = ? AND org_id = ?", (team_id, org_id))
    conn.commit()
    conn.close()
