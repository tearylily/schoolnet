import sqlite3

from fastapi import APIRouter, Depends, HTTPException, Response

from ..database import get_db
from ..schemas import EventIn, EventOut
from ..security import get_current_user, require_role

router = APIRouter(prefix="/api/events", tags=["events"])

COLUMNS = "id, title, description, date, start_time, end_time, location, type, audience"


def _out(row: sqlite3.Row) -> dict:
    return EventOut(**dict(row)).model_dump()


def _get_or_404(db: sqlite3.Connection, event_id: int) -> sqlite3.Row:
    row = db.execute(f"SELECT {COLUMNS} FROM events WHERE id = ?", (event_id,)).fetchone()
    if row is None:
        raise HTTPException(404, "Evento não encontrado.")
    return row


def _values(body: EventIn) -> tuple:
    return (
        body.title,
        body.description,
        body.date.isoformat(),
        body.start_time.strftime("%H:%M"),
        body.end_time.strftime("%H:%M") if body.end_time else None,
        body.location,
        body.type,
        body.audience,
    )


# Consultar: qualquer usuário logado
@router.get("")
def list_events(db: sqlite3.Connection = Depends(get_db), _=Depends(get_current_user)):
    rows = db.execute(f"SELECT {COLUMNS} FROM events ORDER BY date, start_time").fetchall()
    return {"data": [_out(r) for r in rows]}


@router.get("/{event_id}")
def get_event(event_id: int, db: sqlite3.Connection = Depends(get_db), _=Depends(get_current_user)):
    return {"data": _out(_get_or_404(db, event_id))}


# Criar / editar / excluir: admin e professor
@router.post("", status_code=201)
def create_event(
    body: EventIn,
    db: sqlite3.Connection = Depends(get_db),
    user=Depends(require_role("admin", "professor")),
):
    cur = db.execute(
        "INSERT INTO events (title, description, date, start_time, end_time, location, type, audience, created_by) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        _values(body) + (user["id"],),
    )
    db.commit()
    return {"data": _out(_get_or_404(db, cur.lastrowid))}


@router.put("/{event_id}")
def update_event(
    event_id: int,
    body: EventIn,
    db: sqlite3.Connection = Depends(get_db),
    _=Depends(require_role("admin", "professor")),
):
    _get_or_404(db, event_id)
    db.execute(
        "UPDATE events SET title = ?, description = ?, date = ?, start_time = ?, end_time = ?, "
        "location = ?, type = ?, audience = ? WHERE id = ?",
        _values(body) + (event_id,),
    )
    db.commit()
    return {"data": _out(_get_or_404(db, event_id))}


@router.delete("/{event_id}", status_code=204)
def delete_event(
    event_id: int,
    db: sqlite3.Connection = Depends(get_db),
    _=Depends(require_role("admin", "professor")),
):
    _get_or_404(db, event_id)
    db.execute("DELETE FROM events WHERE id = ?", (event_id,))
    db.commit()
    return Response(status_code=204)
