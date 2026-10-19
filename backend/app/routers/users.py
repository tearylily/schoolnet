import sqlite3

from fastapi import APIRouter, Depends, HTTPException, Response

from ..database import get_db
from ..schemas import UserCreate, UserOut, UserUpdate
from ..security import hash_password, require_role

# Gerenciar usuários: somente administrador
router = APIRouter(prefix="/api/users", tags=["users"])

COLUMNS = "id, name, email, role"


def _get_or_404(db: sqlite3.Connection, user_id: int) -> sqlite3.Row:
    row = db.execute(f"SELECT {COLUMNS} FROM users WHERE id = ?", (user_id,)).fetchone()
    if row is None:
        raise HTTPException(404, "Usuário não encontrado.")
    return row


def _email_taken(db: sqlite3.Connection, email: str, ignore_id: int | None = None) -> bool:
    row = db.execute("SELECT id FROM users WHERE email = ?", (email,)).fetchone()
    return row is not None and row["id"] != ignore_id


def _out(row: sqlite3.Row) -> dict:
    return UserOut(**dict(row)).model_dump()


@router.get("")
def list_users(db: sqlite3.Connection = Depends(get_db), _=Depends(require_role("admin"))):
    rows = db.execute(f"SELECT {COLUMNS} FROM users ORDER BY name COLLATE NOCASE").fetchall()
    return {"data": [_out(r) for r in rows]}


@router.get("/{user_id}")
def get_user(user_id: int, db: sqlite3.Connection = Depends(get_db), _=Depends(require_role("admin"))):
    return {"data": _out(_get_or_404(db, user_id))}


@router.post("", status_code=201)
def create_user(body: UserCreate, db: sqlite3.Connection = Depends(get_db), _=Depends(require_role("admin"))):
    if _email_taken(db, body.email):
        raise HTTPException(409, "Já existe um usuário com este e-mail.")

    cur = db.execute(
        "INSERT INTO users (name, email, role, password_hash) VALUES (?, ?, ?, ?)",
        (body.name, body.email, body.role, hash_password(body.password)),
    )
    db.commit()
    return {"data": _out(_get_or_404(db, cur.lastrowid))}


@router.put("/{user_id}")
def update_user(
    user_id: int,
    body: UserUpdate,
    db: sqlite3.Connection = Depends(get_db),
    me=Depends(require_role("admin")),
):
    _get_or_404(db, user_id)

    if _email_taken(db, body.email, ignore_id=user_id):
        raise HTTPException(409, "Já existe um usuário com este e-mail.")

    if user_id == me["id"] and body.role != "admin":
        raise HTTPException(400, "Você não pode remover o seu próprio perfil de administrador.")

    if body.password:
        db.execute(
            "UPDATE users SET name = ?, email = ?, role = ?, password_hash = ? WHERE id = ?",
            (body.name, body.email, body.role, hash_password(body.password), user_id),
        )
    else:
        db.execute(
            "UPDATE users SET name = ?, email = ?, role = ? WHERE id = ?",
            (body.name, body.email, body.role, user_id),
        )
    db.commit()
    return {"data": _out(_get_or_404(db, user_id))}


@router.delete("/{user_id}", status_code=204)
def delete_user(user_id: int, db: sqlite3.Connection = Depends(get_db), me=Depends(require_role("admin"))):
    _get_or_404(db, user_id)

    if user_id == me["id"]:
        raise HTTPException(400, "Você não pode excluir o seu próprio usuário.")

    db.execute("DELETE FROM users WHERE id = ?", (user_id,))
    db.commit()
    return Response(status_code=204)
