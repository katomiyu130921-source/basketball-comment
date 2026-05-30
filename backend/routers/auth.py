from sqlite3 import IntegrityError
from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel
from typing import Optional
from db import get_conn
from auth import hash_password, verify_password, create_token, get_current_user

router = APIRouter(prefix="/api/auth", tags=["auth"])


class RegisterRequest(BaseModel):
    username: str
    password: str
    invite_code: Optional[str] = None   # team invite_code for member
    admin_code: Optional[str] = None    # org admin_code for org_admin


class LoginRequest(BaseModel):
    username: str
    password: str


@router.post("/register", status_code=201)
def register(body: RegisterRequest):
    if len(body.username) < 2 or len(body.password) < 6:
        raise HTTPException(400, "ユーザー名は2文字以上、パスワードは6文字以上")

    conn = get_conn()

    # 1人目のユーザーは super_admin
    user_count = conn.execute("SELECT COUNT(*) as c FROM users").fetchone()["c"]
    if user_count == 0:
        role = "super_admin"
        org_id = None
        team_id = None
    elif body.admin_code:
        # org admin_code → org_admin
        org = conn.execute(
            "SELECT id FROM organizations WHERE admin_code = ?", (body.admin_code,)
        ).fetchone()
        if not org:
            conn.close()
            raise HTTPException(400, "管理者コードが無効です")
        role = "org_admin"
        org_id = org["id"]
        team_id = None
    elif body.invite_code:
        # team invite_code → member
        team = conn.execute(
            "SELECT id, org_id FROM teams WHERE invite_code = ?", (body.invite_code,)
        ).fetchone()
        if not team:
            conn.close()
            raise HTTPException(400, "招待コードが無効です")
        role = "member"
        org_id = team["org_id"]
        team_id = team["id"]
    else:
        conn.close()
        raise HTTPException(400, "招待コードまたは管理者コードを入力してください")

    try:
        conn.execute(
            "INSERT INTO users (username, password_hash, role, org_id) VALUES (?, ?, ?, ?)",
            (body.username, hash_password(body.password), role, org_id),
        )
        conn.commit()
        user_id = conn.execute(
            "SELECT id FROM users WHERE username = ?", (body.username,)
        ).fetchone()["id"]

        if team_id:
            conn.execute(
                "INSERT INTO team_members (team_id, user_id) VALUES (?, ?)",
                (team_id, user_id),
            )
            conn.commit()
    except IntegrityError:
        raise HTTPException(409, "このユーザー名は既に使われています")
    finally:
        conn.close()

    return {"token": create_token(user_id), "username": body.username, "role": role}


@router.post("/login")
def login(body: LoginRequest):
    conn = get_conn()
    row = conn.execute(
        "SELECT id, password_hash, role FROM users WHERE username = ?", (body.username,)
    ).fetchone()
    conn.close()

    if row is None or not verify_password(body.password, row["password_hash"]):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "ユーザー名またはパスワードが違います")

    return {
        "token":    create_token(row["id"]),
        "username": body.username,
        "role":     row["role"],
    }


@router.get("/me")
def me(user=Depends(get_current_user)):
    return user


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


@router.put("/password")
def change_password(body: ChangePasswordRequest, user=Depends(get_current_user)):
    if len(body.new_password) < 6:
        raise HTTPException(400, "新しいパスワードは6文字以上")

    conn = get_conn()
    row = conn.execute(
        "SELECT password_hash FROM users WHERE id = ?", (user["id"],)
    ).fetchone()

    if not verify_password(body.current_password, row["password_hash"]):
        conn.close()
        raise HTTPException(400, "現在のパスワードが違います")

    conn.execute(
        "UPDATE users SET password_hash = ? WHERE id = ?",
        (hash_password(body.new_password), user["id"]),
    )
    conn.commit()
    conn.close()
    return {"ok": True}
