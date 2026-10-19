const loginForm = document.getElementById("loginForm");
const loginButton = document.getElementById("loginButton");
const loginMessage = document.getElementById("loginMessage");


// Já existe sessão válida? Vai direto para o início sem pedir login de novo
async function redirecionarSeLogado() {

    // Veio de um logout: limpa tudo e mostra o formulário (evita loop login ⇄ início)
    const motivo = new URLSearchParams(window.location.search).get("saiu");

    if (motivo !== null) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");

        const mensagens = {
            "sem-token": "A página inicial não encontrou o login salvo no navegador (sem-token).",
            "sem-usuario": "A página inicial não encontrou os dados do usuário salvos (sem-usuario).",
            "token-invalido": "Sessão inválida ou expirada. Entre novamente (token-invalido)."
        };

        if (mensagens[motivo]) {
            console.warn("Sessão encerrada:", motivo);
            loginMessage.textContent = mensagens[motivo];
            loginMessage.classList.remove("hidden");
        }

        return;
    }

    const token = localStorage.getItem("token");

    if (!token || !getStoredUser()) {
        return;
    }

    try {

        const response = await fetch(`${API_URL}${API_ROUTES.session}`, {
            headers: { "Authorization": `Bearer ${token}` }
        });

        if (response.ok) {
            window.location.href = "page/inicio.html";
            return;
        }

        if (response.status === 401) {
            localStorage.removeItem("token");
            localStorage.removeItem("user");
        }

    } catch (error) {
        console.error("Erro ao verificar sessão:", error);
    }
}

redirecionarSeLogado();

loginForm.addEventListener("submit", async function (event) {

event.preventDefault();

const email = document.getElementById("email").value.trim();
const password = document.getElementById("password").value;

loginMessage.classList.add("hidden");

if (!email || !password) {

    loginMessage.textContent =
        "E-mail e senha são obrigatórios.";

    loginMessage.classList.remove("hidden");

    return;
}

loginButton.disabled = true;
loginButton.textContent = "ENTRANDO...";

try {

    console.log("Tentando fazer login...");

    const response = await login(email, password);

    console.log("Resposta do Back-end:", response);

    const token = response.access_token;

    if (!token) {
        throw new Error("Token não recebido pelo servidor.");
    }

    localStorage.setItem("token", token);

    // O back-end pode devolver o usuário junto com o token (response.user)
    const apiUser = response.user || {};

    localStorage.setItem(
        "user",
        JSON.stringify({
            username: email,
            token: token,
            name: apiUser.name || apiUser.nome || "",
            role: apiUser.role || apiUser.perfil || ""
        })
    );

    console.log("Login realizado com sucesso!");
    console.log("Redirecionando...");

    window.location.href = "page/inicio.html";

} catch (error) {

    console.error("Erro no login:", error);

    loginMessage.textContent =
        error.message ||
        "Erro ao realizar login.";

    loginMessage.classList.remove("hidden");

} finally {

    loginButton.disabled = false;
    loginButton.textContent = "ENTRAR";

}
});