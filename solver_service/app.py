import os
from typing import Optional

from fastapi import FastAPI, Header, HTTPException

from .models import SolveRequest, SolveResponse
from .solver import solve_cp_sat


app = FastAPI(title="Luxlait Solver Service", version="1.0.0")


SOLVER_SECRET = os.getenv("SOLVER_SERVICE_SECRET")


@app.get("/health")
def health() -> dict:
    return {"ok": True}


@app.post("/solve", response_model=SolveResponse)
def solve(payload: SolveRequest, x_solver_secret: Optional[str] = Header(default=None)) -> SolveResponse:
    if SOLVER_SECRET:
        if not x_solver_secret or x_solver_secret != SOLVER_SECRET:
            raise HTTPException(status_code=401, detail="Unauthorized")

    # Basic validation: if date order is invalid, solver will return empty.
    try:
        return solve_cp_sat(payload)
    except Exception as e:  # noqa: BLE001
        return SolveResponse(ok=False, assignments=[], stats={"error": "solver exception"}, error=str(e))

