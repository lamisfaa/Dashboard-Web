import os
import warnings
import urllib.error
import urllib.parse
import urllib.request

from fastapi import HTTPException, Request, status


TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"


def get_turnstile_secret_key() -> str:
    return os.getenv("TURNSTILE_SECRET_KEY", "").strip()


def is_turnstile_enabled() -> bool:
    return os.getenv("TURNSTILE_ENABLED", "").strip().lower() == "true"


def is_turnstile_required() -> bool:
    return os.getenv("TURNSTILE_REQUIRED", "").strip().lower() == "true"


def get_client_ip(request: Request) -> str | None:
    cf_ip = request.headers.get("CF-Connecting-IP")
    forwarded_for = request.headers.get("X-Forwarded-For")
    if cf_ip:
        return cf_ip.strip()
    if forwarded_for:
        return forwarded_for.split(",", 1)[0].strip()
    if request.client:
        return request.client.host
    return None


def verify_turnstile_token(token: str | None, request: Request) -> None:
    secret_key = get_turnstile_secret_key()
    if (
        not is_turnstile_enabled()
        or not is_turnstile_required()
        or not secret_key
        or secret_key.startswith("your_")
    ):
        warnings.warn(
            "Turnstile is disabled, optional, or not configured; CAPTCHA verification is bypassed.",
            RuntimeWarning,
            stacklevel=2,
        )
        return

    if not token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="CAPTCHA verification is required.",
        )

    payload = {
        "secret": secret_key,
        "response": token,
    }
    remote_ip = get_client_ip(request)
    if remote_ip:
        payload["remoteip"] = remote_ip

    encoded_payload = urllib.parse.urlencode(payload).encode("utf-8")
    verify_request = urllib.request.Request(
        TURNSTILE_VERIFY_URL,
        data=encoded_payload,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(verify_request, timeout=10) as response:
            result = dict(__import__("json").loads(response.read().decode("utf-8")))
    except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Could not verify CAPTCHA. Please try again.",
        ) from None

    if not result.get("success"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="CAPTCHA verification failed. Please try again.",
        )
