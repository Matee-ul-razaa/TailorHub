"""
Validators – Password policy & email validation helpers
────────────────────────────────────────────────────────
Uses Python stdlib `re` module for password rules and
`email-validator` library for robust email verification.
"""

import re
from email_validator import validate_email, EmailNotValidError


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
    Checks syntax and (optionally) deliverability of the domain.
    Returns (valid: bool, normalized_email_or_error: str).
    """
    try:
        result = validate_email(email, check_deliverability=True)
        return True, result.normalized
    except EmailNotValidError as e:
        return False, str(e)
