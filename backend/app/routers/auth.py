import sqlite3

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm

from ..database import get_db
from ..schemas import UserOut
from ..security import create_access_token, get_current_user, verify_password

router = APIRouter(tags=["auth"])


@router.post("/login")
def login(form: OAuth2PasswordRequestForm = Depends(), db: sqlite3.Connection = Depends(get_db)):
    """Recebe form-urlencoded: username (= e-mail) e password."""

    user = db.execute(
        "SELECT id, name, email, role, password_hash FROM users WHERE email = ?",
        (form.username.strip().lower(),),
    ).fetchone()

    # 400 (e não 401) para o front não confundir com "sessão expirada"
    if user is None or not verify_password(form.password, user["password_hash"]):
        raise HTTPException(400, "E-mail ou senha incorretos.")

    return {
        "access_token": create_access_token(user["id"]),
        "token_type": "bearer",
        "user": UserOut(**{k: user[k] for k in ("id", "name", "email", "role")}).model_dump(),
    }


@router.get("/inicio")
def inicio(user: sqlite3.Row = Depends(get_current_user)):
    """Usada pelo front para validar o token em toda página protegida."""
    return {"data": {k: user[k] for k in ("id", "name", "email", "role")}}
