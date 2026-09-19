from __future__ import annotations

import json
from typing import Any
from urllib.parse import quote

import httpx

from config import Settings


class RedisQueue:
    """Upstash REST client. Redis is the queue, not the source of truth."""

    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self._client = httpx.Client(
            base_url=settings.upstash_url,
            headers={"Authorization": f"Bearer {settings.upstash_token}"},
            timeout=20,
        )

    def command(self, *parts: str) -> Any:
        path = "/".join(quote(str(part), safe="") for part in parts)
        response = self._client.post(f"/{path}")
        response.raise_for_status()
        payload = response.json()
        return payload.get("result")

    def pipeline(self, commands: list[list[str]]) -> Any:
        response = self._client.post("/pipeline", json=commands)
        response.raise_for_status()
        return response.json()

    def push_job(self, job: dict[str, Any]) -> None:
        self.command("LPUSH", self.settings.queue_key, json.dumps(job))

    def pop_job(self) -> dict[str, Any] | None:
        raw = self.command("RPOPLPUSH", self.settings.queue_key, self.settings.processing_key)
        if not raw:
            return None
        encoded = raw if isinstance(raw, str) else json.dumps(raw)
        job = raw if isinstance(raw, dict) else json.loads(raw)
        job["_raw"] = encoded
        return job

    def _payload(self, job: dict[str, Any]) -> str:
        if job.get("_raw"):
            return str(job["_raw"])
        return json.dumps({key: value for key, value in job.items() if key != "_raw"})

    def ack(self, job: dict[str, Any]) -> None:
        self.command("LREM", self.settings.processing_key, "1", self._payload(job))

    def retry_later(self, job: dict[str, Any], score: float) -> None:
        encoded = self._payload(job)
        self.command("LREM", self.settings.processing_key, "1", encoded)
        retry = {key: value for key, value in job.items() if key != "_raw"}
        self.command("ZADD", self.settings.delayed_key, str(score), json.dumps(retry))

    def dead_letter(self, job: dict[str, Any]) -> None:
        encoded = self._payload(job)
        self.command("LREM", self.settings.processing_key, "1", encoded)
        self.command("LPUSH", self.settings.dead_key, encoded)

    def promote_delayed(self, now: float) -> int:
        due = self.command("ZRANGEBYSCORE", self.settings.delayed_key, "0", str(now)) or []
        moved = 0
        for raw in due:
            self.command("ZREM", self.settings.delayed_key, raw)
            self.command("LPUSH", self.settings.queue_key, raw)
            moved += 1
        return moved

    def reclaim_stale(self, max_keep: int = 20) -> int:
        items = self.command("LRANGE", self.settings.processing_key, "0", str(max_keep - 1)) or []
        # Visibility timeout is handled in SQL locked_at; Redis reclaim is conservative.
        return len(items)
