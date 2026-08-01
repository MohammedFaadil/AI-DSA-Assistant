"""Semantic cache for Stage-2 responses.

Keyed on a STRUCTURAL fingerprint of the code, not its text — variable renames,
whitespace and comments do not change the key. So twenty learners writing the
same O(n²) two-sum in different styles all hit the same cached
"have you considered what a hash map buys you here?" response.

Personalised responses (anything that referenced the learner model) are
excluded, because those must never cross users.
"""

from __future__ import annotations

import hashlib
import time
from collections import OrderedDict
from typing import Any

from app.agents.fingerprint import fingerprint
from app.core.config import settings


class SemanticCache:
    def __init__(self, max_size: int = 400) -> None:
        self._store: OrderedDict[str, tuple[float, Any]] = OrderedDict()
        self.max_size = max_size
        self.hits = 0
        self.misses = 0

    @staticmethod
    def key(
        *,
        problem_id: str,
        code: str,
        trigger: str,
        assist_mode: str,
        hint_level: int | None,
    ) -> str:
        structural = fingerprint(code)
        digest = hashlib.sha256(structural.encode()).hexdigest()[:24]
        return f"{problem_id}:{digest}:{trigger}:{assist_mode}:{hint_level}"

    def get(self, key: str) -> Any | None:
        entry = self._store.get(key)
        if not entry:
            self.misses += 1
            return None
        expires_at, value = entry
        if expires_at < time.time():
            del self._store[key]
            self.misses += 1
            return None
        self._store.move_to_end(key)
        self.hits += 1
        return value

    def set(self, key: str, value: Any) -> None:
        if key in self._store:
            del self._store[key]
        elif len(self._store) >= self.max_size:
            self._store.popitem(last=False)
        self._store[key] = (time.time() + settings.semantic_cache_ttl, value)

    @property
    def hit_rate(self) -> float:
        total = self.hits + self.misses
        return round(self.hits / total, 3) if total else 0.0

    def stats(self) -> dict:
        return {
            "size": len(self._store),
            "hits": self.hits,
            "misses": self.misses,
            "hitRate": self.hit_rate,
        }


semantic_cache = SemanticCache()
completion_cache = SemanticCache(max_size=600)
