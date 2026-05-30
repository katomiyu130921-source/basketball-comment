from sqlite3 import IntegrityError
from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel
from db import get_conn
from auth import hash_password, verify_password, create_token, get_current_user

router = APIRouter(prefix="/api/auth", tags=["auth"])


class AuthRequest(BaseModel):
    username: str
    password: str


@router.post("/register", status_code=201)
def register(body: AuthRequest):
    if len(body.username) < 2 or len(body.password) < 6:
        raise HTTPException(400, "Username ≥ 2 chars, password ≥ 6 chars")

    conn = get_conn()
    try:
        conn.execute(
            "INSERT INTO users (username, password_hash) VALUES (?, ?)",
            (body.username, hash_password(body.password)),
        )
        conn.commit()
        user_id = conn.execute(
            "SELECT id FROM users WHERE username = ?", (body.username,)
        ).fetchone()["id"]
    except IntegrityError:
        raise HTTPException(409, "Username already taken")
    finally:
        conn.close()

    return {"token": create_token(user_id), "username": body.username}


@router.post("/login")
def login(body: AuthRequest):
    conn = get_conn()
    row = conn.execute(
        "SELECT id, password_hash FROM users WHERE username = ?", (body.username,)
    ).fetchone()
    conn.close()

    if row is None or not verify_password(body.password, row["password_hash"]):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid credentials")

    return {"token": create_token(row["id"]), "username": body.username}


@router.get("/me")
def me(user=Depends(get_current_user)):
    return user
