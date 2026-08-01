"""Service-to-service authentication.

The AI service is never exposed to browsers, so there is no session to carry.
Requests from the API are signed with HMAC-SHA256 over (timestamp, body) with a
60-second replay window.
"""

from __future__ import annotations

import hashlib
import hmac
import time

from fastapi import HTTPException, Request

from app.core.config import settings

REPLAY_WINDOW_S = 60


def _sign(body: bytes, timestamp: str) -> str:
    return hmac.new(
        settings.ai_service_hmac_secret.encode(),
        f"{timestamp}.".encode() + body,
        hashlib.sha256,
    ).hexdigest()


async def verify_request(request: Request) -> bytes:
    """Returns the raw body after verifying the signature."""
    body = await request.body()

    if not settings.require_signature:
        return body

    timestamp = request.headers.get("x-timestamp")
    signature = request.headers.get("x-signature")
    if not timestamp or not signature:
        raise HTTPException(status_code=401, detail="Missing signature headers.")

    try:
        age = abs(time.time() * 1000 - float(timestamp))
    except ValueError as exc:
        raise HTTPException(status_code=401, detail="Malformed timestamp.") from exc

    if age > REPLAY_WINDOW_S * 1000:
        raise HTTPException(status_code=401, detail="Signature expired.")

    if not hmac.compare_digest(_sign(body, timestamp), signature):
        raise HTTPException(status_code=401, detail="Bad signature.")

    return body
