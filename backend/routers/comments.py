from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from auth import get_current_user
from db import get_conn

router = APIRouter(tags=["comments"])


class CommentCreate(BaseModel):
    player_id: Optional[int] = None  # None = whole-scene comment
    timestamp: float
    text: str


# ── List comments for a video ─────────────────────────────────────────────────

@router.get("/api/videos/{video_id}/comments")
def list_comments(video_id: str, user=Depends(get_current_user)):
    conn = get_conn()
    rows = conn.execute(
        """SELECT c.id, c.player_id, c.timestamp, c.text, c.created_at,
                  u.username AS author
           FROM comments c JOIN users u ON c.created_by = u.id
           WHERE c.video_id = ?
           ORDER BY c.timestamp ASC""",
        (video_id,),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


# ── Add a comment ─────────────────────────────────────────────────────────────

@router.post("/api/videos/{video_id}/comments", status_code=201)
def add_comment(video_id: str, body: CommentCreate, user=Depends(get_current_user)):
    if not body.text.strip():
        raise HTTPException(400, "Comment text is required")
    if body.timestamp < 0:
        raise HTTPException(400, "Timestamp must be non-negative")

    conn = get_conn()
    exists = conn.execute("SELECT 1 FROM videos WHERE id = ?", (video_id,)).fetchone()
    if not exists:
        conn.close()
        raise HTTPException(404, "Video not found")

    cur = conn.execute(
        """INSERT INTO comments (video_id, player_id, timestamp, text, created_by)
           VALUES (?, ?, ?, ?, ?)""",
        (video_id, body.player_id, body.timestamp, body.text.strip(), user["id"]),
    )
    conn.commit()
    comment_id = cur.lastrowid
    row = conn.execute(
        """SELECT c.id, c.player_id, c.timestamp, c.text, c.created_at, u.username AS author
           FROM comments c JOIN users u ON c.created_by = u.id WHERE c.id = ?""",
        (comment_id,),
    ).fetchone()
    conn.close()
    return dict(row)


# ── Delete a comment ──────────────────────────────────────────────────────────

@router.delete("/api/comments/{comment_id}", status_code=204)
def delete_comment(comment_id: int, user=Depends(get_current_user)):
    conn = get_conn()
    row = conn.execute(
        "SELECT created_by FROM comments WHERE id = ?", (comment_id,)
    ).fetchone()
    if row is None:
        conn.close()
        raise HTTPException(404, "Comment not found")
    if row["created_by"] != user["id"]:
        conn.close()
        raise HTTPException(403, "Cannot delete another user's comment")
    conn.execute("DELETE FROM comments WHERE id = ?", (comment_id,))
    conn.commit()
    conn.close()
