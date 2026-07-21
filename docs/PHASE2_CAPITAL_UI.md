# Phase 2 — capital_v2 first-class UI

**Date:** 2026-07-21  
**App:** LuminaNT  
**Status:** Implemented (flag-on ready)

## What changed

### Plan / Bankroll (Ops → **Plan**)
- New view `capital` with `CapitalPlanPanel`
- Live equity / secure / working / liquid / unit / remaining
- size_mode badge + Unfreeze (confirm)
- DD progress bars to 15% REDUCED and 25% FREEZE
- Day/week loss rooms + 18% open room
- Active rules chips (unit ladder, secure buffer, stops)
- Secure transfer table + freeze audit

### Shortlist (Research → **Shortlist**)
- Card grid from `PLACE_THESE.md` + recent capital_v2 ledger tickets
- Metrics: odds, stake, EV, p_model, size_mode, unit, grade
- Status reasons (open / win / loss / abandoned / planned)
- Click → Ledger forensic case file

### Desk
- Live Equity hero bar when capital_v2 on
- Prominent **Unfreeze** + **Bankroll plan** actions
- Strip polish (clearer chips, gold top edge)

### UX fixes
- Settlement / Match date toggles: high-contrast primary gold active state
- Research tabs: gold active pill
- Tauri loads `capital_segments.json` + `stake_decisions.jsonl`

## Files
See checkpoint list in operator response.

## Verify
1. Connect tracker with capital_v2 enabled  
2. Ops → Plan · Research → Shortlist · Desk Live Equity  
3. Confirm SECURE / MODE / rooms on strip when risk.json has v2 fields  
