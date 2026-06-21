from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from backend.config import BACKEND_HOST, BACKEND_PORT
from backend.jobs import job_manager
from backend.services import (
    build_chain_response,
    build_fusion_response,
    build_research_bundle,
    build_research_trends,
    get_heat_for_codes,
)


@asynccontextmanager
async def lifespan(_: FastAPI):
    job_manager.start()
    yield
    job_manager.shutdown()


app = FastAPI(
    title="Semiconductor Research Backend",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        f"http://{BACKEND_HOST}:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health():
    return {
        "status": "ok",
        "service": "semiconductor-backend",
        "port": BACKEND_PORT,
    }


@app.get("/api/chains/{slug}")
async def chain_payload(slug: str):
    try:
        return build_chain_response(slug)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=f"Unknown chain slug: {slug}") from exc


@app.get("/api/fusion")
async def fusion_payload():
    return build_fusion_response()


@app.get("/api/research/bundle")
async def research_bundle():
    return build_research_bundle()


@app.get("/api/research/trends")
async def research_trends():
    return build_research_trends()


@app.get("/api/heat")
async def heat_payload(
    codes: str = Query("", description="Comma separated stock codes"),
    refresh: bool = Query(False, description="Whether to fetch latest heat before returning"),
):
    normalized_codes = [code.strip() for code in codes.split(",") if code.strip()]
    return get_heat_for_codes(normalized_codes, refresh=refresh)


@app.get("/api/jobs/status")
async def job_status():
    return job_manager.get_state()


@app.post("/api/jobs/refresh")
async def trigger_refresh():
    result = job_manager.run_full_refresh()
    if not result["accepted"]:
        raise HTTPException(status_code=409, detail=result["message"])
    return result


@app.post("/api/jobs/refresh-heat")
async def trigger_heat_refresh():
    result = job_manager.run_heat_refresh()
    if not result["accepted"]:
        raise HTTPException(status_code=409, detail=result["message"])
    return result
