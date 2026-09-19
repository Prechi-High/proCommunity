from __future__ import annotations

import json
import logging
import os
import sys


def configure_logging() -> logging.Logger:
    level = os.environ.get("LOG_LEVEL", "INFO").upper()
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(logging.Formatter("%(message)s"))
    logger = logging.getLogger("asr_worker")
    logger.setLevel(level)
    logger.handlers = [handler]
    logger.propagate = False
    return logger


def log_event(logger: logging.Logger, **fields: object) -> None:
    safe = {key: value for key, value in fields.items() if key.lower() not in {
        "token", "key", "authorization", "secret", "password", "transcript",
    }}
    logger.info(json.dumps(safe, default=str))
