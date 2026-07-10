import sqlite3
import os
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "users.db"


def get_connection():
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    return connection


def init_db():
    with get_connection() as connection:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                full_name TEXT NOT NULL,
                email TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'user',
                is_active INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        existing_columns = {
            row["name"]
            for row in connection.execute("PRAGMA table_info(users)").fetchall()
        }
        if "auth_provider" not in existing_columns:
            connection.execute(
                "ALTER TABLE users ADD COLUMN auth_provider TEXT NOT NULL DEFAULT 'password'"
            )
        if "google_sub" not in existing_columns:
            connection.execute("ALTER TABLE users ADD COLUMN google_sub TEXT")
        if "email_verified" not in existing_columns:
            connection.execute("ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0")
        connection.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_users_email
            ON users (email)
            """
        )
        connection.execute(
            """
            CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_sub
            ON users (google_sub)
            WHERE google_sub IS NOT NULL
            """
        )
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS password_reset_otps (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                otp_hash TEXT NOT NULL,
                expires_at TEXT NOT NULL,
                used_at TEXT,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
            """
        )
        connection.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_password_reset_otps_user_active
            ON password_reset_otps (user_id, used_at, expires_at)
            """
        )
        seed_admin_user(connection)
        connection.commit()


def seed_admin_user(connection):
    admin_email = os.getenv("ADMIN_EMAIL", "").strip().lower()
    admin_password = os.getenv("ADMIN_PASSWORD", "")
    admin_name = os.getenv("ADMIN_FULL_NAME", "Dashboard Admin").strip() or "Dashboard Admin"

    if not admin_email or not admin_password:
        return

    from security import hash_password

    existing_user = connection.execute(
        "SELECT id FROM users WHERE email = ?",
        (admin_email,),
    ).fetchone()

    password_hash = hash_password(admin_password)
    if existing_user:
        connection.execute(
            """
            UPDATE users
            SET full_name = ?,
                password_hash = ?,
                role = 'admin',
                is_active = 1,
                auth_provider = CASE
                    WHEN auth_provider = 'google' THEN 'password_google'
                    ELSE auth_provider
                END,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            """,
            (admin_name, password_hash, existing_user["id"]),
        )
        return

    connection.execute(
        """
        INSERT INTO users (full_name, email, password_hash, role, is_active)
        VALUES (?, ?, ?, 'admin', 1)
        """,
        (admin_name, admin_email, password_hash),
    )
