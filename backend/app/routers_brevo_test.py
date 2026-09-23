from fastapi import APIRouter
from app.config import settings

router = APIRouter(tags=["Brevo Test"])

@router.get("/api/brevo-test-xyz")
def test_brevo():
    key = getattr(settings, 'BREVO_API_KEY', None)
    return {"key_len": len(key) if key else 0, "starts_with": key[:5] if key else "None", "ends_with": key[-5:] if key else "None"}
