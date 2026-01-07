"""
Simple in-memory rate limiter for API endpoints
"""
from datetime import datetime, timedelta
from typing import Dict, Tuple
from collections import defaultdict
import asyncio
import logging

logger = logging.getLogger(__name__)


class RateLimiter:
    """Simple in-memory rate limiter using sliding window"""

    def __init__(self):
        # Store: {key: [(timestamp, count), ...]}
        self._store: Dict[str, list] = defaultdict(list)
        self._cleanup_task = None

    def start_cleanup(self):
        """Start background cleanup task"""
        if self._cleanup_task is None:
            self._cleanup_task = asyncio.create_task(self._cleanup_loop())

    async def _cleanup_loop(self):
        """Periodically clean up old entries"""
        while True:
            try:
                await asyncio.sleep(300)  # Clean up every 5 minutes
                now = datetime.utcnow()
                keys_to_delete = []

                for key, timestamps in self._store.items():
                    # Remove timestamps older than 1 hour
                    cutoff = now - timedelta(hours=1)
                    self._store[key] = [ts for ts in timestamps if ts > cutoff]

                    # Mark empty keys for deletion
                    if not self._store[key]:
                        keys_to_delete.append(key)

                for key in keys_to_delete:
                    del self._store[key]

                logger.debug(f"Rate limiter cleanup: removed {len(keys_to_delete)} keys")

            except Exception as e:
                logger.error(f"Rate limiter cleanup error: {e}")

    def check_rate_limit(
        self,
        key: str,
        max_requests: int,
        window_seconds: int
    ) -> Tuple[bool, int, int]:
        """
        Check if request is within rate limit

        Args:
            key: Unique identifier (e.g., user_id, IP)
            max_requests: Maximum requests allowed in window
            window_seconds: Time window in seconds

        Returns:
            Tuple of (allowed: bool, remaining: int, reset_seconds: int)
        """
        now = datetime.utcnow()
        window_start = now - timedelta(seconds=window_seconds)

        # Clean old timestamps
        self._store[key] = [ts for ts in self._store[key] if ts > window_start]

        # Count requests in current window
        current_count = len(self._store[key])

        if current_count >= max_requests:
            # Rate limit exceeded
            oldest_request = min(self._store[key]) if self._store[key] else now
            reset_in = int((oldest_request + timedelta(seconds=window_seconds) - now).total_seconds())
            return False, 0, max(reset_in, 0)

        # Allow request and record timestamp
        self._store[key].append(now)
        remaining = max_requests - (current_count + 1)

        return True, remaining, window_seconds


# Global rate limiter instance
rate_limiter = RateLimiter()


def get_rate_limiter() -> RateLimiter:
    """Get the global rate limiter instance"""
    return rate_limiter
