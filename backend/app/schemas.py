"""Modelos de entrada (validação) e saída. Nomes de campo = contrato do BACKEND.md."""

import re
from datetime import date as Date
from datetime import time as Time
from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator, model_validator

Role = Literal["aluno", "professor", "admin"]
EventType = Literal["academico", "esportivo", "cultural", "reuniao", "comemorativo"]
Audience = Literal["alunos", "professores", "responsaveis", "todos"]

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


# ---------------------------------------------------------
# Usuários
# ---------------------------------------------------------

class UserBase(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: str
    role: Role

    @field_validator("name")
    @classmethod
    def clean_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Informe o nome.")
        return v

    @field_validator("email")
    @classmethod
    def clean_email(cls, v: str) -> str:
        v = v.strip().lower()
        if not EMAIL_RE.match(v):
            raise ValueError("E-mail inválido.")
        return v


class UserCreate(UserBase):
    password: str = Field(min_length=6, max_length=128)


class UserUpdate(UserBase):
    # Só envie para trocar a senha; se vier vazia/ausente, mantém a atual
    password: Optional[str] = Field(default=None, max_length=128)

    @field_validator("password")
    @classmethod
    def check_password(cls, v: Optional[str]) -> Optional[str]:
        if v is None or v == "":
            return None
        if len(v) < 6:
            raise ValueError("A senha deve ter pelo menos 6 caracteres.")
        return v


class UserOut(BaseModel):
    id: int
    name: str
    email: str
    role: Role


# ---------------------------------------------------------
# Eventos
# ---------------------------------------------------------

class EventIn(BaseModel):
    title: str = Field(min_length=1, max_length=150)
    description: str = Field(default="", max_length=2000)
    date: Date
    start_time: Time
    end_time: Optional[Time] = None
    location: str = Field(min_length=1, max_length=150)
    type: EventType
    audience: Audience

    @field_validator("title", "location")
    @classmethod
    def not_blank(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Campo obrigatório.")
        return v

    @field_validator("description", mode="before")
    @classmethod
    def description_default(cls, v):
        return (v or "").strip()

    @field_validator("end_time", mode="before")
    @classmethod
    def empty_end_time(cls, v):
        return None if v in ("", None) else v

    @model_validator(mode="after")
    def check_times(self):
        if self.end_time and self.end_time <= self.start_time:
            raise ValueError("O término deve ser depois do início.")
        return self


class EventOut(BaseModel):
    id: int
    title: str
    description: str
    date: str
    start_time: str
    end_time: Optional[str]
    location: str
    type: EventType
    audience: Audience
