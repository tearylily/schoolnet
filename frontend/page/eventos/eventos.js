/* =========================================================
   SCHOOLNET - EVENTOS
   Lista, filtra, cria, edita e exclui eventos pela API.
   Rotas e campos ficam em api.js
========================================================= */

const eventosGrid = document.getElementById("eventosGrid");
const eventosStatus = document.getElementById("eventosStatus");
const eventoCount = document.getElementById("eventoCount");

const eventoSearch = document.getElementById("eventoSearch");
const tipoFilter = document.getElementById("tipoFilter");
const publicoFilter = document.getElementById("publicoFilter");
const mesFilter = document.getElementById("mesFilter");

const eventoModal = document.getElementById("eventoModal");
const eventoForm = document.getElementById("eventoForm");
const eventoMessage = document.getElementById("eventoMessage");
const saveEvento = document.getElementById("saveEvento");

let eventos = [];
let editandoId = null;


/* ---------------------------------------------------------
   SELECTS (preenchidos a partir do api.js)
--------------------------------------------------------- */

function preencherSelect(select, opcoes) {
    opcoes.forEach(([valor, rotulo]) => {
        const option = document.createElement("option");
        option.value = valor;
        option.textContent = rotulo;
        select.appendChild(option);
    });
}

const listaTipos = Object.entries(TIPOS_EVENTO).map(([k, v]) => [k, v.rotulo]);
const listaPublicos = Object.entries(PUBLICOS_EVENTO);
const listaMeses = MESES.map((nome, i) => [String(i + 1).padStart(2, "0"), nome]);

preencherSelect(tipoFilter, listaTipos);
preencherSelect(publicoFilter, listaPublicos);
preencherSelect(mesFilter, listaMeses);
preencherSelect(eventoForm.tipo, listaTipos);
preencherSelect(eventoForm.publico, listaPublicos);


/* ---------------------------------------------------------
   PERMISSÃO: aluno só consulta (o back-end também deve validar)
--------------------------------------------------------- */

function podeGerenciar() {
    const perfil = String(getStoredUser()?.role || "").toLowerCase();
    return perfil !== "aluno";
}

if (!podeGerenciar()) {
    document.getElementById("openEventoModal").classList.add("hidden");
}


/* ---------------------------------------------------------
   STATUS / FORMATAÇÃO
--------------------------------------------------------- */

function mostrarStatus(texto) {
    eventosStatus.textContent = texto;
    eventosStatus.classList.remove("hidden");
}

function esconderStatus() {
    eventosStatus.classList.add("hidden");
}

function mostrarMensagem(texto, tipo) {
    eventoMessage.textContent = texto;
    eventoMessage.className = `message message-${tipo}`;
}

function limparMensagem() {
    eventoMessage.className = "message hidden";
}

function partesDaData(iso) {
    const [ano, mes, dia] = (iso || "").split("-");
    return { ano, mes, dia };
}

function horario(e) {
    if (!e.inicio) return "-";
    return e.fim ? `${e.inicio} - ${e.fim}` : e.inicio;
}


/* ---------------------------------------------------------
   RENDERIZAÇÃO
--------------------------------------------------------- */

function renderizar(lista) {

    eventoCount.textContent = `${lista.length} ${lista.length === 1 ? "evento" : "eventos"}`;

    if (lista.length === 0) {
        eventosGrid.innerHTML = "";
        mostrarStatus("Nenhum evento encontrado.");
        return;
    }

    esconderStatus();

    const gerencia = podeGerenciar();

    eventosGrid.innerHTML = lista.map(e => {

        const { mes, dia } = partesDaData(e.data);
        const tipo = TIPOS_EVENTO[e.tipo];
        const sigla = MESES[Number(mes) - 1]?.slice(0, 3).toUpperCase() || "";

        return `
        <article class="event-card">

            <div class="event-card-top">

                <div class="event-date">
                    <strong>${escapeHtml(dia)}</strong>
                    <span>${escapeHtml(sigla)}</span>
                </div>

                <span class="event-type type-${escapeHtml(e.tipo)}">
                    ${tipo ? tipo.icone + " " + escapeHtml(tipo.rotulo) : escapeHtml(e.tipo || "-")}
                </span>

            </div>

            <h3>${escapeHtml(e.titulo)}</h3>

            <p class="event-description">${escapeHtml(e.descricao)}</p>

            <ul class="event-meta">
                <li>🕒 ${escapeHtml(horario(e))}</li>
                <li>📍 ${escapeHtml(e.local || "-")}</li>
                <li>👥 ${escapeHtml(PUBLICOS_EVENTO[e.publico] || e.publico || "-")}</li>
            </ul>

            ${gerencia ? `
            <div class="event-actions">
                <button type="button" class="icon-btn" title="Editar ${escapeHtml(e.titulo)}"
                        data-edit="${escapeHtml(e.id)}">✎</button>
                <button type="button" class="icon-btn danger" title="Excluir ${escapeHtml(e.titulo)}"
                        data-delete="${escapeHtml(e.id)}">🗑</button>
            </div>` : ""}

        </article>`;
    }).join("");
}


function filtrar() {

    const termo = eventoSearch.value.trim().toLowerCase();

    const filtrados = eventos.filter(e =>
        (!termo || `${e.titulo} ${e.local}`.toLowerCase().includes(termo)) &&
        (!tipoFilter.value || e.tipo === tipoFilter.value) &&
        (!publicoFilter.value || e.publico === publicoFilter.value) &&
        (!mesFilter.value || partesDaData(e.data).mes === mesFilter.value)
    );

    renderizar(filtrados);
}


/* ---------------------------------------------------------
   CARREGAR
--------------------------------------------------------- */

async function carregarEventos() {

    mostrarStatus("Carregando eventos...");

    try {
        eventos = (await listarEventos())
            .sort((a, b) => (a.data + a.inicio).localeCompare(b.data + b.inicio));
        filtrar();
    } catch (error) {
        eventosGrid.innerHTML = "";
        eventoCount.textContent = "0 eventos";
        mostrarStatus(error.message || "Não foi possível carregar os eventos.");
    }
}


/* ---------------------------------------------------------
   MODAL
--------------------------------------------------------- */

function abrirModal(evento) {

    eventoForm.reset();
    limparMensagem();

    editandoId = evento ? evento.id : null;

    document.getElementById("modalTitle").textContent =
        evento ? "Editar evento" : "Novo evento";

    document.getElementById("modalSubtitle").textContent =
        evento ? "Altere os dados do evento." : "Cadastre um novo evento escolar.";

    if (evento) {
        eventoForm.titulo.value = evento.titulo;
        eventoForm.data.value = evento.data;
        eventoForm.local.value = evento.local;
        eventoForm.inicio.value = evento.inicio;
        eventoForm.fim.value = evento.fim;
        eventoForm.tipo.value = evento.tipo;
        eventoForm.publico.value = evento.publico;
        eventoForm.descricao.value = evento.descricao;
    }

    saveEvento.disabled = false;
    saveEvento.textContent = "Salvar";

    eventoModal.classList.add("show");
}

function fecharModal() {
    eventoModal.classList.remove("show");
    editandoId = null;
}


document.getElementById("openEventoModal").addEventListener("click", () => abrirModal(null));
document.getElementById("closeEventoModal").addEventListener("click", fecharModal);
document.getElementById("cancelEvento").addEventListener("click", fecharModal);

eventoModal.addEventListener("click", event => {
    if (event.target === eventoModal) fecharModal();
});

document.addEventListener("keydown", event => {
    if (event.key === "Escape") fecharModal();
});


/* ---------------------------------------------------------
   SALVAR
--------------------------------------------------------- */

eventoForm.addEventListener("submit", async function (event) {

    event.preventDefault();

    const dados = {
        titulo: eventoForm.titulo.value.trim(),
        data: eventoForm.data.value,
        local: eventoForm.local.value.trim(),
        inicio: eventoForm.inicio.value,
        fim: eventoForm.fim.value,
        tipo: eventoForm.tipo.value,
        publico: eventoForm.publico.value,
        descricao: eventoForm.descricao.value.trim()
    };

    if (!dados.titulo || !dados.data || !dados.local || !dados.inicio || !dados.tipo || !dados.publico) {
        return mostrarMensagem("Preencha título, data, local, início, tipo e público.", "error");
    }

    if (dados.fim && dados.fim <= dados.inicio) {
        return mostrarMensagem("O término deve ser depois do início.", "error");
    }

    saveEvento.disabled = true;
    saveEvento.textContent = "Salvando...";

    try {

        if (editandoId) {
            await atualizarEvento(editandoId, dados);
        } else {
            await criarEvento(dados);
        }

        fecharModal();
        await carregarEventos();

    } catch (error) {
        mostrarMensagem(error.message || "Não foi possível salvar o evento.", "error");
        saveEvento.disabled = false;
        saveEvento.textContent = "Salvar";
    }
});


/* ---------------------------------------------------------
   EDITAR / EXCLUIR
--------------------------------------------------------- */

eventosGrid.addEventListener("click", async function (event) {

    const botaoEditar = event.target.closest("button[data-edit]");
    const botaoExcluir = event.target.closest("button[data-delete]");

    if (botaoEditar) {
        const evento = eventos.find(e => String(e.id) === botaoEditar.dataset.edit);
        if (evento) abrirModal(evento);
        return;
    }

    if (!botaoExcluir) {
        return;
    }

    const id = botaoExcluir.dataset.delete;
    const evento = eventos.find(e => String(e.id) === id);

    if (!confirm(`Excluir o evento "${evento ? evento.titulo : ""}"?`)) {
        return;
    }

    botaoExcluir.disabled = true;

    try {
        await excluirEvento(id);
        eventos = eventos.filter(e => String(e.id) !== id);
        filtrar();
    } catch (error) {
        alert(error.message || "Não foi possível excluir o evento.");
        botaoExcluir.disabled = false;
    }
});


/* ---------------------------------------------------------
   FILTROS / ATUALIZAR
--------------------------------------------------------- */

eventoSearch.addEventListener("input", filtrar);
tipoFilter.addEventListener("change", filtrar);
publicoFilter.addEventListener("change", filtrar);
mesFilter.addEventListener("change", filtrar);

document.getElementById("refreshEventos").addEventListener("click", carregarEventos);


carregarEventos();
