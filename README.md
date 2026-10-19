# SCHOOLNET — Portal Escolar

Sistema web de gerenciamento escolar com **login**, **usuários** (aluno, professor, administrador) e **eventos** da escola.

O projeto tem duas partes:

| Parte | Pasta | Tecnologia | Documentação |
|-------|-------|------------|--------------|
| Back-end (API + banco) | [`backend/`](backend/) | Python, FastAPI, SQLite, JWT | [backend/README.md](backend/README.md) |
| Front-end (telas) | [`frontend/`](frontend/) | HTML, CSS e JavaScript puro | [frontend/README.md](frontend/README.md) |

O contrato detalhado de cada rota (corpo das requisições e respostas) está em [BACKEND.md](BACKEND.md).

---

## Como rodar (resumo)

```bash
cd backend
python -m venv venv
venv\Scripts\activate            # Linux/Mac: source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Depois abra no navegador:

- Neste computador: **http://localhost:8000/**
- De outro computador da mesma rede: **http://IP-DO-SERVIDOR:8000/** (ex.: `http://192.168.31.155:8000/`)

Login inicial: `admin@schoolnet.com` / `admin123` (troque depois).

> Não precisa rodar nada para o front-end: **o próprio back-end entrega as telas**.
> Evite abrir o `index.html` com dois cliques no arquivo — use sempre o endereço `http://...`.

---

## Como as duas partes se conectam

Um único servidor (uvicorn/FastAPI) faz dois trabalhos:

1. **Entrega os arquivos do front-end** (HTML, CSS, JS) em `/app/...`
2. **Responde à API** (`/login`, `/inicio`, `/api/users`, `/api/events`) com JSON

```
                 ┌──────────────────────── Servidor (uvicorn :8000) ────────────────────────┐
                 │                                                                          │
  Navegador ───► │  GET /              → redireciona para /app/index.html                   │
                 │  GET /app/...       → arquivos da pasta frontend/  (StaticFiles)         │
                 │                                                                          │
  (fetch do JS)─►│  POST /login        → confere e-mail/senha, devolve token JWT            │
                 │  GET  /inicio       → valida o token                                     │
                 │  /api/users  ...    → CRUD de usuários (só admin)                        │
                 │  /api/events ...    → CRUD de eventos                                    │
                 │                          │                                               │
                 │                          ▼                                               │
                 │                   backend/schoolnet.db  (SQLite)                         │
                 └──────────────────────────────────────────────────────────────────────────┘
```

Como a página e a API saem **do mesmo endereço** (mesma origem):

- o front descobre sozinho onde está a API (`API_URL = location.origin` em [frontend/api.js](frontend/api.js)) —
  funciona com qualquer IP, porta ou computador, sem editar nada;
- todas as páginas enxergam o mesmo `localStorage`, onde fica o token do login.

### Fluxo do login

```
 index.html / auth.js                         Back-end
 ────────────────────                         ────────
 1. usuário digita e-mail e senha
 2. POST /login  (form-urlencoded) ─────────► confere a senha no SQLite
                                   ◄───────── 200 { access_token, user: {name, role...} }
 3. salva no localStorage:
      token = "eyJ..."
      user  = { name, role, token }
 4. vai para page/inicio.html
```

### Fluxo de toda página protegida (início, usuários, eventos)

```
 page/*.html carrega api.js + session.js
 ───────────────────────────────────────
 1. session.js lê o token do localStorage
      └─ não tem token? ─────────────────────► volta ao login (index.html?saiu=sem-token)
 2. GET /inicio  com header  Authorization: Bearer <token>
      ├─ 200  → mostra nome/perfil do usuário no topo e no menu
      └─ 401  → token inválido/expirado ────► volta ao login (index.html?saiu=token-invalido)
 3. o JS da página (inicio.js, eventos.js...) chama a API com o mesmo header
      └─ qualquer 401 também faz logout
```

O token vale **8 horas**. O botão **Sair** apaga o token e volta ao login.
Quando a sessão é encerrada por um problema, a tela de login mostra o motivo em vermelho.

### Permissões (verificadas no back-end)

| Ação | aluno | professor | admin |
|------|:----:|:--------:|:----:|
| Ver eventos | ✔ | ✔ | ✔ |
| Criar/editar/excluir eventos | ✘ | ✔ | ✔ |
| Gerenciar usuários | ✘ | ✘ | ✔ |

O front esconde botões que o perfil não pode usar, mas quem **bloqueia de verdade** é o back-end (responde 403).

---

## Estrutura do projeto

```
schoolnet/
├── README.md            ← este arquivo (visão geral e conexão)
├── BACKEND.md           ← contrato das rotas da API
├── backend/             ← API FastAPI + banco SQLite
│   ├── README.md
│   ├── requirements.txt
│   ├── schoolnet.db     (criado sozinho)
│   └── app/
└── frontend/            ← telas (HTML/CSS/JS)
    ├── README.md
    ├── index.html       (login)
    ├── api.js, auth.js, session.js, style.css
    └── page/            (início, usuários, eventos)
```

---

## Problemas comuns

| Sintoma | Causa provável | Solução |
|---------|----------------|---------|
| `NetworkError when attempting to fetch resource` / `Failed to fetch` | Servidor desligado, ou página aberta de um endereço diferente do servidor | Confira se o uvicorn está rodando e abra pelo mesmo `http://IP:PORTA/` em que ele está |
| Outro computador não abre a página | Firewall do Windows bloqueando a porta, ou servidor sem `--host 0.0.0.0` | Rode com `--host 0.0.0.0` e libere o Python/porta no firewall (rede **Privada**) |
| Entra e volta para o login | Página aberta direto do arquivo (`file://`) ou arquivos antigos em cache | Abra por `http://IP:PORTA/` e recarregue com **Ctrl+Shift+R**; leia o motivo mostrado na tela de login |
| "Sessão inválida ou expirada" | Token passou de 8 h, ou o `backend/.secret_key` mudou | Faça login de novo |
| Mudei o código Python e nada mudou | Servidor rodando sem `--reload` | Reinicie o uvicorn ou use `--reload` |
