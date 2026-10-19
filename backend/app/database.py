"""SQLite: conexão por requisição, criação das tabelas e dados iniciais."""

import os
import sqlite3
from pathlib import Path

from .security import hash_password

DB_PATH = os.getenv("DATABASE_PATH", str(Path(__file__).resolve().parent.parent / "schoolnet.db"))

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT NOT NULL,
    email         TEXT NOT NULL UNIQUE,
    role          TEXT NOT NULL CHECK (role IN ('aluno', 'professor', 'admin')),
    password_hash TEXT NOT NULL,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS events (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    title       TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    date        TEXT NOT NULL,                -- AAAA-MM-DD
    start_time  TEXT NOT NULL,                -- HH:MM
    end_time    TEXT,                         -- HH:MM ou NULL
    location    TEXT NOT NULL,
    type        TEXT NOT NULL CHECK (type IN ('academico', 'esportivo', 'cultural', 'reuniao', 'comemorativo')),
    audience    TEXT NOT NULL CHECK (audience IN ('alunos', 'professores', 'responsaveis', 'todos')),
    created_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_events_date ON events(date, start_time);
"""


def connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def get_db():
    """Dependência do FastAPI: abre a conexão e fecha no fim da requisição."""
    conn = connect()
    try:
        yield conn
    finally:
        conn.close()


def init_db() -> None:
    conn = connect()
    try:
        conn.executescript(SCHEMA)

        # Primeiro acesso: cria um administrador para conseguir entrar
        if conn.execute("SELECT COUNT(*) FROM users").fetchone()[0] == 0:
            admin_email = os.getenv("ADMIN_EMAIL", "admin@schoolnet.com")
            admin_password = os.getenv("ADMIN_PASSWORD", "admin123")

            conn.execute(
                "INSERT INTO users (name, email, role, password_hash) VALUES (?, ?, ?, ?)",
                ("Administrador", admin_email.lower(), "admin", hash_password(admin_password)),
            )
            print(f"[schoolnet] Admin criado: {admin_email} / {admin_password}  (troque a senha!)")

        conn.commit()
    finally:
        conn.close()
