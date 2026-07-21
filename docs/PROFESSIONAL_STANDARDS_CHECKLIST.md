# Professional Standards Checklist (living)

Last updated: 2026-07-21 (capital_v2 Phase 2 complete — flag still OFF)

## Identity & architecture
- [x] LuminaNT is the primary App; Flet is legacy; engines sole bankroll truth
- [x] No dual write-path for capital math
- [x] Dark trading-desk theme only (for now)
- [x] capital_v2 default **disabled** until explicit enable (`docs/CAPITAL_V2_GO_LIVE.md` in tracker)

## Capital cockpit
- [x] Persistent strip: Equity, Liquid, Open risk, DD% from peak, Today P/L, Remaining
- [x] Bet YES/NO / kill-switch visible
- [x] Secondary util/phase/stake collapsible
- [x] DD% visually distinct + “from peak” affordance
- [x] Strip prefers engine JSON (`bankroll` / `risk` / `phase`)
- [x] **capital_v2 surfaces (when flag on):** SECURE, size_mode, unit, open room, day/week loss room, DD path, Unfreeze (confirm)
- [x] Dedicated **Plan / Bankroll** view (rules, live rooms, secure history, freeze audit, progress bars)
- [x] **Shortlist** visual cards (Research) with EV/stake/size_mode + settle status reasons
- [x] Desk Live Equity hero + Unfreeze + link to Plan
- [x] High-contrast Settlement/Match date toggles
- [x] Case File stake decision summary (notes dual-write: stake_rec / size_mode / unit / rules)

## Result taxonomy (real-money correctness)
- [x] Open risk = Pending + ConfirmedPlaced
- [x] Settled sample includes Refunded; excludes Abandoned from performance
- [x] Badges/filters/blotter expose engine states
- [ ] Daily P/L forensic drill when chart is on settlement-day still uses match-date filter (documented debt)

## Charts & date semantics
- [x] Default equity/daily bucketing = settlement day Europe/Oslo
- [x] Optional match-date toggle with clear labels
- [x] No 10px neon glow series; controlled stroke ~1.5–2px
- [x] HWM on equity series
- [x] DD% series or band on equity chart
- [x] Tooltips state which day definition is active
- [ ] No invented CLV UI (correctly de-scoped)

## Process metrics
- [x] Calibration reliability + segment tables
- [x] Residual (bias p−y) labeled on group tables
- [ ] Placement EV residual table (next if data dense enough)

## Open risk awareness
- [x] Concentration by sport + match (empty-safe)
- [x] Drill to ledger
- [x] Engine 18% portfolio open-risk layer (capital_v2 flag-on)

## Engine capital_v2 (tracker)
- [x] Unit ladder + REDUCED/FROZEN + daily/weekly + open room + secure + audit
- [x] Secure min working buffer ≥ max(55% equity, 8×unit)
- [x] MC stress suite 0 stake violations
- [x] CLI `capital status|unfreeze|segments`
- [x] Env override `CAPITAL_V2_ENABLED` / `NT_CAPITAL_V2_ENABLED`
- [ ] Live enable only after operator “enable” instruction

## Visual density
- [x] Prefer terminal density over aurora/glass
- [x] Metric text-shadow neon removed
- [x] Ambient orbs minimal
- [ ] Ongoing: remaining glass on Odds/Research cards

## Testing / audit
- [x] Tracker capital_v2 unit/integration/MC tests green
- [ ] `tsc --noEmit` after App strip changes (operator/dev)
- [ ] Automated UI tests (future)

## Forbidden until explicit OK
- [ ] Setting `capital_v2.enabled: true` in production without go-live checklist
- [ ] Framework migration
- [ ] CLV without close-line capture
