"""
Rate Limiter – In-memory login attempt tracker
───────────────────────────────────────────────
Uses Python stdlib `threading` for thread safety
and `collections.defaultdict` for clean storage.
"""

import threading
from collections import defaultdict
from datetime import datetime, timedelta, timezone


# Max failed login attempts before lockout
MAX_FAILED_ATTEMPTS = 5
# Lockout window
LOCKOUT_MINUTES = 15


# { email: [ datetime, datetime, ... ] }
_failed_attempts: dict[str, list[datetime]] = defaultdict(list)
_lock = threading.Lock()


def check_rate_limit(email: str) -> tuple[bool, str]:
    """
    Check if the email is currently rate-limited.
    Returns (allowed: bool, message: str).
    """
    email_lower = email.lower()
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(minutes=LOCKOUT_MINUTES)

    with _lock:
        # Prune old entries
        _failed_attempts[email_lower] = [
            t for t in _failed_attempts[email_lower] if t > cutoff
        ]
        count = len(_failed_attempts[email_lower])

        if count >= MAX_FAILED_ATTEMPTS:
            remaining = LOCKOUT_MINUTES - int((now - _failed_attempts[email_lower][0]).total_seconds() / 60)
            return False, f"Too many login attempts. Please try again in {max(remaining, 1)} minutes."

    return True, ""


def record_failed_attempt(email: str) -> None:
    """Record a failed login attempt for rate-limiting."""
    with _lock:
        _failed_attempts[email.lower()].append(datetime.now(timezone.utc))


def clear_failed_attempts(email: str) -> None:
    """Clear failed attempts on successful login."""
    with _lock:
        _failed_attempts.pop(email.lower(), None)
