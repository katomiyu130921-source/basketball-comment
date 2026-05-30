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
    invite_code: Optional[str] = None


class LoginRequest(BaseModel):
    username: str
    password: str


@router.post("/register", status_code=201)
def register(body: RegisterRequest):
    if len(body.username) < 2 or len(body.password) < 6:
        raise HTTPException(400, "ユーザー名は2文字以上、パスワードは6文字以上")

    conn = get_conn()

    # 1人目のユーザーは管理者
    user_count = conn.execute("SELECT COUNT(*) as c FROM users").fetchone()["c"]
    role = "admin" if user_count == 0 else "member"

    # メンバーは招待コード必須
    team_id = None
    if role == "member":
        if not body.invite_code:
            conn.close()
            raise HTTPException(400, "招待コードを入力してください")
        team = conn.execute(
            "SELECT id FROM teams WHERE invite_code = ?", (body.invite_code,)
        ).fetchone()
        if not team:
            conn.close()
            raise HTTPException(400, "招待コードが無効です")
        team_id = team["id"]

    try:
        conn.execute(
            "INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)",
            (body.username, hash_password(body.password), role),
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
