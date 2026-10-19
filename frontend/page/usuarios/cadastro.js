const userForm = document.getElementById("userForm");
const saveButton = document.getElementById("saveButton");
const formMessage = document.getElementById("formMessage");
const perfilSelect = document.getElementById("perfil");

// Se a URL tiver ?id=..., a tela funciona como edição
const editId = new URLSearchParams(window.location.search).get("id");


// Preenche o select de perfis a partir do api.js
Object.entries(PERFIS).forEach(([valor, rotulo]) => {
    const option = document.createElement("option");
    option.value = valor;
    option.textContent = rotulo;
    perfilSelect.appendChild(option);
});


function mostrarMensagem(texto, tipo) {
    formMessage.textContent = texto;
    formMessage.className = `message message-${tipo}`;
}


async function prepararEdicao() {

    document.getElementById("formTitle").textContent = "Editar usuário";
    document.getElementById("formSubtitle").textContent =
        "Deixe a senha em branco para mantê-la como está.";

    try {
        const u = await buscarUsuario(editId);

        userForm.nome.value = u.nome;
        userForm.email.value = u.email;

        const perfil = String(u.perfil).toLowerCase();

        if (perfil && !PERFIS[perfil]) {
            const option = document.createElement("option");
            option.value = u.perfil;
            option.textContent = u.perfil;
            perfilSelect.appendChild(option);
        }

        perfilSelect.value = PERFIS[perfil] ? perfil : u.perfil;

    } catch (error) {
        mostrarMensagem(error.message || "Não foi possível carregar o usuário.", "error");
        saveButton.disabled = true;
    }
}


userForm.addEventListener("submit", async function (event) {

    event.preventDefault();

    const dados = {
        nome: userForm.nome.value.trim(),
        email: userForm.email.value.trim(),
        perfil: userForm.perfil.value,
        senha: userForm.senha.value
    };

    const confirmar = userForm.confirmar.value;

    if (!dados.nome || !dados.email || !dados.perfil) {
        return mostrarMensagem("Preencha nome, e-mail e perfil.", "error");
    }

    if (!editId && !dados.senha) {
        return mostrarMensagem("Informe uma senha para o novo usuário.", "error");
    }

    if (dados.senha && dados.senha.length < 6) {
        return mostrarMensagem("A senha deve ter pelo menos 6 caracteres.", "error");
    }

    if (dados.senha !== confirmar) {
        return mostrarMensagem("As senhas não conferem.", "error");
    }

    saveButton.disabled = true;
    saveButton.textContent = "Salvando...";

    try {

        if (editId) {
            await atualizarUsuario(editId, dados);
        } else {
            await criarUsuario(dados);
        }

        mostrarMensagem("Usuário salvo com sucesso!", "success");

        setTimeout(() => {
            window.location.href = "usuarios.html";
        }, 900);

    } catch (error) {
        mostrarMensagem(error.message || "Não foi possível salvar o usuário.", "error");
        saveButton.disabled = false;
        saveButton.textContent = "Salvar";
    }
});


if (editId) {
    prepararEdicao();
}
