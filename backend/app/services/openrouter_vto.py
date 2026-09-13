"""
openrouter_vto.py — Photorealistic Virtual Try-On via OpenRouter Nano Banana
============================================================================
Uses Google's Gemini 2.5 Flash Image model (a.k.a. "Nano Banana") through the
OpenRouter API to generate a photorealistic image of a person wearing a chosen
garment.

Unlike IDM-VTON (which is trained mainly on Western upper-body garments and
tends to shorten long garments into shirts), Nano Banana understands garment
semantics from natural language — so traditional South Asian wear such as a
kurta / shalwar kameez is rendered with the correct long silhouette.

Public API:
    generate_tryon(person_image_base64, garment_image_base64, garment_description)
        -> str  (a "data:image/...;base64,..." data URI of the result)

Raises:
    VtoConfigError   — when OPENROUTER_API_KEY is not configured
    VtoProviderError — when the upstream API fails (network, quota, no image)
"""

import base64

import httpx

from ..config import settings

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
MODEL = "google/gemini-2.5-flash-image"
REQUEST_TIMEOUT = 120.0


class VtoConfigError(Exception):
    """Raised when the OpenRouter provider is not configured."""


class VtoProviderError(Exception):
    """Raised when the OpenRouter request fails or returns no image."""


def _to_data_url(b64_str: str, default_mime: str = "image/jpeg") -> str:
    """Ensure the base64 string is a proper data URL for the API."""
    if b64_str.startswith("data:"):
        return b64_str
    return f"data:{default_mime};base64,{b64_str}"


def _build_prompt(garment_description: str) -> str:
    """Construct a strict virtual try-on instruction for the model."""
    desc = (garment_description or "a garment").strip()
    return (
        "You are a professional virtual try-on image generator. "
        "The FIRST image is a photo of a person. "
        f"The SECOND image shows the garment described as: {desc}. "
        "The garment may be displayed on a mannequin, dress form, stand, hanger, or "
        "model. Generate a single new photorealistic image of the SAME person from the "
        "first image now wearing the exact garment from the second image.\n\n"
        "STRICT REQUIREMENTS:\n"
        "- Keep the person's face, hairstyle, skin tone, body shape and pose "
        "EXACTLY the same as the first image.\n"
        "- Keep the original background unchanged.\n"
        "- IGNORE any mannequin body, wooden stand, hanger, display fixture, or "
        "background from the second image. Extract ONLY the clothing itself.\n"
        "- Reproduce the garment's exact color, fabric, pattern and any "
        "embroidery from the second image.\n"
        "- CRITICAL: Dress the person in the COMPLETE outfit shown in the second image. "
        "If the garment is a suit or multi-piece set (like a shalwar kameez or pent coat with trousers), "
        "you MUST apply ALL pieces. You MUST replace the person's lower-body clothing (pants/jeans) "
        "with the matching trousers from the garment.\n"
        "- CRITICAL: DO NOT crop the image to just the upper body! If the input photo shows the full body, "
        "the output MUST show the full body including the legs and pants.\n"
        "- Use the garment's OWN sleeve length, not the person's. If the garment "
        "has full-length sleeves, render full-length sleeves even if the person was "
        "originally wearing a short-sleeve shirt. NEVER copy the person's original "
        "sleeve length.\n"
        "- Respect the garment's true shape and length as described: if it is a "
        "long kurta / kameez / traditional tunic, render it full length "
        "(knee-length, full sleeves, straight loose cut) and do NOT shorten it "
        "into a shirt.\n"
        "- Use natural lighting with realistic fabric draping, folds and shadows.\n"
        "Output only the final image."
    )


def generate_tryon(
    person_image_base64: str,
    garment_image_base64: str,
    garment_description: str = "a garment",
) -> str:
    """Generate a photorealistic try-on image. Returns a data-URI string."""
    api_key = settings.OPENROUTER_API_KEY
    if not api_key:
        raise VtoConfigError(
            "OPENROUTER_API_KEY is not configured. Add it to backend/.env."
        )

    payload = {
        "model": MODEL,
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": _build_prompt(garment_description)},
                    {
                        "type": "image_url",
                        "image_url": {"url": _to_data_url(person_image_base64)},
                    },
                    {
                        "type": "image_url",
                        "image_url": {"url": _to_data_url(garment_image_base64)},
                    },
                ],
            }
        ],
        "modalities": ["image", "text"],
        "max_tokens": 6144,
    }

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        # OpenRouter recommends these for attribution / rankings.
        "HTTP-Referer": settings.FRONTEND_URL,
        "X-Title": "TailorHub",
    }

    try:
        resp = httpx.post(
            OPENROUTER_URL, headers=headers, json=payload, timeout=REQUEST_TIMEOUT
        )
    except httpx.TimeoutException as exc:
        raise VtoProviderError(
            "The AI image server took too long to respond. Please try again."
        ) from exc
    except httpx.HTTPError as exc:
        raise VtoProviderError(f"Could not reach the AI image server: {exc}") from exc

    if resp.status_code != 200:
        # Surface a clean, user-facing message based on the error.
        detail = ""
        try:
            err = resp.json().get("error", {})
            detail = err.get("message", "") if isinstance(err, dict) else str(err)
        except Exception:
            detail = resp.text[:200]

        low = detail.lower()
        if resp.status_code == 402 or "credit" in low or "insufficient" in low:
            raise VtoProviderError(
                "The AI Try-On account is out of credits. Please top up OpenRouter "
                "credits to continue using AI Try-On."
            )
        if resp.status_code == 429 or "rate" in low or "quota" in low:
            raise VtoProviderError(
                "The AI image server is rate-limited right now. Please wait a few "
                "seconds and try again."
            )
        raise VtoProviderError(f"AI Try-On failed ({resp.status_code}): {detail}")

    try:
        data = resp.json()
        message = data["choices"][0]["message"]
        images = message.get("images") or []
        if not images:
            text = message.get("content") or "no image returned"
            raise VtoProviderError(
                f"The AI did not return an image. Model said: {text}"
            )
        url = images[0]["image_url"]["url"]
    except (KeyError, IndexError, TypeError) as exc:
        raise VtoProviderError(
            "Unexpected response format from the AI image server."
        ) from exc

    # url is already a data URI ("data:image/png;base64,...") — return as-is.
    return url
