# SCHOOLNET — Contrato da API (o que o back-end precisa ter)

O front chama `API_URL` (definida em `frontend/api.js`): quando o site é aberto pelo servidor
(`http://IP:PORTA/`), é o próprio endereço da página, então site e API ficam na mesma origem.
Todas as rotas, exceto `/login`, exigem o header:

```
Authorization: Bearer <access_token>
```

Se qualquer rota responder **401**, o front faz logout e volta para a tela de login.

Erros: responda com status 4xx/5xx e `{"detail": "mensagem"}` (padrão do FastAPI).
O front mostra o texto de `detail` na tela. Erros de validação do FastAPI (lista de `{msg}`) também funcionam.

---

## Resumo das rotas

| Método | Rota               | Para quê                         |
|--------|--------------------|----------------------------------|
| POST   | `/login`           | Login (form-urlencoded)          |
| GET    | `/inicio`          | Valida o token (usado em toda página protegida) |
| GET    | `/api/users`       | Listar usuários                  |
| POST   | `/api/users`       | Criar usuário                    |
| GET    | `/api/users/{id}`  | Buscar um usuário (tela de edição) |
| PUT    | `/api/users/{id}`  | Atualizar usuário                |
| DELETE | `/api/users/{id}`  | Excluir usuário                  |
| GET    | `/api/events`      | Listar eventos                   |
| POST   | `/api/events`      | Criar evento                     |
| GET    | `/api/events/{id}` | Buscar um evento                 |
| PUT    | `/api/events/{id}` | Atualizar evento                 |
| DELETE | `/api/events/{id}` | Excluir evento                   |

Se quiser outros caminhos, altere só `API_ROUTES` em `frontend/api.js`.

---

## 1. Login — `POST /login`

**Request** — `Content-Type: application/x-www-form-urlencoded` (o padrão `OAuth2PasswordRequestForm` do FastAPI):

```
username=joao@exemplo.com&password=123456
```

**Response 200**

```json
{
  "access_token": "eyJhbGciOi...",
  "token_type": "bearer",
  "user": {
    "id": 1,
    "name": "João Silva",
    "email": "joao@exemplo.com",
    "role": "aluno"
  }
}
```

- `access_token` é obrigatório.
- `user` é **opcional, mas recomendado**: é dele que o topo da página tira o nome e o perfil
  ("Olá, João!", "Aluno"). Sem ele aparece "Usuário" e o e-mail digitado.
- Credenciais erradas → `401` ou `400` com `{"detail": "E-mail ou senha incorretos."}`.

## 2. Validar sessão — `GET /inicio`

Só precisa responder **200** (qualquer corpo) quando o token é válido, e **401** quando é inválido/expirado.

---

## 3. Usuários — `/api/users`

### Objeto usuário (resposta)

```json
{
  "id": 1,
  "name": "João Silva",
  "email": "joao@exemplo.com",
  "role": "aluno"
}
```

`role` ∈ `"aluno"` | `"professor"` | `"admin"`. **Nunca devolva a senha.**

### `GET /api/users` → 200

```json
{
  "data": [
    { "id": 1, "name": "João Silva", "email": "joao@exemplo.com", "role": "aluno" },
    { "id": 2, "name": "Maria Souza", "email": "maria@exemplo.com", "role": "professor" }
  ]
}
```

(O front também aceita `{"data": {"users": [...]}}` ou a lista direta.)

### `GET /api/users/{id}` → 200

```json
{ "data": { "id": 1, "name": "João Silva", "email": "joao@exemplo.com", "role": "aluno" } }
```

### `POST /api/users` — corpo JSON

```json
{
  "name": "João Silva",
  "email": "joao@exemplo.com",
  "role": "aluno",
  "password": "minimo6"
}
```

Resposta: `201` (ou 200) com `{ "data": { ...usuário criado... } }`.
Regras: `name`, `email`, `role` obrigatórios; `password` obrigatório, mínimo 6 caracteres; e-mail único (409/400 se repetir).

### `PUT /api/users/{id}` — corpo JSON

Mesmo corpo do POST, mas **`password` só vem se o usuário digitou uma nova** — se não vier, mantenha a senha atual.

```json
{ "name": "João S. Silva", "email": "joao@exemplo.com", "role": "professor" }
```

Resposta: 200 com `{ "data": { ...usuário atualizado... } }`.

### `DELETE /api/users/{id}` → 200 ou 204 (corpo livre/vazio)

---

## 4. Eventos — `/api/events`

### Objeto evento

```json
{
  "id": 1,
  "title": "Feira de Ciências",
  "description": "Exposição dos projetos científicos desenvolvidos pelos alunos.",
  "date": "2026-10-25",
  "start_time": "08:00",
  "end_time": "12:00",
  "location": "Pátio principal",
  "type": "academico",
  "audience": "alunos"
}
```

| Campo         | Tipo   | Obrigatório | Valores / formato |
|---------------|--------|-------------|-------------------|
| `id`          | int/str| (gerado)    | |
| `title`       | string | sim         | |
| `description` | string | não         | pode ser `""` |
| `date`        | string | sim         | `AAAA-MM-DD` |
| `start_time`  | string | sim         | `HH:MM` (aceito também `HH:MM:SS`) |
| `end_time`    | string | não         | `HH:MM` ou `null`; se informado, deve ser depois de `start_time` |
| `location`    | string | sim         | |
| `type`        | string | sim         | `academico`, `esportivo`, `cultural`, `reuniao`, `comemorativo` |
| `audience`    | string | sim         | `alunos`, `professores`, `responsaveis`, `todos` |

### `GET /api/events` → 200

```json
{
  "data": [
    {
      "id": 1,
      "title": "Feira de Ciências",
      "description": "Exposição dos projetos científicos.",
      "date": "2026-10-25",
      "start_time": "08:00",
      "end_time": "12:00",
      "location": "Pátio principal",
      "type": "academico",
      "audience": "alunos"
    }
  ]
}
```

Pode devolver todos; o front ordena por data e filtra (busca, tipo, público, mês) no navegador.
Se preferir ordenar no servidor, ordene por `date`, depois `start_time`.

### `GET /api/events/{id}` → 200

```json
{ "data": { "id": 1, "title": "Feira de Ciências", "...": "..." } }
```

### `POST /api/events` — corpo JSON (sem `id`)

```json
{
  "title": "Reunião de Pais",
  "description": "Acompanhamento do desempenho escolar.",
  "date": "2026-10-28",
  "start_time": "18:30",
  "end_time": "20:00",
  "location": "Auditório",
  "type": "reuniao",
  "audience": "responsaveis"
}
```

Resposta: `201` (ou 200) com `{ "data": { "id": 7, ...evento criado... } }`.

### `PUT /api/events/{id}` — mesmo corpo do POST (todos os campos)

Resposta: 200 com `{ "data": { ...evento atualizado... } }`.

### `DELETE /api/events/{id}` → 200 ou 204

### Permissões sugeridas

- `GET`: qualquer usuário logado.
- `POST`/`PUT`/`DELETE`: apenas `admin` e `professor` (responda **403** com `{"detail": "Sem permissão."}` para `aluno`).
  O front já esconde os botões para aluno, mas **a validação de verdade tem de ser no servidor**.

---

## 5. CORS (obrigatório, o front roda em outra origem)

Libere a origem onde o front é aberto, os métodos `GET, POST, PUT, DELETE, OPTIONS` e os headers `Authorization` e `Content-Type`.

---

## 6. Exemplo mínimo em FastAPI (eventos)

```python
from datetime import date, time
from typing import Literal, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, model_validator

router = APIRouter(prefix="/api/events", tags=["events"])

class EventIn(BaseModel):
    title: str
    description: str = ""
    date: date
    start_time: time
    end_time: Optional[time] = None
    location: str
    type: Literal["academico", "esportivo", "cultural", "reuniao", "comemorativo"]
    audience: Literal["alunos", "professores", "responsaveis", "todos"]

    @model_validator(mode="after")
    def check_times(self):
        if self.end_time and self.end_time <= self.start_time:
            raise ValueError("end_time deve ser depois de start_time")
        return self

class EventOut(EventIn):
    id: int

# get_current_user / require_role vêm do seu módulo de autenticação (JWT)
@router.get("")
def list_events(user=Depends(get_current_user)):
    return {"data": db_list_events()}                      # lista de EventOut

@router.get("/{event_id}")
def get_event(event_id: int, user=Depends(get_current_user)):
    ev = db_get_event(event_id)
    if not ev:
        raise HTTPException(404, "Evento não encontrado.")
    return {"data": ev}

@router.post("", status_code=201)
def create_event(body: EventIn, user=Depends(require_role("admin", "professor"))):
    return {"data": db_create_event(body)}

@router.put("/{event_id}")
def update_event(event_id: int, body: EventIn, user=Depends(require_role("admin", "professor"))):
    ev = db_update_event(event_id, body)
    if not ev:
        raise HTTPException(404, "Evento não encontrado.")
    return {"data": ev}

@router.delete("/{event_id}", status_code=204)
def delete_event(event_id: int, user=Depends(require_role("admin", "professor"))):
    if not db_delete_event(event_id):
        raise HTTPException(404, "Evento não encontrado.")
```

### Tabela SQL equivalente

```sql
CREATE TABLE events (
    id          SERIAL PRIMARY KEY,
    title       VARCHAR(150) NOT NULL,
    description TEXT         NOT NULL DEFAULT '',
    date        DATE         NOT NULL,
    start_time  TIME         NOT NULL,
    end_time    TIME,
    location    VARCHAR(150) NOT NULL,
    type        VARCHAR(20)  NOT NULL CHECK (type IN ('academico','esportivo','cultural','reuniao','comemorativo')),
    audience    VARCHAR(20)  NOT NULL CHECK (audience IN ('alunos','professores','responsaveis','todos'))
);
```
