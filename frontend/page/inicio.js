/* Início: mostra os próximos eventos vindos da API */

const homeEvents = document.getElementById("homeEvents");


function formatarDataCurta(iso) {
    const [ano, mes, dia] = iso.split("-");
    return `${dia}/${mes}`;
}


async function carregarProximosEventos() {

    try {
        const hoje = new Date().toISOString().slice(0, 10);

        const proximos = (await listarEventos())
            .filter(e => e.data >= hoje)
            .sort((a, b) => (a.data + a.inicio).localeCompare(b.data + b.inicio))
            .slice(0, 3);

        if (proximos.length === 0) {
            homeEvents.innerHTML = '<div class="table-status">Nenhum evento próximo.</div>';
            return;
        }

        homeEvents.innerHTML = proximos.map(e => `
            <div class="event-item">
                <span class="event-dot"></span>
                <div>
                    <strong>${escapeHtml(e.titulo)}</strong>
                    <p>${formatarDataCurta(e.data)}${e.inicio ? " · " + escapeHtml(e.inicio) : ""}</p>
                </div>
            </div>
        `).join("");

    } catch (error) {
        homeEvents.innerHTML =
            `<div class="table-status">${escapeHtml(error.message || "Não foi possível carregar os eventos.")}</div>`;
    }
}


carregarProximosEventos();
