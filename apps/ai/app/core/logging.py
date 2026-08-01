"""Structured JSON logging with request-id correlation.

The same X-Request-Id that the API generates is threaded through here, so one
user action can be traced across web → api → ai → provider.
"""

from __future__ import annotations

import logging
import sys
from contextvars import ContextVar

import structlog

request_id_var: ContextVar[str] = ContextVar("request_id", default="-")


def _add_request_id(_logger: object, _name: str, event_dict: dict) -> dict:
    event_dict["request_id"] = request_id_var.get()
    event_dict["service"] = "ai"
    return event_dict


def configure_logging(level: str = "INFO") -> None:
    logging.basicConfig(format="%(message)s", stream=sys.stdout, level=level.upper())
    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            _add_request_id,
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(
            getattr(logging, level.upper(), logging.INFO)
        ),
        cache_logger_on_first_use=True,
    )


log = structlog.get_logger()
