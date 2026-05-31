# TailorHub — Next-Level Prompts (Split)

This folder contains the master upgrade prompt split into 4 standalone files. Each file is **self-contained** — paste any one of them into your AI assistant (Cursor / Copilot / Claude Code / etc.) and it has everything it needs to do that Part's work.

## Run order

| File | Hours | What it does | Why run in this order |
|------|------|--------------|----------------------|
| `Part_A_Tests.md` | ~10 | Backend pytest + frontend Vitest suites | Safety net before everything else |
| `Part_B_Deploy_CI.md` | ~7 | Dockerfile, render.yaml, vercel.json, GitHub Actions | Now CI guards every PR |
| `Part_C_Polish.md` | ~23 | README audit, Bootstrap cleanup, audit log, notifications, stock decrement, refund flow | Production polish; each subsection independent |
| `Part_D_Wow_Features.md` | 8–14 | Pick 2 of 5 (AI measurements + analytics recommended) | Demo impact, optional |

**Core (A + B + C): ~40 hours.** With 2 wow features: **~54 hours.**

## How to use each file

1. Open the Part file you want to run next.
2. Copy the **entire file** into your AI assistant chat.
3. Add this instruction at the end:
   > *"Start with the first item. After each item is complete, stop and report. Do not start the next item until I tell you to."*
4. Review the AI's work after each item before greenlighting the next.

## Three-strategy guide

- **Cautious (recommended)**: Run A first → verify tests pass → then B → then C subsections one at a time → then D.
- **Aggressive**: Paste A + B together; let it work through both with stops between items.
- **Demo-only**: If you're short on time, just run A1 (backend tests) + B1 (Dockerfile) + B4 (CI) + C1 (README audit) + D2 (AI measurements) or D3 (analytics). That's ~24 hours and gets you a tested, deployable, demoable project.

## Rules every Part shares

- **Never** edit an existing Alembic migration — always `alembic revision --autogenerate -m "<name>"`. Current head is `e8e959ff5e42` (brand column).
- **Never** use `fetch()` directly — every API call goes through `src/lib/api.jsx` `apiRequest()`.
- **Never** hardcode English strings — every user-facing text uses `t('prefix.key', 'fallback')` with parallel `en` + `ur` entries in `src/context/LanguageContext.jsx`.
- **Never** rename localStorage keys (`tailorhub-auth-token`, `tailorhub-auth-session`) — would orphan logged-in users.
- **Never** introduce a new state library, HTTP client, toast library, or CSS framework. Use what's installed.

## After each Part

Append a "Feature N" entry to `CHANGES.md` in the existing style. Example:

```markdown
### Feature 6: Audit Log
- **Files added**: `backend/app/middleware_audit.py`, `backend/app/routers_audit.py`, frontend admin tab
- **Tables added**: `audit_log`
- **Migration**: `alembic/versions/<hash>_add_audit_log.py`
- **Tests**: `test_admin_delete_is_audited` in `test_orders.py`
```

---

*Each Part file repeats the project context + working conventions so they stand alone.*
