const usersBody = document.getElementById("usersBody");
const usersStatus = document.getElementById("usersStatus");
const searchUser = document.getElementById("searchUser");

let usuarios = [];


function mostrarStatus(texto) {
    usersStatus.textContent = texto;
    usersStatus.classList.remove("hidden");
}


function esconderStatus() {
    usersStatus.classList.add("hidden");
}


function renderizar(lista) {

    if (lista.length === 0) {
        usersBody.innerHTML = "";
        mostrarStatus("Nenhum usuário encontrado.");
        return;
    }

    esconderStatus();

    usersBody.innerHTML = lista.map(u => `
        <tr>
            <td>${escapeHtml(u.nome)}</td>
            <td>${escapeHtml(u.email)}</td>
            <td>${escapeHtml(nomeDoPerfil(u.perfil))}</td>
            <td class="col-actions">
                <a class="icon-btn" title="Editar ${escapeHtml(u.nome)}"
                   href="cadastro.html?id=${encodeURIComponent(u.id)}">✎</a>
                <button type="button" class="icon-btn danger"
                        title="Excluir ${escapeHtml(u.nome)}"
                        data-id="${escapeHtml(u.id)}">🗑</button>
            </td>
        </tr>
    `).join("");
}


function filtrar() {
    const termo = searchUser.value.trim().toLowerCase();

    const filtrados = usuarios.filter(u =>
        [u.nome, u.email, nomeDoPerfil(u.perfil)]
            .some(campo => String(campo).toLowerCase().includes(termo))
    );

    renderizar(filtrados);
}


async function carregarUsuarios() {

    mostrarStatus("Carregando usuários...");

    try {
        usuarios = await listarUsuarios();
        filtrar();
    } catch (error) {
        usersBody.innerHTML = "";
        mostrarStatus(error.message || "Não foi possível carregar os usuários.");
    }
}


usersBody.addEventListener("click", async function (event) {

    const botao = event.target.closest("button[data-id]");

    if (!botao) {
        return;
    }

    const id = botao.dataset.id;
    const usuario = usuarios.find(u => String(u.id) === id);

    if (!confirm(`Excluir o usuário ${usuario ? usuario.nome : ""}?`)) {
        return;
    }

    botao.disabled = true;

    try {
        await excluirUsuario(id);
        usuarios = usuarios.filter(u => String(u.id) !== id);
        filtrar();
    } catch (error) {
        alert(error.message || "Não foi possível excluir o usuário.");
        botao.disabled = false;
    }
});


searchUser.addEventListener("input", filtrar);

carregarUsuarios();
