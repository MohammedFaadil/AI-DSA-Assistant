"""Model routing: task class → tier → provider chain → circuit breaker.

Two properties matter here and both are deliberate:

  1. Every chain terminates in a NON-LLM fallback. There is no path where a
     provider outage produces an error toast instead of a useful response.
  2. Model ids come from configuration, not code, so switching providers when
     one rate-limits is an env change and a restart — never a deploy.
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field

from app.core.config import settings
from app.core.logging import log
from app.models.providers import Completion, ProviderError, build_providers


class TaskClass:
    REASON = "reason"
    FAST = "fast"
    TINY = "tiny"
    CODE = "code"


# Provider preference per tier. The first available one wins; the rest are
# failover in order.
TIER_CHAINS: dict[str, list[str]] = {
    TaskClass.REASON: ["openrouter", "groq", "together", "ollama"],
    TaskClass.FAST: ["groq", "openrouter", "together", "ollama"],
    TaskClass.CODE: ["groq", "openrouter", "together", "ollama"],
    TaskClass.TINY: ["groq", "openrouter", "ollama"],
}


def model_for(task: str) -> str:
    if task == TaskClass.REASON:
        return settings.model_tier_reason
    if task == TaskClass.TINY:
        return settings.model_tier_tiny
    return settings.model_tier_fast


@dataclass
class Breaker:
    failures: int = 0
    open_until: float = 0.0

    def is_open(self) -> bool:
        return self.open_until > time.time()


@dataclass
class UsageLedger:
    """Daily token accounting. At 100% the system degrades to Stage-1-only
    mentoring, which is still a genuinely useful product."""

    day: str = ""
    tokens: int = 0
    requests: int = 0
    failures: int = 0
    by_model: dict[str, int] = field(default_factory=dict)

    def record(self, model: str, tokens: int) -> None:
        today = time.strftime("%Y-%m-%d")
        if self.day != today:
            self.day, self.tokens, self.requests, self.by_model = today, 0, 0, {}
        self.tokens += tokens
        self.requests += 1
        self.by_model[model] = self.by_model.get(model, 0) + tokens

    @property
    def exhausted(self) -> bool:
        return self.tokens >= settings.daily_token_budget


class ModelRouter:
    def __init__(self) -> None:
        self.providers = build_providers()
        self.breakers: dict[str, Breaker] = {name: Breaker() for name in self.providers}
        self.usage = UsageLedger()

    @property
    def any_available(self) -> bool:
        return any(p.available for p in self.providers.values())

    def _chain(self, task: str) -> list[str]:
        return [
            name
            for name in TIER_CHAINS.get(task, TIER_CHAINS[TaskClass.FAST])
            if self.providers[name].available and not self.breakers[name].is_open()
        ]

    def _record_failure(self, name: str, rate_limited: bool, retry_after: int) -> None:
        breaker = self.breakers[name]
        if rate_limited:
            # A 429 opens the breaker immediately — retrying just burns the
            # daily quota faster.
            breaker.open_until = time.time() + max(retry_after, 30)
            breaker.failures = 0
            log.warning("provider_rate_limited", provider=name, retry_after=retry_after)
            return
        breaker.failures += 1
        if breaker.failures >= 5:
            breaker.open_until = time.time() + 60
            breaker.failures = 0
            log.warning("provider_circuit_opened", provider=name)

    async def generate(
        self,
        *,
        task: str,
        system: str,
        user: str,
        max_tokens: int = 900,
        temperature: float = 0.4,
        json_mode: bool = False,
        stop: list[str] | None = None,
    ) -> Completion:
        if self.usage.exhausted:
            raise ProviderError("daily token budget exhausted")

        chain = self._chain(task)
        if not chain:
            raise ProviderError("no model provider is available")

        model = model_for(task)
        last: Exception | None = None

        for name in chain:
            provider = self.providers[name]
            try:
                completion = await provider.generate(
                    model=model,
                    system=system,
                    user=user,
                    max_tokens=max_tokens,
                    temperature=temperature,
                    json_mode=json_mode,
                    stop=stop,
                )
                self.breakers[name].failures = 0
                self.usage.record(
                    completion.model, completion.prompt_tokens + completion.completion_tokens
                )
                return completion
            except ProviderError as exc:
                last = exc
                self._record_failure(name, exc.rate_limited, exc.retry_after)
                log.info("provider_failed_trying_next", provider=name, error=str(exc))

        self.usage.failures += 1
        raise last or ProviderError("all providers failed")

    def status(self) -> dict:
        return {
            "available": self.any_available,
            "providers": {
                name: {
                    "configured": provider.available,
                    "circuit_open": self.breakers[name].is_open(),
                }
                for name, provider in self.providers.items()
            },
            "usage": {
                "day": self.usage.day,
                "tokens": self.usage.tokens,
                "requests": self.usage.requests,
                "budget": settings.daily_token_budget,
                "exhausted": self.usage.exhausted,
            },
        }


router = ModelRouter()
