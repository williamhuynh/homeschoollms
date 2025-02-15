from fastapi import Request
from fastapi.responses import JSONResponse

async def http_error_handler(request: Request, exc):
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail}
    )

async def invalid_object_id_handler(request: Request, exc):
    return JSONResponse(
        status_code=400,
        content={"detail": "Invalid ID format"}
    )