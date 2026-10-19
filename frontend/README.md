# Schoolnet — Front-end (HTML + CSS + JavaScript)

São as telas do Schoolnet, feitas em HTML, CSS e JavaScript puro, sem framework e sem etapa de build.
Todos os dados vêm da API do [back-end](../backend/README.md). Para o fluxo completo entre
as duas partes, veja o [README principal](../README.md).

---

## Como abrir

O próprio back-end entrega estes arquivos. Com o servidor rodando, acesse:

- **http://localhost:8000/** (neste computador)
- **http://IP-DO-SERVIDOR:8000/** (de outro computador da rede)

> Não abra o `index.html` com dois cliques (`file://`). Alguns navegadores separam o
> armazenamento de cada arquivo, e o login "some" ao trocar de página.
> Se mudou algum `.js` e a tela não atualizou, recarregue com **Ctrl+Shift+R**.

---

## Estrutura

```
frontend/
├── index.html            # tela de login
├── auth.js               # lógica da tela de login
├── api.js                # TODA a comunicação com o back-end
├── session.js            # proteção das páginas internas + logout
├── style.css             # CSS único de todo o sistema
└── page/
    ├── inicio.html       # painel inicial
    ├── inicio.js
    ├── usuarios/
    │   ├── usuarios.html # lista de usuários
    │   ├── usuarios.js
    │   ├── cadastro.html # criar / editar usuário
    │   └── cadastro.js
    └── eventos/
        ├── eventos.html  # lista + cadastro de eventos (modal)
        └── eventos.js
```

### Ordem dos scripts

Toda página carrega os scripts nesta ordem, porque cada um usa o que o anterior definiu:

| Página | Scripts |
|--------|---------|
| Login (`index.html`) | `api.js` → `auth.js` |
| Páginas internas (`page/...`) | `api.js` → `session.js` → script da página |

---

## Parte por parte

### `api.js` — conexão com o back-end

**É o único arquivo que conhece as rotas da API.** Se uma rota ou um nome de campo mudar no back-end, só ele precisa ser alterado.

- **`API_URL`**: endereço da API. Quando o site é aberto por `http://...`, usa o próprio endereço da página
  (`location.origin`), então funciona em qualquer IP e porta. O endereço fixo só é usado se o arquivo for aberto do disco.
- **`API_ROUTES`**: caminhos das rotas (`/login`, `/inicio`, `/api/users`, `/api/events`).
- **Listas de opções** que aparecem nas telas: `PERFIS`, `TIPOS_EVENTO` (com ícone), `PUBLICOS_EVENTO`, `MESES`.
- **`apiRequest(endpoint, options)`**: função base que todas as chamadas usam. Ela:
  1. coloca `Content-Type: application/json` quando há corpo;
  2. coloca o token no header `Authorization: Bearer ...`;
  3. se a resposta for **401**, faz logout;
  4. se der erro, lança um `Error` com o `detail` da API, que as telas mostram para o usuário.
- **Funções prontas** que as páginas chamam:

  | Login | Usuários | Eventos |
  |-------|----------|---------|
  | `login(email, senha)` | `listarUsuarios()` | `listarEventos()` |
  | | `buscarUsuario(id)` | `buscarEvento(id)` |
  | | `criarUsuario(dados)` | `criarEvento(dados)` |
  | | `atualizarUsuario(id, dados)` | `atualizarEvento(id, dados)` |
  | | `excluirUsuario(id)` | `excluirEvento(id)` |

- **Tradução de campos**: a API usa nomes em inglês (`name`, `role`, `start_time`...) e as telas usam português
  (`nome`, `perfil`, `inicio`...).
  - `normalizarUsuario` / `normalizarEvento`: convertem o que **chega** da API.
  - `montarPayloadUsuario` / `montarPayloadEvento`: montam o que é **enviado** para a API.
- **Utilitários**: `getStoredUser()` lê o usuário salvo. `escapeHtml()` protege o HTML contra textos maliciosos (XSS).

### `index.html` + `auth.js` — tela de login

1. Ao abrir a página, `redirecionarSeLogado()` verifica se já existe um login válido. Se existir, vai direto para o início.
2. Se a página foi aberta por um logout (`index.html?saiu=motivo`), apaga o login salvo e mostra o motivo em vermelho
   (`sem-token`, `sem-usuario`, `token-invalido`). Isso também evita um vai-e-volta infinito entre login e início.
3. No envio do formulário:
   - confere se e-mail e senha foram preenchidos;
   - chama `login()` (`POST /login`);
   - salva no `localStorage` o `token` e o `user` (nome, perfil e token);
   - vai para `page/inicio.html`.
4. Em caso de erro (senha errada, servidor fora do ar), mostra a mensagem acima do formulário.

### `session.js` — proteção das páginas internas

Roda em **toda** página dentro de `page/`:

1. **`verificarAutenticacao()`**: se não houver token, faz logout. Se houver, chama `GET /inicio`. Se a resposta for 401, faz logout.
2. **`initSession()`**: preenche os dados do usuário nos elementos marcados no HTML:

   | Atributo no HTML | Recebe |
   |------------------|--------|
   | `data-user-name` | nome completo |
   | `data-user-first-name` | primeiro nome ("Olá, João!") |
   | `data-user-role` | perfil ("Administrador") |
   | `data-logout` | vira botão de **Sair** |

3. **`logout(motivo)`**: apaga `token` e `user` do `localStorage` e volta ao login com `?saiu=motivo`.

### `page/inicio.html` + `inicio.js` — painel inicial

- Saudação com o nome do usuário, menu lateral e cartões de atalho (Horários, Atividades, Conteúdos, Avisos, Eventos).
- `inicio.js` busca os eventos e mostra os **3 próximos** (de hoje em diante), em ordem de data e hora.

### `page/usuarios/usuarios.html` + `usuarios.js` — lista de usuários (admin)

- Mostra a tabela com nome, e-mail e perfil.
- Busca enquanto digita, por nome, e-mail ou perfil. O filtro é feito no navegador.
- Botões **Editar** (abre `cadastro.html?id=...`) e **Excluir** (pede confirmação).

### `page/usuarios/cadastro.html` + `cadastro.js` — criar/editar usuário

- Sem `?id=`: modo **novo usuário**, com a senha obrigatória.
- Com `?id=123`: modo **edição**. Carrega os dados com `buscarUsuario()`. Se a senha ficar em branco, a atual é mantida.
- Ao salvar, chama `criarUsuario()` ou `atualizarUsuario()` e volta para a lista.

### `page/eventos/eventos.html` + `eventos.js` — eventos

- Mostra os eventos em cartões, com ícone do tipo, data, horário, local e público.
- **Filtros** feitos no navegador: busca por texto, tipo, público e mês.
- **Modal** para criar e editar (título, descrição, data, início, término, local, tipo, público).
- **Permissão**: para o perfil `aluno`, o botão "Novo evento" e as ações de editar/excluir ficam escondidos.
  O back-end também bloqueia essas ações (403).

### `style.css` — visual

Um único CSS para todo o sistema, organizado em seções comentadas: login, formulários, botões,
menu lateral, painel, cartões, tabelas, modal, mensagens e a classe `.hidden`.

---

## O que fica salvo no navegador (`localStorage`)

| Chave | Conteúdo |
|-------|----------|
| `token` | token JWT recebido no login |
| `user` | `{ "username", "token", "name", "role" }` |

Os dois são apagados no logout.

---

## Como adicionar uma página nova

1. Crie `page/minhapagina/minhapagina.html` copiando o menu lateral de uma página existente.
2. No fim do `<body>`, carregue `../../api.js`, depois `../../session.js` e depois o seu script.
3. Se precisar de uma rota nova, adicione-a em `API_ROUTES` e crie a função em `api.js`.
4. Adicione o link no menu lateral das outras páginas.
