 /* =========================================================
    SCHOOLNET - SESSÃO
    Usado em todas as páginas protegidas
========================================================= */

const ROOT_URL = new URL(".", document.currentScript.src).href;


/* =========================================================
   LOGOUT
========================================================= */

function logout(motivo = "sair") {

    localStorage.removeItem("user");
    localStorage.removeItem("token");

    // "?saiu=..." impede a tela de login de redirecionar de volta (evita loop)
    // e diz por que a sessão foi encerrada
    window.location.href = ROOT_URL + "index.html?saiu=" + encodeURIComponent(motivo);
}


/* =========================================================
   VERIFICAR AUTENTICAÇÃO
========================================================= */

async function verificarAutenticacao() {

    const token = localStorage.getItem("token");

    // Não existe token
    if (!token) {

        logout("sem-token");

        return false;
    }

    try {

        const response = await fetch(
            `${API_URL}${API_ROUTES.session}`,
            {
                method: "GET",

                headers: {
                    "Authorization": `Bearer ${token}`
                }
            }
        );

        // JWT inválido ou expirado
        if (response.status === 401) {

            logout("token-invalido");

            return false;
        }

        // Outro erro da API
        if (!response.ok) {

            console.error(
                "Erro ao verificar sessão:",
                response.status
            );

            return false;
        }

        return true;

    } catch (error) {

        console.error(
            "Erro ao conectar com a API:",
            error
        );

        return false;
    }
}


/* =========================================================
   INICIALIZAR SESSÃO
========================================================= */

async function initSession() {

    const autenticado = await verificarAutenticacao();

    if (!autenticado) {
        return;
    }

    const user = getStoredUser();

    if (!user) {

        logout("sem-usuario");

        return;
    }


    /* =====================================================
       DADOS DO USUÁRIO
    ===================================================== */

    const nome =
        user.name ||
        user.nome ||
        user.username ||
        "Usuário";


    const perfil =
        nomeDoPerfil(
            user.role ||
            user.perfil ||
            user.profile
        );


    /* =====================================================
       PREENCHER NOME
    ===================================================== */

    document
        .querySelectorAll("[data-user-name]")
        .forEach(element => {

            element.textContent = nome;

        });


    /* =====================================================
       PREENCHER PRIMEIRO NOME
    ===================================================== */

    document
        .querySelectorAll("[data-user-first-name]")
        .forEach(element => {

            element.textContent =
                nome.split(" ")[0];

        });


    /* =====================================================
       PREENCHER PERFIL
    ===================================================== */

    document
        .querySelectorAll("[data-user-role]")
        .forEach(element => {

            element.textContent = perfil;

        });


    /* =====================================================
       BOTÃO SAIR
    ===================================================== */

    document
        .querySelectorAll("[data-logout]")
        .forEach(element => {

            element.addEventListener(
                "click",
                function (event) {

                    event.preventDefault();

                    logout();

                }
            );

        });
}


/* =========================================================
   INICIAR
========================================================= */

initSession();