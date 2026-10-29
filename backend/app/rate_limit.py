"""
rate_limit.py

A small per-user sliding-window limiter for the expensive endpoints (OCR upload, confirm,
recommendation generation). In-memory and per worker process: it bounds how hard one
signed-in account can push a single worker, which is what protects OCR CPU. It is NOT a
substitute for edge/IP rate limiting (put one at the reverse proxy; see docs/DEPLOYMENT.md),
and it does not share state between workers.
"""
from __future__ import annotations

import threading
import time
from collections import defaultdict, deque

from fastapi import Depends, HTTPException, status

from app.dependencies import AuthenticatedUser, get_current_user


class SlidingWindowLimiter:
    def __init__(self, max_calls: int, window_seconds: float):
        self.max_calls = max_calls
        self.window = window_seconds
        self._calls: dict[str, deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def check(self, key: str) -> float | None:
        """Record a call; return seconds to wait if the limit is exceeded, else None."""
        now = time.monotonic()
        with self._lock:
            q = self._calls[key]
            while q and now - q[0] >= self.window:
                q.popleft()
            if len(q) >= self.max_calls:
                return max(0.0, self.window - (now - q[0]))
            q.append(now)
            if not q:  # pragma: no cover - defensive
                del self._calls[key]
            return None

    def reset(self) -> None:
        with self._lock:
            self._calls.clear()


def limit_per_user(limiter: SlidingWindowLimiter):
    """FastAPI dependency factory. Runs after authentication so the key is the verified user id."""

    def dependency(user: AuthenticatedUser = Depends(get_current_user)) -> AuthenticatedUser:
        wait = limiter.check(user.user_id)
        if wait is not None:
            raise HTTPException(
                status.HTTP_429_TOO_MANY_REQUESTS,
                "Too many requests. Please wait a moment and try again.",
                headers={"Retry-After": str(int(wait) + 1)},
            )
        return user

    return dependency


# 20 uploads / confirmations / recommendation generations per minute per account.
heavy_limiter = SlidingWindowLimiter(max_calls=20, window_seconds=60)
limit_heavy = limit_per_user(heavy_limiter)
