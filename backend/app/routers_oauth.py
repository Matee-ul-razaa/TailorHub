from typing import Optional
import secrets
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from authlib.integrations.starlette_client import OAuth
from starlette.config import Config
from starlette.middleware.sessions import SessionMiddleware
from jose import jwt, JWTError

from .config import settings
from .database import get_db
from .models import User, UserRole
from .security import create_access_token
from .schemas import AuthTokenOut

class CompleteProfileIn(BaseModel):
    temp_token: str
    phone: Optional[str] = None
    address: Optional[str] = None
    agree_terms: bool = True


class OAuthCodeExchangeIn(BaseModel):
    """Frontend POSTs this code (received from OAuth redirect) to exchange for a real JWT."""
    code: str


# In-memory short-lived code store { code: access_token } — replace with Redis in production
_oauth_code_store: dict[str, str] = {}

router = APIRouter(prefix="/api/auth", tags=["oauth"])

starlette_config = Config(environ={
    "GOOGLE_CLIENT_ID": settings.GOOGLE_CLIENT_ID,
    "GOOGLE_CLIENT_SECRET": settings.GOOGLE_CLIENT_SECRET,
})

oauth = OAuth(starlette_config)

# Setup Google
oauth.register(
    name='google',
    server_metadata_url='https://accounts.google.com/.well-known/openid-configuration',
    client_kwargs={'scope': 'openid email profile'},
)

# Helper to create temporary token
def create_temp_registration_token(email: str, name: str, provider: str, oauth_id: str) -> str:
    payload = {
        "sub": email,
        "name": name,
        "provider": provider,
        "oauth_id": oauth_id,
        "exp": datetime.now(timezone.utc).timestamp() + 3600  # 1 hour
    }
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


@router.get("/{provider}/login")
async def login(provider: str, request: Request):
    """
    Initiate OAuth login for the given provider.
    Returns HTTP 503 if the provider credentials are not configured.
    """
    # Feature-flag guard — check credentials before attempting OAuth dance
    _PROVIDER_ENABLED = {
        "google": settings.google_oauth_enabled,
    }
    if provider not in _PROVIDER_ENABLED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown OAuth provider: '{provider}'.",
        )
    if not _PROVIDER_ENABLED[provider]:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                f"{provider.capitalize()} OAuth is not configured on this server. "
                f"Set {provider.upper()}_CLIENT_ID and {provider.upper()}_CLIENT_SECRET "
                f"in backend/.env to enable this login method."
            ),
        )

    client = oauth.create_client(provider)
    if not client:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"OAuth provider '{provider}' could not be initialised.",
        )

    redirect_uri = str(request.url_for("auth_callback", provider=provider))
    if request.headers.get("x-forwarded-proto") == "https" or "railway.app" in redirect_uri or not (redirect_uri.startswith("http://localhost") or redirect_uri.startswith("http://127.0.0.1")):
        redirect_uri = redirect_uri.replace("http://", "https://", 1)

    # Enforce account-picker for Google to avoid silent re-use of cached sessions
    kwargs = {}
    if provider == "google":
        kwargs["prompt"] = "select_account"

    return await client.authorize_redirect(request, redirect_uri, **kwargs)

@router.get("/{provider}/callback", include_in_schema=False)
async def auth_callback(provider: str, request: Request, db: Session = Depends(get_db)):
    if request.headers.get("x-forwarded-proto") == "https" or "railway.app" in str(request.base_url):
        request.scope["scheme"] = "https"

    client = oauth.create_client(provider)
    if not client:
        raise HTTPException(status_code=400, detail="Invalid provider")

    try:
        token = await client.authorize_access_token(request)
    except Exception as e:
        print(f"[OAuth] Error during {provider} callback: {e}")
        # Redirect to login with a user-friendly error — avoids a blank JSON error page
        return RedirectResponse(
            url=f"{settings.FRONTEND_URL}/login?error=oauth_failed",
            status_code=302,
        )

    user_info = None
    if provider == "google":
        user_info = token.get('userinfo')
        if not user_info:
            user_info = await client.parse_id_token(request, token)
    
    if not user_info:
        # Fetch for others if userinfo not in token
        resp = await client.get('me?fields=id,name,email', token=token)
        user_info = resp.json()

    email = user_info.get("email")
    name = user_info.get("name", "")
    oauth_id = user_info.get("sub") or user_info.get("id")

    if not email:
        raise HTTPException(status_code=400, detail="Email not provided by OAuth provider")

    # Check if user exists
    user = db.query(User).filter(User.email == email).first()
    
    if user:
        # Existing user, log them in
        if not user.oauth_id and user.auth_provider == "local":
            # Link accounts logically if they signed up locally first
            user.oauth_id = oauth_id
            user.auth_provider = provider

        # Google has verified this email; ensure our flag reflects that
        if not user.email_verified:
            user.email_verified = True

        db.commit()

        # Existing user — issue a short-lived opaque code, redirect with that
        access_token = create_access_token(user.id, user.role.value)
        code = secrets.token_urlsafe(32)
        _oauth_code_store[code] = access_token
        return RedirectResponse(url=f"{settings.FRONTEND_URL}/auth-success?code={code}", status_code=302)
    else:
        # New social user, issue temporary token and send to Complete Profile
        temp_token = create_temp_registration_token(email, name, provider, oauth_id)
        return RedirectResponse(url=f"{settings.FRONTEND_URL}/complete-profile?temp_token={temp_token}", status_code=302)

@router.post("/oauth-complete", response_model=AuthTokenOut)
def complete_oauth_profile(payload: CompleteProfileIn, db: Session = Depends(get_db)):
    try:
        data = jwt.decode(payload.temp_token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=400, detail="Invalid or expired temporary token")
    
    email = data.get("sub")
    name = data.get("name")
    provider = data.get("provider")
    oauth_id = data.get("oauth_id")

    if not email:
        raise HTTPException(status_code=400, detail="Token payload invalid")

    exists = db.query(User).filter(User.email == email).first()
    if exists:
        raise HTTPException(status_code=400, detail="User already exists. Please log in.")
    
    # Create the user from the temp token data plus any extra profile details
    user = User(
        email=email,
        full_name=name,
        role=UserRole.customer,
        auth_provider=provider,
        oauth_id=oauth_id,
        password_hash=None,  # OAuth users have no password
        email_verified=True,  # OAuth emails are verified by the provider
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    access_token = create_access_token(user.id, user.role.value)
    return AuthTokenOut(
        access_token=access_token,
        user_id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
    )


@router.post("/oauth-token", response_model=AuthTokenOut)
async def exchange_oauth_code(payload: OAuthCodeExchangeIn, db: Session = Depends(get_db)):
    """
    Exchange a short-lived opaque OAuth code for a real JWT access token.
    The code is generated server-side during the OAuth callback redirect and
    stored in memory (use Redis in production). Each code is single-use.
    """
    access_token = _oauth_code_store.pop(payload.code, None)
    if not access_token:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired OAuth code.")

    try:
        from jose import jwt as _jwt
        token_data = _jwt.decode(access_token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        user_id = token_data.get("sub")
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid token in code store.")

    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    return AuthTokenOut(
        access_token=access_token,
        user_id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
    )

