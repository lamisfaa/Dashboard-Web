import sqlite3
import os
import random
import re
import secrets
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import RedirectResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel

from database import get_connection
from security import (
    JWT_ALGORITHM,
    JWT_SECRET_KEY,
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)
from turnstile import verify_turnstile_token


router = APIRouter(prefix="/api/auth", tags=["auth"])
bearer_scheme = HTTPBearer(auto_error=False)
GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs"
GOOGLE_ISSUERS = {"https://accounts.google.com", "accounts.google.com"}
LOGIN_CAPTCHA_THRESHOLD = 3
login_failed_attempts: dict[str, int] = {}
GMAIL_EMAIL_PATTERN = re.compile(r"^[^\s@]+@gmail\.com$")


class SignupRequest(BaseModel):
    full_name: str
    email: str
    password: str
    turnstile_token: str | None = None


class LoginRequest(BaseModel):
    email: str
    password: str
    turnstile_token: str | None = None


class PasswordResetRequest(BaseModel):
    email: str
    turnstile_token: str | None = None


class PasswordResetConfirmRequest(BaseModel):
    email: str
    otp: str
    password: str


class PasswordResetVerifyRequest(BaseModel):
    email: str
    otp: str


class ProfileUpdateRequest(BaseModel):
    full_name: str


class PublicUser(BaseModel):
    id: int
    full_name: str
    email: str
    role: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: PublicUser


class PasswordResetStartResponse(BaseModel):
    message: str
    requires_google_recovery: bool = False
    google_recovery_url: str | None = None


class MessageResponse(BaseModel):
    message: str


def normalize_email(email: str) -> str:
    return email.strip().lower()


def validate_signup_email(email: str) -> None:
    if not GMAIL_EMAIL_PATTERN.fullmatch(email):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Use a valid Gmail address to create an account.",
        )


def get_login_failed_attempts(email: str) -> int:
    return login_failed_attempts.get(normalize_email(email), 0)


def record_login_failure(email: str) -> None:
    normalized_email = normalize_email(email)
    login_failed_attempts[normalized_email] = get_login_failed_attempts(normalized_email) + 1


def clear_login_failures(email: str) -> None:
    login_failed_attempts.pop(normalize_email(email), None)


def public_user_from_row(user) -> PublicUser:
    return PublicUser(
        id=user["id"],
        full_name=user["full_name"],
        email=user["email"],
        role=user["role"],
    )


def get_user_by_email(email: str):
    with get_connection() as connection:
        return connection.execute(
            """
            SELECT id, full_name, email, password_hash, role, is_active, auth_provider, google_sub, email_verified
            FROM users
            WHERE email = ?
            """,
            (normalize_email(email),),
        ).fetchone()


def get_user_by_google_sub(google_sub: str):
    with get_connection() as connection:
        return connection.execute(
            """
            SELECT id, full_name, email, password_hash, role, is_active, auth_provider, google_sub, email_verified
            FROM users
            WHERE google_sub = ?
            """,
            (google_sub,),
        ).fetchone()


def get_user_by_id(user_id: int):
    with get_connection() as connection:
        return connection.execute(
            """
            SELECT id, full_name, email, password_hash, role, is_active, auth_provider, google_sub, email_verified
            FROM users
            WHERE id = ?
            """,
            (user_id,),
        ).fetchone()


def get_google_client_id() -> str:
    return os.getenv("GOOGLE_CLIENT_ID", "").strip()


def get_google_client_secret() -> str:
    return os.getenv("GOOGLE_CLIENT_SECRET", "").strip()


def get_google_redirect_uri() -> str:
    return os.getenv(
        "GOOGLE_REDIRECT_URI",
        "http://127.0.0.1:8000/api/auth/google/callback",
    ).strip()


def get_frontend_url() -> str:
    return os.getenv("FRONTEND_URL", "http://localhost:5173").strip().rstrip("/")


def get_google_recovery_url() -> str:
    return "https://accounts.google.com/signin/recovery"


def get_email_from_address() -> str:
    return os.getenv("EMAIL_FROM", "").strip()


def is_email_delivery_configured() -> bool:
    return bool(os.getenv("RESEND_API_KEY", "").strip() and get_email_from_address())


def create_reset_otp() -> str:
    return f"{random.SystemRandom().randint(0, 999999):06d}"


def send_email_with_resend(email: str, full_name: str, otp: str) -> None:
    api_key = os.getenv("RESEND_API_KEY", "").strip()
    email_from = get_email_from_address()
    if not api_key:
        raise RuntimeError("RESEND_API_KEY is not configured.")

    payload = __import__("json").dumps(
        {
            "from": email_from,
            "to": [email],
            "subject": "Your PROJEX password reset OTP",
            "text": "\n".join(
                [
                    f"Hello {full_name},",
                    "",
                    f"Your PROJEX password reset OTP is: {otp}",
                    "",
                    "This code expires in 10 minutes. If you did not request this, ignore this email.",
                ]
            ),
        }
    ).encode("utf-8")
    request = urllib.request.Request(
        "https://api.resend.com/emails",
        data=payload,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            if response.status >= 400:
                raise RuntimeError(f"Resend returned HTTP {response.status}.")
    except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError, ValueError) as exc:
        raise RuntimeError(exc) from exc


def send_password_reset_email(email: str, full_name: str, otp: str):
    if not is_email_delivery_configured():
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Password reset email is not configured. Add RESEND_API_KEY and EMAIL_FROM in Render.",
        )

    try:
        send_email_with_resend(email, full_name, otp)
        return
    except RuntimeError as resend_exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Could not send password reset email with Resend: {resend_exc}",
        ) from None


def create_password_reset_otp(user) -> str:
    otp = create_reset_otp()
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)
    with get_connection() as connection:
        connection.execute(
            """
            UPDATE password_reset_otps
            SET used_at = CURRENT_TIMESTAMP
            WHERE user_id = ? AND used_at IS NULL
            """,
            (user["id"],),
        )
        connection.execute(
            """
            INSERT INTO password_reset_otps (user_id, otp_hash, expires_at)
            VALUES (?, ?, ?)
            """,
            (user["id"], hash_password(otp), expires_at.isoformat()),
        )
        connection.commit()
    return otp


def get_active_password_reset_otp(user_id: int):
    with get_connection() as connection:
        return connection.execute(
            """
            SELECT id, otp_hash, expires_at
            FROM password_reset_otps
            WHERE user_id = ? AND used_at IS NULL
            ORDER BY created_at DESC
            LIMIT 1
            """,
            (user_id,),
        ).fetchone()


def create_oauth_state() -> str:
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)
    payload = {
        "sub": secrets.token_urlsafe(16),
        "exp": expires_at,
        "type": "google_oauth_state",
    }
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


def verify_oauth_state(state_token: str):
    try:
        payload = jwt.decode(state_token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid Google sign-in state.",
        ) from None

    if payload.get("type") != "google_oauth_state":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid Google sign-in state.",
        )


def redirect_with_google_error(message: str):
    return RedirectResponse(
        f"{get_frontend_url()}/#google_error={urllib.parse.quote(message)}",
        status_code=status.HTTP_302_FOUND,
    )


def exchange_google_code(code: str) -> dict:
    payload = urllib.parse.urlencode(
        {
            "code": code,
            "client_id": get_google_client_id(),
            "client_secret": get_google_client_secret(),
            "redirect_uri": get_google_redirect_uri(),
            "grant_type": "authorization_code",
        }
    ).encode("utf-8")
    request = urllib.request.Request(
        GOOGLE_TOKEN_URL,
        data=payload,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            return dict(__import__("json").loads(response.read().decode("utf-8")))
    except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Could not complete Google sign-in.",
        ) from None


def verify_google_id_token(id_token: str) -> dict:
    client_id = get_google_client_id()
    jwks_client = jwt.PyJWKClient(GOOGLE_JWKS_URL)
    signing_key = jwks_client.get_signing_key_from_jwt(id_token)
    claims = jwt.decode(
        id_token,
        signing_key.key,
        algorithms=["RS256"],
        audience=client_id,
        options={"verify_iss": False},
    )

    if claims.get("iss") not in GOOGLE_ISSUERS:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Google sign-in issuer.",
        )

    if not claims.get("email") or not claims.get("sub"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Google account did not return a usable email.",
        )

    return claims


def find_or_create_google_user(claims: dict):
    google_sub = claims["sub"]
    email = normalize_email(claims["email"])
    full_name = (claims.get("name") or email.split("@")[0]).strip()
    email_verified = 1 if claims.get("email_verified") else 0

    existing_google_user = get_user_by_google_sub(google_sub)
    if existing_google_user:
        return existing_google_user

    existing_email_user = get_user_by_email(email)
    if existing_email_user:
        with get_connection() as connection:
            connection.execute(
                """
                UPDATE users
                SET google_sub = ?,
                    auth_provider = CASE
                        WHEN auth_provider = 'password' THEN 'password_google'
                        ELSE auth_provider
                    END,
                    email_verified = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
                """,
                (google_sub, email_verified, existing_email_user["id"]),
            )
            connection.commit()
        return get_user_by_id(existing_email_user["id"])

    validate_signup_email(email)

    with get_connection() as connection:
        cursor = connection.execute(
            """
            INSERT INTO users (
                full_name,
                email,
                password_hash,
                auth_provider,
                google_sub,
                email_verified
            )
            VALUES (?, ?, ?, 'google', ?, ?)
            """,
            (
                full_name,
                email,
                hash_password(secrets.token_urlsafe(32)),
                google_sub,
                email_verified,
            ),
        )
        connection.commit()
        return get_user_by_id(cursor.lastrowid)


def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme)) -> PublicUser:
    if not credentials or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing bearer token.",
        )

    try:
        payload = decode_access_token(credentials.credentials)
        subject = payload.get("sub")
        if not subject:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token.",
            )
        user = get_user_by_id(int(subject))
    except (jwt.InvalidTokenError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token.",
        ) from None

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found.",
        )

    if not user["is_active"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account is disabled.",
        )

    return public_user_from_row(user)


@router.post("/signup", response_model=LoginResponse, status_code=status.HTTP_201_CREATED)
def signup(payload: SignupRequest, request: Request):
    verify_turnstile_token(payload.turnstile_token, request)

    full_name = payload.full_name.strip()
    email = normalize_email(payload.email)

    validate_signup_email(email)

    if not full_name:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Full name is required.",
        )

    if len(payload.password) < 8:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Password must be at least 8 characters.",
        )

    try:
        with get_connection() as connection:
            cursor = connection.execute(
                """
                INSERT INTO users (full_name, email, password_hash)
                VALUES (?, ?, ?)
                """,
                (full_name, email, hash_password(payload.password)),
            )
            connection.commit()
            user = get_user_by_id(cursor.lastrowid)
    except sqlite3.IntegrityError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        ) from None

    access_token = create_access_token(str(user["id"]))
    return LoginResponse(access_token=access_token, user=public_user_from_row(user))


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest, request: Request):
    email = normalize_email(payload.email)

    if get_login_failed_attempts(email) >= LOGIN_CAPTCHA_THRESHOLD:
        verify_turnstile_token(payload.turnstile_token, request)

    user = get_user_by_email(email)

    if not user or not verify_password(payload.password, user["password_hash"]):
        record_login_failure(email)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    if not user["is_active"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account is disabled.",
        )

    access_token = create_access_token(str(user["id"]))
    clear_login_failures(email)
    return LoginResponse(access_token=access_token, user=public_user_from_row(user))


@router.post("/password-reset/request", response_model=PasswordResetStartResponse)
def request_password_reset(payload: PasswordResetRequest, request: Request):
    verify_turnstile_token(payload.turnstile_token, request)

    email = normalize_email(payload.email)
    user = get_user_by_email(email)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No account exists with this email address.",
        )

    if not user["is_active"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account is disabled.",
        )

    otp = create_password_reset_otp(user)
    send_password_reset_email(user["email"], user["full_name"], otp)
    return PasswordResetStartResponse(message="OTP sent. Check your email.")


@router.post("/password-reset/verify", response_model=MessageResponse)
def verify_password_reset_otp(payload: PasswordResetVerifyRequest):
    email = normalize_email(payload.email)
    otp = payload.otp.strip()
    user = get_user_by_email(email)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Wrong OTP. Please try again.",
        )

    reset_otp = get_active_password_reset_otp(user["id"])
    if not reset_otp:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Wrong OTP. Please try again.",
        )

    expires_at = datetime.fromisoformat(reset_otp["expires_at"])
    if expires_at < datetime.now(timezone.utc) or not verify_password(otp, reset_otp["otp_hash"]):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Wrong OTP. Please try again.",
        )

    return MessageResponse(message="OTP verified.")


@router.post("/password-reset/confirm", response_model=MessageResponse)
def confirm_password_reset(payload: PasswordResetConfirmRequest):
    email = normalize_email(payload.email)
    otp = payload.otp.strip()
    user = get_user_by_email(email)

    if len(payload.password) < 8:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Password must be at least 8 characters.",
        )

    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Wrong OTP. Please try again.",
        )

    reset_otp = get_active_password_reset_otp(user["id"])
    if not reset_otp:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Wrong OTP. Please try again.",
        )

    expires_at = datetime.fromisoformat(reset_otp["expires_at"])
    if expires_at < datetime.now(timezone.utc) or not verify_password(otp, reset_otp["otp_hash"]):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Wrong OTP. Please try again.",
        )

    with get_connection() as connection:
        connection.execute(
            """
            UPDATE users
            SET password_hash = ?,
                auth_provider = CASE
                    WHEN auth_provider = 'password_google' THEN 'password_google'
                    ELSE 'password'
                END,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            """,
            (hash_password(payload.password), user["id"]),
        )
        connection.execute(
            """
            UPDATE password_reset_otps
            SET used_at = CURRENT_TIMESTAMP
            WHERE id = ?
            """,
            (reset_otp["id"],),
        )
        connection.commit()

    return MessageResponse(message="Password reset successfully. You can sign in with your new password.")


@router.get("/google/start")
def google_start():
    if not get_google_client_id() or not get_google_client_secret():
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Google OAuth is not configured.",
        )

    query = urllib.parse.urlencode(
        {
            "client_id": get_google_client_id(),
            "redirect_uri": get_google_redirect_uri(),
            "response_type": "code",
            "scope": "openid email profile",
            "state": create_oauth_state(),
            "access_type": "online",
            "prompt": "select_account",
        }
    )
    return RedirectResponse(f"{GOOGLE_AUTH_URL}?{query}", status_code=status.HTTP_302_FOUND)


@router.get("/google/callback")
def google_callback(code: str = "", state: str = "", error: str = ""):
    if error:
        return redirect_with_google_error("Google sign-in was cancelled.")

    if not code or not state:
        return redirect_with_google_error("Google sign-in did not return the required data.")

    try:
        verify_oauth_state(state)
        token_response = exchange_google_code(code)
        id_token = token_response.get("id_token")
        if not id_token:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Google did not return an identity token.",
            )

        claims = verify_google_id_token(id_token)
        user = find_or_create_google_user(claims)
        if not user["is_active"]:
            return redirect_with_google_error("This account is disabled.")

        access_token = create_access_token(str(user["id"]))
        return RedirectResponse(
            f"{get_frontend_url()}/#google_token={urllib.parse.quote(access_token)}",
            status_code=status.HTTP_302_FOUND,
        )
    except HTTPException as exc:
        return redirect_with_google_error(str(exc.detail))


@router.get("/me", response_model=PublicUser)
def me(current_user: PublicUser = Depends(get_current_user)):
    return current_user


@router.patch("/me", response_model=PublicUser)
def update_me(
    payload: ProfileUpdateRequest,
    current_user: PublicUser = Depends(get_current_user),
):
    full_name = payload.full_name.strip()
    if not full_name:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Full name cannot be empty.",
        )

    with get_connection() as connection:
        connection.execute(
            """
            UPDATE users
            SET full_name = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            """,
            (full_name, current_user.id),
        )
        connection.commit()

    user = get_user_by_id(current_user.id)
    return public_user_from_row(user)
