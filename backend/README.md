# Schoolnet — Back-end (FastAPI + SQLite)

API do Schoolnet: faz o login (JWT), guarda usuários e eventos num banco SQLite e
**também entrega as telas do front-end**. Para a visão geral e o fluxo completo entre as
duas partes, veja o [README principal](../README.md).

---

## Rodar

```bash
cd backend
python -m venv venv
venv\Scripts\activate            # Linux/Mac: source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

| Endereço | O que é |
|----------|---------|
| http://localhost:8000/ | Site (redireciona para `/app/index.html`) |
| http://IP-DO-SERVIDOR:8000/ | Site acessado de outro computador da rede |
| http://localhost:8000/docs | Documentação interativa: testar as rotas no navegador |

- `--host 0.0.0.0` libera o acesso pela rede (sem ele, só este computador acessa).
- `--reload` reinicia o servidor sozinho quando um `.py` muda.
- A porta pode ser outra (ex.: `--port 8050`); o front se adapta sozinho.
- O banco `schoolnet.db` é criado sozinho na primeira execução.

### Primeiro acesso

Na primeira execução (banco vazio) é criado um administrador:

| E-mail | Senha |
|--------|-------|
| `admin@schoolnet.com` | `admin123` |

Para usar outros dados, defina `ADMIN_EMAIL` e `ADMIN_PASSWORD` **antes** da primeira execução
(ou apague o `schoolnet.db` e rode de novo). Depois, crie professores e alunos pela tela "Novo usuário".

---

## Estrutura

```
backend/
├── requirements.txt     # dependências
├── schoolnet.db         # banco SQLite (criado sozinho)
├── .secret_key          # chave do JWT (criada sozinha — não compartilhe)
└── app/
    ├── main.py          # cria o app, CORS, erros, serve o front-end
    ├── database.py      # conexão SQLite, tabelas, admin inicial
    ├── security.py      # senhas, JWT, quem está logado, permissões
    ├── schemas.py       # validação dos dados que entram e saem
    └── routers/
        ├── auth.py      # /login e /inicio
        ├── users.py     # /api/users
        └── events.py    # /api/events
```

---

## Parte por parte

### `requirements.txt`

| Pacote | Para quê |
|--------|----------|
| `fastapi` | framework da API |
| `uvicorn[standard]` | servidor que roda o FastAPI |
| `PyJWT` | criar e validar o token de login |
| `python-multipart` | ler o formulário do `/login` (form-urlencoded) |

### `app/main.py` — ponto de entrada

É o arquivo que o uvicorn carrega (`app.main:app`). Ele:

1. **Cria o app** e, ao iniciar (`lifespan`), chama `init_db()` para garantir as tabelas.
2. **Configura o CORS**: por padrão libera qualquer origem (`*`). Em produção, use a variável `CORS_ORIGINS`.
3. **Middleware**: manda `Cache-Control: no-store` nos arquivos do front, para o navegador sempre pegar a versão atual dos `.js`.
4. **Trata erros de validação**: transforma os erros do FastAPI numa frase legível,
   `{"detail": "email: E-mail inválido."}`, que o front mostra na tela.
5. **Registra os routers** (`auth`, `users`, `events`).
6. **Serve o front-end**: a pasta `../frontend` fica disponível em `/app/...`,
   e `/` redireciona para `/app/index.html`. Assim site e API têm o mesmo endereço.

> ⚠️ O middleware também grava cada requisição em `backend/requests.log`. Isso foi colocado
> **temporariamente** para diagnosticar o problema do login e pode ser removido.

### `app/database.py` — banco de dados

- `DB_PATH`: caminho do arquivo SQLite (padrão `backend/schoolnet.db`, ou a variável `DATABASE_PATH`).
- `SCHEMA`: cria as tabelas, se ainda não existirem:

  **users**: `id`, `name`, `email` (único), `role` (`aluno`/`professor`/`admin`), `password_hash`, `created_at`

  **events**: `id`, `title`, `description`, `date` (AAAA-MM-DD), `start_time` e `end_time` (HH:MM),
  `location`, `type`, `audience`, `created_by` (usuário que criou), `created_at`

- `connect()`: abre uma conexão. Com `row_factory = sqlite3.Row`, as linhas podem ser lidas por nome (`row["email"]`).
- `get_db()`: dependência do FastAPI. Abre a conexão no começo da requisição e fecha no fim.
- `init_db()`: cria as tabelas e, se não houver nenhum usuário, cria o administrador inicial.

### `app/security.py` — senhas, token e permissões

**Senhas**: nunca são guardadas em texto puro.
- `hash_password()`: gera o hash com PBKDF2-SHA256 (200 000 iterações e um "sal" aleatório).
  Formato salvo: `pbkdf2_sha256$iterações$sal$hash`.
- `verify_password()`: recalcula o hash da senha digitada e compara de forma segura (`hmac.compare_digest`).

**Token JWT**:
- `SECRET_KEY`: vem da variável `SECRET_KEY` ou do arquivo `.secret_key` (gerado sozinho na primeira vez).
  Se essa chave mudar, todos os tokens antigos deixam de valer.
- `create_access_token(user_id)`: cria o token com o id do usuário (`sub`) e a validade (`exp`, padrão 8 horas).

**Dependências** (usadas nas rotas com `Depends(...)`):
- `get_current_user`: lê o header `Authorization: Bearer <token>`, valida o token e busca o usuário no banco.
  Se algo falhar, responde **401** "Sessão inválida ou expirada.".
- `require_role("admin", ...)`: além de exigir login, só deixa passar os perfis informados. Os outros recebem **403** "Sem permissão.".

### `app/schemas.py` — validação

Modelos Pydantic que conferem os dados **antes** de chegar ao banco:

| Modelo | Usado em | Regras principais |
|--------|----------|-------------------|
| `UserCreate` | `POST /api/users` | nome obrigatório, e-mail válido (salvo em minúsculas), perfil válido, senha ≥ 6 |
| `UserUpdate` | `PUT /api/users/{id}` | igual, mas a senha é opcional (vazia = mantém a atual) |
| `UserOut` | respostas | `id`, `name`, `email`, `role` (**nunca** a senha) |
| `EventIn` | `POST`/`PUT /api/events` | título e local obrigatórios, data/hora válidas, término depois do início, tipo e público da lista |
| `EventOut` | respostas | todos os campos do evento + `id` |

### `app/routers/auth.py` — login e sessão

| Rota | O que faz |
|------|-----------|
| `POST /login` | Recebe `username` (o e-mail) e `password` em form-urlencoded. Se estiver certo, devolve `access_token` e `user`. Se estiver errado, responde **400** "E-mail ou senha incorretos." (400 e não 401, para o front não confundir com sessão expirada). |
| `GET /inicio` | Rota protegida que o front chama em toda página para saber se o token ainda vale. Devolve os dados do usuário logado. |

### `app/routers/users.py` — usuários (só **admin**)

| Rota | O que faz |
|------|-----------|
| `GET /api/users` | Lista todos, em ordem de nome |
| `GET /api/users/{id}` | Busca um (usado na tela de edição) |
| `POST /api/users` | Cria. E-mail repetido → **409** |
| `PUT /api/users/{id}` | Atualiza. A senha só muda se vier preenchida |
| `DELETE /api/users/{id}` | Exclui → **204** |

Proteções: o admin não pode excluir a si mesmo nem tirar o próprio perfil de administrador.

### `app/routers/events.py` — eventos

| Rota | Quem pode | O que faz |
|------|-----------|-----------|
| `GET /api/events` | qualquer logado | Lista em ordem de data e hora |
| `GET /api/events/{id}` | qualquer logado | Busca um |
| `POST /api/events` | admin, professor | Cria (guarda quem criou em `created_by`) |
| `PUT /api/events/{id}` | admin, professor | Atualiza |
| `DELETE /api/events/{id}` | admin, professor | Exclui → **204** |

Todas as respostas seguem o formato `{"data": ...}`. Erros vêm como `{"detail": "mensagem"}`.
Exemplos completos de requisição e resposta: [../BACKEND.md](../BACKEND.md).

---

## Variáveis de ambiente (opcionais)

| Variável | Padrão | Para quê |
|----------|--------|----------|
| `SECRET_KEY` | gerada e salva em `.secret_key` | assinatura do JWT |
| `TOKEN_EXPIRE_MINUTES` | `480` (8 h) | validade do login |
| `DATABASE_PATH` | `backend/schoolnet.db` | arquivo SQLite |
| `CORS_ORIGINS` | `*` | origens permitidas, separadas por vírgula |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | `admin@schoolnet.com` / `admin123` | admin inicial |

---

## Testar a API sem o front

Pelo navegador: abra **http://localhost:8000/docs**, clique em **Authorize**, entre com e-mail e senha e teste qualquer rota.

Pelo terminal:

```bash
# login
curl -X POST http://localhost:8000/login -d "username=admin@schoolnet.com&password=admin123"

# usar o token recebido
curl http://localhost:8000/api/events -H "Authorization: Bearer COLE_O_TOKEN_AQUI"
```
