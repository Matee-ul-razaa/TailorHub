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

def save_base64_to_temp(b64_str: str, prefix: str) -> str:
    """Strip optional data URI prefix and decode base64 to a temp file."""
    import tempfile
    if "," in b64_str:
        b64_str = b64_str.split(",")[1]
    decoded = base64.b64decode(b64_str)
    filename = f"{prefix}_{uuid.uuid4().hex}.jpg"
    filepath = os.path.join(tempfile.gettempdir(), filename)
    print(f"DEBUG: Saving base64 to {filepath} (prefix: {prefix})")
    with open(filepath, "wb") as f:
        f.write(decoded)
    return filepath

@router.post("/tryon", response_model=TryOnResponse)
def perform_virtual_try_on(request: TryOnRequest):
    # Guard: feature requires HuggingFace token to be configured
    if not settings.vto_enabled:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "Virtual Try-On is not configured on this server. "
                "Set HUGGINGFACE_TOKEN in backend/.env to enable this feature."
            ),
        )

    person_path = None
    garment_path = None
    try:
        person_path = save_base64_to_temp(request.person_image_base64, "person")
        garment_path = save_base64_to_temp(request.garment_image_base64, "garment")

        # Connect to the free IDM-VTON Space on Hugging Face
        try:
            from gradio_client import Client, handle_file
        except ImportError:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="gradio_client is not installed. Run: pip install gradio_client",
            )
        token = settings.HUGGINGFACE_TOKEN
        print(f"DEBUG: VTO Process Started. Token present: {bool(token)}")
        
        client_kwargs = {"src": "yisol/IDM-VTON", "verbose": True}
        if token:
            client_kwargs["token"] = token
            
        print("DEBUG: Initializing Gradio Client...")
        client = Client(**client_kwargs)
        print("DEBUG: Client connected.")
        
        person_dict = {"background": handle_file(person_path), "layers": [], "composite": None}
        garment_file = handle_file(garment_path)

        enhanced_description = "A men's " + request.garment_description

        result = client.predict(
            dict=person_dict,
            garm_img=garment_file,
            garment_des=enhanced_description,
            is_checked=True,
            is_checked_crop=True,
            denoise_steps=30,
            seed=42,
            api_name="/tryon"
        )
        
        # Result is typically a tuple where result[0] is the returned image filepath
        out_path = result[0] if isinstance(result, (list, tuple)) else result
        
        with open(out_path, "rb") as f:
            encoded = base64.b64encode(f.read()).decode("utf-8")
            
        final_b64 = f"data:image/jpeg;base64,{encoded}"
        
        return TryOnResponse(result_image_base64=final_b64)
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if person_path and os.path.exists(person_path):
            os.remove(person_path)
        if garment_path and os.path.exists(garment_path):
            os.remove(garment_path)
