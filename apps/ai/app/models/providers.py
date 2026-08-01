"""LLM providers behind one interface.

Every provider here speaks the OpenAI chat-completions shape, so adding
Together, a local Ollama, or a future self-hosted fine-tune is a new entry in
this file plus a routing-table row — no agent, graph or schema changes. That is
what makes the fine-tuning path in docs 07 §11 a swap rather than a rebuild.
"""

from __future__ import annotations

import json
import time
from dataclasses import dataclass

import httpx

from app.core.config import settings
from app.core.logging import log


@dataclass
class Completion:
    text: str
    model: str
    prompt_tokens: int
    completion_tokens: int
    latency_ms: int


class ProviderError(Exception):
    def __init__(self, message: str, *, rate_limited: bool = False, retry_after: int = 0) -> None:
        super().__init__(message)
        self.rate_limited = rate_limited
        self.retry_after = retry_after


class OpenAICompatibleProvider:
    def __init__(self, name: str, base_url: str, api_key: str | None, extra_headers: dict | None = None):
        self.name = name
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.extra_headers = extra_headers or {}

    @property
    def available(self) -> bool:
        return bool(self.api_key)

    async def generate(
        self,
        *,
        model: str,
        system: str,
        user: str,
        max_tokens: int = 900,
        temperature: float = 0.4,
        json_mode: bool = False,
        stop: list[str] | None = None,
    ) -> Completion:
        headers = {"content-type": "application/json", **self.extra_headers}
        if self.api_key:
            headers["authorization"] = f"Bearer {self.api_key}"

        payload: dict = {
            "model": model,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "max_tokens": max_tokens,
            "temperature": temperature,
        }
        if json_mode:
            payload["response_format"] = {"type": "json_object"}
        if stop:
            payload["stop"] = stop

        started = time.perf_counter()
        try:
            async with httpx.AsyncClient(timeout=settings.request_timeout_s) as client:
                response = await client.post(
                    f"{self.base_url}/chat/completions", headers=headers, json=payload
                )
        except httpx.HTTPError as exc:
            raise ProviderError(f"{self.name} unreachable: {exc}") from exc

        if response.status_code == 429:
            retry_after = int(response.headers.get("retry-after", "30") or 30)
            raise ProviderError(f"{self.name} rate limited", rate_limited=True, retry_after=retry_after)
        if response.status_code >= 400:
            raise ProviderError(f"{self.name} returned {response.status_code}: {response.text[:200]}")

        body = response.json()
        try:
            text = body["choices"][0]["message"]["content"] or ""
        except (KeyError, IndexError, TypeError) as exc:
            raise ProviderError(f"{self.name} returned an unexpected body") from exc

        usage = body.get("usage") or {}
        return Completion(
            text=text,
            model=body.get("model", model),
            prompt_tokens=int(usage.get("prompt_tokens", 0)),
            completion_tokens=int(usage.get("completion_tokens", 0)),
            latency_ms=int((time.perf_counter() - started) * 1000),
        )

    async def healthy(self) -> bool:
        if not self.available:
            return False
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                headers = {"authorization": f"Bearer {self.api_key}"} if self.api_key else {}
                response = await client.get(f"{self.base_url}/models", headers=headers)
                return response.status_code < 400
        except httpx.HTTPError:
            return False


class OllamaProvider(OpenAICompatibleProvider):
    """Local Qwen2.5-Coder via Ollama. Optional by design — a zero-cost,
    zero-network option for offline development and the staging ground for a
    future fine-tune."""

    def __init__(self) -> None:
        super().__init__("ollama", f"{settings.ollama_url}/v1", None)

    @property
    def available(self) -> bool:
        return settings.enable_ollama


def build_providers() -> dict[str, OpenAICompatibleProvider]:
    providers = {
        "openrouter": OpenAICompatibleProvider(
            "openrouter",
            settings.openrouter_url,
            settings.openrouter_api_key,
            {
                # OpenRouter uses these for attribution and free-tier ranking.
                "HTTP-Referer": "https://aidsamentor.app",
                "X-Title": "AI DSA Mentor",
            },
        ),
        "groq": OpenAICompatibleProvider("groq", settings.groq_url, settings.groq_api_key),
        "together": OpenAICompatibleProvider(
            "together", settings.together_url, settings.together_api_key
        ),
        "ollama": OllamaProvider(),
    }
    enabled = [name for name, provider in providers.items() if provider.available]
    log.info("providers_configured", enabled=enabled)
    return providers


def parse_json_object(text: str) -> dict:
    """Models wrap JSON in prose and fences no matter how firmly you ask.

    Rather than reject a good answer over formatting, extract the outermost
    object. If that fails the caller treats it as a schema violation and the
    Guard's retry path handles it.
    """
    stripped = text.strip()
    if stripped.startswith("```"):
        stripped = stripped.split("```", 2)[1] if stripped.count("```") >= 2 else stripped
        if stripped.startswith("json"):
            stripped = stripped[4:]
    start = stripped.find("{")
    end = stripped.rfind("}")
    if start == -1 or end == -1 or end <= start:
        raise ValueError("no JSON object in response")
    return json.loads(stripped[start : end + 1])
