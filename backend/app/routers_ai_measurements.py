"""AI-powered body measurement extraction from photos (Gemini Vision).

Accepts front and side full-body photos as base64 and returns estimated
body measurements in inches. Requires GEMINI_API_KEY to be configured.

The endpoint NEVER auto-saves — it only returns estimates that the
frontend renders with an "AI estimated — verify before saving" banner.
The user must manually review and click Save on the Measurements page.
"""

import base64
import json
import os
import re
import tempfile
import traceback
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from .config import settings
from .deps import get_current_user
from .models import User

router = APIRouter(prefix="/api/measurements", tags=["measurements"])


# ── Request / Response schemas ───────────────────────────────────────────────

class ExtractRequest(BaseModel):
    front_image_base64: str = Field(..., description="Base64-encoded front photo (with or without data URI prefix)")
    side_image_base64: str = Field(..., description="Base64-encoded side photo (with or without data URI prefix)")
    gender: str = Field(default="male", description="male | female | other")
    height_cm: float = Field(default=0, ge=0, le=260, description="Height in cm (optional, improves accuracy)")


class ExtractResult(BaseModel):
    measurements: dict[str, float]  # field_key -> inches, rounded to 0.5
    confidence: str                 # "low" | "medium" | "high"
    notes: list[str]                # advisory messages for the user


# ── Helpers ──────────────────────────────────────────────────────────────────

def _strip_data_uri(b64: str) -> str:
    """Remove the optional `data:image/...;base64,` prefix."""
    if "," in b64:
        return b64.split(",", 1)[1]
    return b64


def _save_temp(b64_raw: str, label: str) -> str:
    """Decode base64 and write to a temp file. Returns file path."""
    decoded = base64.b64decode(b64_raw)
    fname = f"ai_measure_{label}_{uuid.uuid4().hex[:8]}.jpg"
    fpath = os.path.join(tempfile.gettempdir(), fname)
    with open(fpath, "wb") as f:
        f.write(decoded)
    return fpath


_GEMINI_PROMPT = """You are an expert tailor and body measurement specialist.

Analyze these two full-body photos (front view and side view) of a person.
{height_line}
{gender_line}

Estimate the following body measurements in **inches** (round to nearest 0.5):

1. shoulder  — shoulder width (across the back, from one shoulder point to the other)
2. chest     — chest circumference at the fullest point
3. waist     — waist circumference at the natural waistline
4. hip       — hip circumference at the widest point
5. neck      — neck circumference
6. sleeveLength  — from shoulder point to wrist
7. shirtLength   — from base of neck to desired shirt hem (mid-hip)
8. inseam    — from crotch to ankle

Respond ONLY with a valid JSON object in this exact format, no other text:
{{
  "shoulder": 18.0,
  "chest": 40.0,
  "waist": 34.0,
  "hip": 38.0,
  "neck": 15.5,
  "sleeveLength": 24.0,
  "shirtLength": 28.0,
  "inseam": 31.0,
  "confidence": "medium",
  "notes": ["The front photo shows good posture", "Side view helps estimate chest depth"]
}}

The confidence should be:
- "high" if both photos are clear, well-lit, full-body, and the person is wearing fitted clothes
- "medium" if the photos are usable but not ideal (loose clothing, partial body, etc.)
- "low" if the photos are poor quality or the person's proportions are hard to judge

Include 1-3 short notes about the estimation quality.
"""


def _parse_gemini_response(text: str) -> dict:
    """Extract the JSON object from Gemini's response, handling markdown fences."""
    # Try to find JSON inside ```json ... ``` fences
    fence_match = re.search(r"```(?:json)?\s*\n?(.*?)\n?```", text, re.DOTALL)
    if fence_match:
        text = fence_match.group(1)

    # Try to find a JSON object
    brace_match = re.search(r"\{.*\}", text, re.DOTALL)
    if brace_match:
        return json.loads(brace_match.group(0))

    raise ValueError("Could not parse JSON from Gemini response")


# ── Endpoint ─────────────────────────────────────────────────────────────────

@router.post("/extract", response_model=ExtractResult)
def extract_measurements_from_photos(
    payload: ExtractRequest,
    _user: User = Depends(get_current_user),
):
    """Use Gemini Vision to estimate body measurements from front + side photos.

    Returns estimates only — the frontend must display them with a verification
    banner and let the user manually save after review.
    """
    # ── Guard: GEMINI_API_KEY must be set ─────────────────────────────────────
    if not settings.GEMINI_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "AI Measurement extraction is not configured on this server. "
                "Set GEMINI_API_KEY in backend/.env to enable this feature."
            ),
        )

    front_path = None
    side_path = None

    try:
        # ── Decode and save images ───────────────────────────────────────────
        front_b64 = _strip_data_uri(payload.front_image_base64)
        side_b64 = _strip_data_uri(payload.side_image_base64)

        front_path = _save_temp(front_b64, "front")
        side_path = _save_temp(side_b64, "side")

        # ── Build the prompt ─────────────────────────────────────────────────
        height_line = ""
        if payload.height_cm > 0:
            height_in = round(payload.height_cm / 2.54, 1)
            height_line = f"The person's stated height is {payload.height_cm} cm ({height_in} inches). Use this as a calibration reference."

        gender_line = ""
        if payload.gender and payload.gender != "other":
            gender_line = f"The person's gender is {payload.gender}."

        prompt = _GEMINI_PROMPT.format(
            height_line=height_line,
            gender_line=gender_line,
        )

        # ── Call Gemini Vision API ───────────────────────────────────────────
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=settings.GEMINI_API_KEY)

        # Read image files as bytes
        with open(front_path, "rb") as f:
            front_bytes = f.read()
        with open(side_path, "rb") as f:
            side_bytes = f.read()

        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=[
                types.Content(
                    role="user",
                    parts=[
                        types.Part.from_text(text=prompt),
                        types.Part.from_bytes(
                            data=front_bytes,
                            mime_type="image/jpeg",
                        ),
                        types.Part.from_bytes(
                            data=side_bytes,
                            mime_type="image/jpeg",
                        ),
                    ],
                )
            ],
        )

        raw_text = response.text
        print(f"[AI-MEASURE] Gemini raw response:\n{raw_text[:500]}")

        # ── Parse response ───────────────────────────────────────────────────
        parsed = _parse_gemini_response(raw_text)

        # Extract measurement fields
        measurement_keys = [
            "shoulder", "chest", "waist", "hip", "neck",
            "sleeveLength", "shirtLength", "inseam",
        ]
        measurements = {}
        for key in measurement_keys:
            val = parsed.get(key)
            if val is not None:
                try:
                    v = float(val)
                    measurements[key] = round(v * 2) / 2  # round to nearest 0.5
                except (ValueError, TypeError):
                    pass

        confidence = parsed.get("confidence", "medium")
        if confidence not in ("low", "medium", "high"):
            confidence = "medium"

        notes = parsed.get("notes", [])
        if not isinstance(notes, list):
            notes = [str(notes)]
        notes = [str(n) for n in notes[:5]]  # cap at 5 notes

        # Always add the verification reminder
        notes.append("These are AI estimates — please verify with a tape measure before saving.")

        if not measurements:
            raise ValueError("Gemini returned no usable measurement values.")

        return ExtractResult(
            measurements=measurements,
            confidence=confidence,
            notes=notes,
        )

    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"AI measurement extraction failed: {str(e)}",
        )
    finally:
        # Clean up temp files
        for path in (front_path, side_path):
            if path and os.path.exists(path):
                try:
                    os.remove(path)
                except OSError:
                    pass
