import os
from contextlib import asynccontextmanager
from datetime import datetime
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles

from .database import init_db
from .routers import auth, events, users


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title="Schoolnet API", version="1.0.0", lifespan=lifespan)

# CORS: por padrão libera qualquer origem (desenvolvimento).
# Em produção: CORS_ORIGINS="http://meusite.com,http://outro.com"
origins = [o.strip() for o in os.getenv("CORS_ORIGINS", "*").split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_methods=["*"],
    allow_headers=["*"],
)


REQUEST_LOG = Path(__file__).resolve().parent.parent / "requests.log"


@app.middleware("http")
async def no_cache_and_log(request: Request, call_next):
    response = await call_next(request)

    # Front-end sem cache: o navegador sempre pega a versão atual dos .js
    if request.url.path.startswith("/app"):
        response.headers["Cache-Control"] = "no-store"

    # DIAGNÓSTICO TEMPORÁRIO do problema de login (remover depois)
    auth = request.headers.get("authorization", "")
    with REQUEST_LOG.open("a", encoding="utf-8") as log:
        log.write(
            f"{datetime.now():%H:%M:%S} {request.method} {request.url.path} -> {response.status_code}"
            f" | auth={'sim' if auth else 'nao'} origin={request.headers.get('origin')}"
            f" referer={request.headers.get('referer')} ua={request.headers.get('user-agent', '')[:60]}\n"
        )

    return response


@app.exception_handler(RequestValidationError)
async def validation_handler(request: Request, exc: RequestValidationError):
    """Devolve {"detail": "mensagem legível"} — o front mostra esse texto na tela."""
    mensagens = []
    for erro in exc.errors():
        msg = str(erro.get("msg", "Dado inválido.")).removeprefix("Value error, ")
        campo = next((str(p) for p in reversed(erro.get("loc", ())) if p not in ("body", "query", "path")), "")
        mensagens.append(f"{campo}: {msg}" if campo else msg)
    return JSONResponse(status_code=422, content={"detail": " | ".join(mensagens)})


app.include_router(auth.router)
app.include_router(users.router)
app.include_router(events.router)


@app.get("/", include_in_schema=False)
def root():
    return RedirectResponse("/app/index.html")


# Front-end servido pela própria API: mesma origem em todas as páginas,
# então o token salvo no login é visto pelo início (e não há problema de CORS)
FRONTEND_DIR = Path(__file__).resolve().parent.parent.parent / "frontend"
if FRONTEND_DIR.is_dir():
    app.mount("/app", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
