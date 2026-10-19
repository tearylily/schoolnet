/* =========================================================
   SCHOOLNET - CONEXÃO COM A API
   Rotas e dados do servidor ficam só aqui. Se alguma rota
   ou nome de campo for diferente no seu back-end, altere
   apenas este arquivo.
========================================================= */

// Site aberto pela própria API (http://IP:PORTA/): usa o mesmo endereço,
// então funciona em qualquer IP, porta ou computador. O endereço fixo
// abaixo só é usado se o index.html for aberto direto do disco.
const API_URL = location.protocol.startsWith("http")
    ? location.origin
    : "http://192.168.31.155:8000";

const API_ROUTES = {
    login: "/login",
    session: "/inicio",            // GET protegido: valida o token (usado em session.js)
    users: "/api/users",           // GET, POST  |  GET/PUT/DELETE /api/users/:id
    events: "/api/events"          // GET, POST  |  GET/PUT/DELETE /api/events/:id
};

/* Perfis: a chave é o valor interno; o texto é o que aparece na tela */
const PERFIS = {
    aluno: "Aluno",
    professor: "Professor",
    admin: "Administrador"
};

/* Tipos de evento */
const TIPOS_EVENTO = {
    academico: { rotulo: "Acadêmico", icone: "🔬" },
    esportivo: { rotulo: "Esportivo", icone: "⚽" },
    cultural: { rotulo: "Cultural", icone: "🎭" },
    reuniao: { rotulo: "Reunião", icone: "👥" },
    comemorativo: { rotulo: "Comemorativo", icone: "🎁" }
};

/* Público-alvo do evento */
const PUBLICOS_EVENTO = {
    alunos: "Alunos",
    professores: "Professores",
    responsaveis: "Responsáveis",
    todos: "Toda a escola"
};

const MESES = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];


/* ---------------------------------------------------------
   UTILITÁRIOS
--------------------------------------------------------- */

function getStoredUser() {
    try {
        return JSON.parse(localStorage.getItem("user"));
    } catch (error) {
        return null;
    }
}

function escapeHtml(valor) {
    return String(valor ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}


/* ---------------------------------------------------------
   REQUISIÇÃO BASE
--------------------------------------------------------- */

async function apiRequest(endpoint, options = {}) {

    const headers = {
        ...(options.headers || {})
    };

    // Corpo JSON precisa do Content-Type (o login usa form-urlencoded)
    if (options.body && !headers["Content-Type"]) {
        headers["Content-Type"] = "application/json";
    }

    const stored = getStoredUser();
    const token = stored?.token || localStorage.getItem("token");

    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        headers
    });

    let data;

    try {
        data = await response.json();
    } catch (error) {
        data = null;
    }

    if (response.status === 401 && token && typeof logout === "function") {
        logout("token-invalido");
        return;
    }

    if (!response.ok) {
        const detalhe = data?.detail;
        const mensagem = Array.isArray(detalhe)
            ? detalhe.map(d => d.msg).join(" | ")   // erros de validação do FastAPI
            : detalhe;

        throw new Error(mensagem || data?.message || "Erro ao conectar com o servidor.");
    }

    return data;
}

// Aceita {data: [...]} , {data: {users: [...]}} ou a lista direta
function extrairLista(res, chave) {
    const data = res?.data ?? res;

    if (Array.isArray(data)) {
        return data;
    }

    return data?.[chave] || data?.items || [];
}


/* ---------------------------------------------------------
   AUTENTICAÇÃO
--------------------------------------------------------- */

async function login(username, password) {
    const body = new URLSearchParams();
    body.append("username", username);
    body.append("password", password);

    return await apiRequest(API_ROUTES.login, {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded"
        },
        body: body
    });
}


/* ---------------------------------------------------------
   USUÁRIOS
--------------------------------------------------------- */

// Padroniza o usuário vindo da API (aceita nomes em inglês ou português)
function normalizarUsuario(u) {
    return {
        id: u.id ?? u._id,
        nome: u.name ?? u.nome ?? "",
        email: u.email ?? "",
        perfil: u.role ?? u.perfil ?? u.profile ?? ""
    };
}

function nomeDoPerfil(perfil) {
    return PERFIS[String(perfil).toLowerCase()] || perfil || "-";
}

// Monta o corpo enviado ao back-end (ajuste os nomes se o seu for diferente)
function montarPayloadUsuario({ nome, email, senha, perfil }) {
    const payload = { name: nome, email, role: perfil };

    if (senha) {
        payload.password = senha;
    }

    return payload;
}


async function listarUsuarios() {
    const res = await apiRequest(API_ROUTES.users);
    return extrairLista(res, "users").map(normalizarUsuario);
}

async function buscarUsuario(id) {
    const res = await apiRequest(`${API_ROUTES.users}/${encodeURIComponent(id)}`);
    return normalizarUsuario(res.data ?? res);
}

async function criarUsuario(dados) {
    return await apiRequest(API_ROUTES.users, {
        method: "POST",
        body: JSON.stringify(montarPayloadUsuario(dados))
    });
}

async function atualizarUsuario(id, dados) {
    return await apiRequest(`${API_ROUTES.users}/${encodeURIComponent(id)}`, {
        method: "PUT",
        body: JSON.stringify(montarPayloadUsuario(dados))
    });
}

async function excluirUsuario(id) {
    return await apiRequest(`${API_ROUTES.users}/${encodeURIComponent(id)}`, {
        method: "DELETE"
    });
}


/* ---------------------------------------------------------
   EVENTOS
--------------------------------------------------------- */

// Padroniza o evento vindo da API (aceita nomes em inglês ou português)
function normalizarEvento(e) {
    return {
        id: e.id ?? e._id,
        titulo: e.title ?? e.titulo ?? e.nome ?? "",
        descricao: e.description ?? e.descricao ?? "",
        data: String(e.date ?? e.data ?? "").slice(0, 10),            // AAAA-MM-DD
        inicio: String(e.start_time ?? e.hora_inicio ?? e.hora ?? "").slice(0, 5),   // HH:MM
        fim: String(e.end_time ?? e.hora_fim ?? "").slice(0, 5),
        local: e.location ?? e.local ?? "",
        tipo: String(e.type ?? e.tipo ?? "").toLowerCase(),
        publico: String(e.audience ?? e.publico ?? "").toLowerCase()
    };
}

// Monta o corpo enviado ao back-end (ajuste os nomes se o seu for diferente)
function montarPayloadEvento({ titulo, descricao, data, inicio, fim, local, tipo, publico }) {
    return {
        title: titulo,
        description: descricao || "",
        date: data,
        start_time: inicio,
        end_time: fim || null,
        location: local,
        type: tipo,
        audience: publico
    };
}

async function listarEventos() {
    const res = await apiRequest(API_ROUTES.events);
    return extrairLista(res, "events").map(normalizarEvento);
}

async function buscarEvento(id) {
    const res = await apiRequest(`${API_ROUTES.events}/${encodeURIComponent(id)}`);
    return normalizarEvento(res.data ?? res);
}

async function criarEvento(dados) {
    return await apiRequest(API_ROUTES.events, {
        method: "POST",
        body: JSON.stringify(montarPayloadEvento(dados))
    });
}

async function atualizarEvento(id, dados) {
    return await apiRequest(`${API_ROUTES.events}/${encodeURIComponent(id)}`, {
        method: "PUT",
        body: JSON.stringify(montarPayloadEvento(dados))
    });
}

async function excluirEvento(id) {
    return await apiRequest(`${API_ROUTES.events}/${encodeURIComponent(id)}`, {
        method: "DELETE"
    });
}
