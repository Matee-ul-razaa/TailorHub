from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
import base64
import os
import uuid

from .config import settings

router = APIRouter(prefix="/api/vto", tags=["vto"])

class TryOnRequest(BaseModel):
    person_image_base64: str
    garment_image_base64: str
    garment_description: str = "A beautiful garment"

class TryOnResponse(BaseModel):
    result_image_base64: str


@router.post("/tryon", response_model=TryOnResponse)
def perform_virtual_try_on(request: TryOnRequest):
    """Photorealistic AI Try-On.

    Primary provider: OpenRouter "Nano Banana" (Gemini 2.5 Flash Image) — best
    quality and correctly handles traditional/long garments.
    """
    if not settings.OPENROUTER_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="OPENROUTER_API_KEY is not configured on the server."
        )

    from .services.openrouter_vto import (
        generate_tryon,
        VtoConfigError,
        VtoProviderError,
    )
    try:
        result_b64 = generate_tryon(
            person_image_base64=request.person_image_base64,
            garment_image_base64=request.garment_image_base64,
            garment_description=request.garment_description,
        )
        return TryOnResponse(result_image_base64=result_b64)
    except (VtoConfigError, VtoProviderError) as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(e)
        )
