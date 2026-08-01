"""AI Training — a teaching turn scoped to one curriculum section.

Deliberately simpler than the mentor graph in nodes.py/graph.py: there is no
routing (always the same teacher voice), no Response Guard (no policy or
solution fingerprint to validate against — see prompts.build_teaching_system_prompt
for why), and no retry-on-rejection loop. Pydantic validation of TeachResponse
is the safety net for malformed model output.
"""

from __future__ import annotations

from app.agents import prompts
from app.core.logging import log
from app.models.providers import ProviderError, parse_json_object
from app.models.router import TaskClass, router
from app.schemas import ConceptEnvelope, TeachResponse, TextBlock


async def run(envelope: ConceptEnvelope) -> TeachResponse:
    user_prompt, flagged = prompts.build_teaching_user_prompt(envelope)
    system_prompt = prompts.build_teaching_system_prompt(envelope, hardened=flagged)

    if flagged:
        log.warning("teaching_injection_pattern_flagged", user_id=envelope.userId, section=envelope.section.slug)

    try:
        completion = await router.generate(
            task=TaskClass.REASON,
            system=system_prompt,
            user=user_prompt,
            max_tokens=1100,
            temperature=0.4,
            json_mode=True,
        )
    except ProviderError as exc:
        log.info("teaching_generation_failed", error=str(exc), section=envelope.section.slug)
        raise

    payload = parse_json_object(completion.text)
    blocks = payload.get("blocks") or [{"type": "text", "content": completion.text[:1500]}]
    try:
        return TeachResponse(
            blocks=blocks,
            followUp=payload.get("followUp"),
            readyForPractice=bool(payload.get("readyForPractice", False)),
        )
    except Exception:  # noqa: BLE001 — malformed model output, fall back to raw text
        return TeachResponse(
            blocks=[TextBlock(content=completion.text[:1500])],
            followUp=None,
            readyForPractice=False,
        )
