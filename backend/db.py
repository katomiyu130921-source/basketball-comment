import os
import sqlite3
from pathlib import Path

_default_db = Path(__file__).parent / "data" / "db.sqlite"
DB_PATH = Path(os.environ.get("DB_PATH", str(_default_db)))


def get_conn() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(exist_ok=True)
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db():
    conn = get_conn()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS users (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            username      TEXT    UNIQUE NOT NULL,
            password_hash TEXT    NOT NULL,
            created_at    TEXT    DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS videos (
            id            TEXT PRIMARY KEY,
            title         TEXT NOT NULL,
            filename      TEXT NOT NULL,
            fps           REAL,
            width         INTEGER,
            height        INTEGER,
            total_frames  INTEGER,
            has_tracking  INTEGER DEFAULT 0,
            uploaded_by   INTEGER REFERENCES users(id),
            created_at    TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS comments (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            video_id    TEXT    REFERENCES videos(id) ON DELETE CASCADE,
            player_id   INTEGER,
            timestamp   REAL    NOT NULL,
            text        TEXT    NOT NULL,
            created_by  INTEGER REFERENCES users(id),
            created_at  TEXT    DEFAULT (datetime('now'))
        );
    """)
    conn.commit()
    conn.close()
