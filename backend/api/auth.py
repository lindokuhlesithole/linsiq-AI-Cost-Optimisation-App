"""Authentication API endpoints."""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()


class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


@router.post("/login")
async def login(req: LoginRequest):
    """Login with email/password."""
    # TODO: Implement proper auth with Supabase
    return {"status": "ok", "message": "Auth endpoint - integrate with Supabase"}


@router.post("/refresh")
async def refresh_token():
    """Refresh access token."""
    return {"status": "ok"}


@router.get("/me")
async def get_current_user():
    """Get current user info."""
    return {
        "id": "user-001",
        "email": "user@example.com",
        "name": "Demo User",
        "role": "admin",
    }
