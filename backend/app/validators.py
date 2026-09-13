"""
Validators – Password policy & email validation helpers
────────────────────────────────────────────────────────
Uses Python stdlib `re` module for password rules and
`email-validator` library for robust email verification.
"""

import re
from email_validator import validate_email, EmailNotValidError


# ── Disposable / temporary email providers ──────────────────────────────────
# We refuse signups from these known throw-away mailbox domains so that
# spam / abusive accounts cannot be created and verified.
# Source: common public lists (extend as needed).
DISPOSABLE_EMAIL_DOMAINS: frozenset[str] = frozenset({
    "mailinator.com", "mailinator.net", "mailinator2.com",
    "10minutemail.com", "10minutemail.net", "guerrillamail.com",
    "guerrillamail.net", "guerrillamail.org", "guerrillamail.biz",
    "guerrillamail.de", "sharklasers.com", "grr.la", "spam4.me",
    "tempmail.com", "temp-mail.org", "temp-mail.io", "tempmail.io",
    "tempmail.net", "tempmailo.com", "tempinbox.com",
    "throwawaymail.com", "throwaway.email", "yopmail.com", "yopmail.fr",
    "yopmail.net", "trashmail.com", "trashmail.net", "trashmail.de",
    "getairmail.com", "getnada.com", "nada.email",
    "fakeinbox.com", "fakemail.net", "fakemailgenerator.com",
    "dispostable.com", "maildrop.cc", "mintemail.com",
    "mohmal.com", "anonbox.net", "discard.email",
    "33mail.com", "spamgourmet.com", "burnermail.io",
    "emailondeck.com", "emltmp.com", "spambox.us",
    "mailcatch.com", "tempinbox.co.uk", "tempemail.net",
    "tempemail.co", "tempmailaddress.com", "tempr.email",
    "mytemp.email", "linshiyou.com", "moakt.com",
    "spamdecoy.net", "incognitomail.org", "deadaddress.com",
    "noclickemail.com", "dropmail.me", "minuteinbox.com",
    "fakermail.com", "fakemail.fr", "harakirimail.com",
    "instant-mail.de", "anonymbox.com", "mvrht.net",
    "tempr.email", "mailtemp.info", "spamfree24.org",
})


def is_disposable_email(email: str) -> bool:
    """Return True if the email belongs to a known disposable provider."""
    if not email or "@" not in email:
        return False
    domain = email.rsplit("@", 1)[-1].strip().lower()
    return domain in DISPOSABLE_EMAIL_DOMAINS


def validate_password_strength(password: str) -> tuple[bool, str]:
    """
    Enforce password policy:
      - Minimum 8 characters
      - At least 1 uppercase letter
      - At least 1 lowercase letter
      - At least 1 digit
    Returns (valid: bool, message: str).
    """
    if len(password) < 8:
        return False, "Password must be at least 8 characters long."
    if not re.search(r"[A-Z]", password):
        return False, "Password must include at least one uppercase letter."
    if not re.search(r"[a-z]", password):
        return False, "Password must include at least one lowercase letter."
    if not re.search(r"\d", password):
        return False, "Password must include at least one digit."
    return True, "Password is strong."


def validate_email_address(email: str) -> tuple[bool, str]:
    """
    Validate email format using the email-validator library.
    Checks syntax, deliverability of the domain, and rejects known
    disposable / temporary email providers used for spam signups.
    Returns (valid: bool, normalized_email_or_error: str).
    """
    try:
        result = validate_email(email, check_deliverability=True)
        normalized = result.normalized
    except EmailNotValidError as e:
        return False, str(e)

    # Block disposable / throw-away mailboxes
    if is_disposable_email(normalized):
        return False, (
            "Disposable or temporary email addresses are not allowed. "
            "Please use a permanent email address."
        )

    return True, normalized
