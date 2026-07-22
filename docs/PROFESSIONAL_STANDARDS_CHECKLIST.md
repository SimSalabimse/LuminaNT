# Professional Standards Checklist (living)

Last updated: 2026-07-22 (**capital_v2 LIVE** · bankroll regime Exploration → Survival → Normal · PR1–PR5 shipped)

**Deferred work** (weekly explore chip, coverage panel, day-start card, place-ack on Shortlist, security harden, settlement-day drill, OS notifications, composition bars): see [`docs/DESIGN_PR6_13_REMAINING.md`](./DESIGN_PR6_13_REMAINING.md).  
**Do not invent engine numbers in the UI** — display fields from `risk.json` / `bankroll.json` / `phase.json` / `coverage_health.json` only.

---

## Identity & architecture

- [x] LuminaNT is the primary App; Flet is legacy; engines sole bankroll truth
- [x] No dual write-path for capital math
- [x] Dark trading-desk theme only (for now)
- [x] **capital_v2 is LIVE** — desk treats `risk.capital_v2_enabled === true` as first-class (SECURE, size_mode, unit, open room, day/week rooms, Unfreeze). Demo package seeds v2 on. Tracker go-live / env flags remain engine-side SSOT; Lumina does not re-gate math.
- [x] Code is law: UI displays and orchestrates CLI; never reimplements staking / remaining / freeze logic

## Capital cockpit

- [x] Persistent strip: Equity, Liquid, Open risk, DD% from peak, Today P/L, Remaining
- [x] Bet YES/NO / kill-switch visible (unified gate from `deriveRiskStatus`)
- [x] Secondary util/phase/stake collapsible
- [x] DD% visually distinct + “from peak” affordance
- [x] Strip prefers engine JSON (`bankroll` / `risk` / `phase`)
- [x] **capital_v2 surfaces (live):** SECURE, size_mode, unit, open room, day/week loss room, DD path, Unfreeze (confirm)
- [x] Dedicated **Plan / Bankroll** view (rules, live rooms, secure history, freeze audit, progress bars)
- [x] **Shortlist** visual cards (Research) with EV/stake/size_mode + settle status reasons
- [x] Desk Live Equity hero + Unfreeze + link to Plan
- [x] High-contrast Settlement/Match date toggles
- [x] Case File stake decision summary (notes dual-write: stake_rec / size_mode / unit / rules)

## Bankroll regime (package law)

Package progression is **Exploration → Survival → Normal** (engine `bankroll_regime` / `bankroll_regime_label`).

| Standard | Status |
|----------|--------|
| Desk strip shows regime chip from engine fields only | [x] |
| Progress chip uses package `exploration_exit` / `survival_exit` — **never** map legacy `calibration_exit` → Exploration 40 | [x] |
| Legacy disk id `calibration` → label **Exploration (legacy)** + **STALE** schema banner | [x] |
| Stale when package explore weekly fields missing under v2 + regime signal | [x] |
| Open-risk cap / min-EV displayed from engine (`regime_open_risk_cap_nok`, `regime_min_ev`) — no hard-coded TS law | [x] |
| Weekly explore used/max on strip | [ ] **Deferred PR6** — fields exported; UI chip not yet |

## Coverage health

- [x] Snapshot path + fingerprint include `data/state/coverage_health.json` (loader + content fingerprint)
- [x] Typed `CoverageHealth` on snapshot (`level`, `shortlist_with_deep_n`, `empty_slip_risk`, COV FORCE flags, …)
- [x] Deep-pack SSOT for empty-slip gate = **`shortlist_with_deep_n`** (not bare `deep_n`)
- [x] Soft gate separate from Can bet on desk
- [x] Shortlist critical callout when coverage is critical (partial)
- [ ] Dedicated Coverage / research health panel (deep%, surv%, mid unresearched, COV FORCE, empty-slip class) | **Deferred PR8a**
- [ ] Preferred ≥55% / short-main ≤25% composition bars | **Deferred PR8b** — only from engine `deep_queue.json`, never invented %

## Empty-slip taxonomy

Honest empty board vs process failure — helper `src/lib/emptySlip.ts` (`classifyEmptySlip`).

| Kind | When | Celebrate empty? |
|------|------|------------------|
| `has_picks` | Place slip has rows | n/a |
| `process_miss` | Empty + critical level **or** `empty_slip_risk` | **No** |
| `process_miss_soft` | Empty + warn / unknown non-ok with deep packs | **No** |
| `no_research` | Empty + coverage ok-ish but `shortlist_with_deep_n` ≤ 0 | **No** |
| `coverage_unavailable` | Empty + no Coverage Health payload (fail-closed) | **No** |
| `honest_no_edge` | Empty + level ok + `shortlist_with_deep_n` ≥ 1 | **Yes** |

- [x] Taxonomy implemented and wired for Ops / Shortlist empty states
- [x] README principle: empty slip is success **only** when coverage healthy and shortlist deep packs ≥ 1
- [x] Primary CTAs push **board-first Ops** / Evidence when process-miss — not bare recommend

## Board-first Ops (D14)

- [x] Ops is board-first: research **board** before live recommend
- [x] Sticky freshness after successful `nt research board` (`boardFreshness.ts`)
- [x] Live recommend refuses / warns when sticky missing, path mismatch, or odds mtime newer than board stamp
- [x] Dry-run recommend still allowed for inspection; explicit override path for stale live
- [x] Empty place-slip CTAs point at Board, not bare recommend alone
- [ ] place-ack / abandon on Shortlist Pending cards | **Deferred PR7**
- [ ] Day-start process checklist card (settle → odds → board → packs → recommend → place → place-ack) | **Deferred PR9**

## Result taxonomy (real-money correctness)

- [x] Open risk = Pending + ConfirmedPlaced
- [x] Settled sample includes Refunded; excludes Abandoned from performance
- [x] Badges/filters/blotter expose engine states
- [ ] Daily P/L forensic drill when chart is on settlement-day still uses match-date filter | **Deferred PR12** (documented debt)

## Charts & date semantics

- [x] Default equity/daily bucketing = settlement day Europe/Oslo
- [x] Optional match-date toggle with clear labels
- [x] No 10px neon glow series; controlled stroke ~1.5–2px
- [x] HWM on equity series
- [x] DD% series or band on equity chart
- [x] Tooltips state which day definition is active
- [x] No invented CLV UI (correctly de-scoped)

## Process metrics

- [x] Calibration reliability + segment tables
- [x] Residual (bias p−y) labeled on group tables
- [ ] Placement EV residual table (next if data dense enough)

## Open risk awareness

- [x] Concentration by sport + match (empty-safe)
- [x] Drill to ledger
- [x] Engine 18% portfolio open-risk layer (capital_v2 live display)

## Engine capital_v2 (tracker + Lumina display)

- [x] Unit ladder + REDUCED/FROZEN + daily/weekly + open room + secure + audit (engine)
- [x] CLI `capital status|unfreeze|segments` (engine)
- [x] Env override `CAPITAL_V2_ENABLED` / `NT_CAPITAL_V2_ENABLED` (engine)
- [x] Lumina Plan / strip / Unfreeze surfaces when `capital_v2_enabled` on risk snapshot
- [x] Demo risk package ships package-shaped Exploration + capital_v2 on
- [ ] Secure buffer / ladder **numeric law** documented only in engine/tracker — UI never hard-codes those constants as source of truth

## Visual density

- [x] Prefer terminal density over aurora/glass
- [x] Metric text-shadow neon removed
- [x] Ambient orbs minimal
- [ ] Ongoing: remaining glass on Odds/Research cards

## Testing / audit

- [x] Tracker capital_v2 unit/integration/MC tests green (engine)
- [x] Regime / stale-schema unit tests (`riskStatus.regime.test.ts`)
- [x] Board freshness + empty-slip helpers covered by design PRs
- [ ] `tsc --noEmit` after App strip changes (operator/dev)
- [ ] Automated UI tests (future)

## Security / notifications (deferred)

- [ ] Runtime FS path allowlist + agent mutation confirms + model allowlist | **Deferred PR10**
- [ ] Opt-in OS notifications for COV CRITICAL / STALE RISK | **Deferred PR13**

## Forbidden until explicit OK

- [ ] Inventing regime caps, exit settled counts, secure %, or composition shares in TypeScript
- [ ] Mapping `calibration_exit` → package Exploration exit
- [ ] Celebrating empty slip without Coverage Health ok + shortlist deep packs
- [ ] Framework migration
- [ ] CLV without close-line capture

---

## Related docs

| Doc | Role |
|-----|------|
| [`DESIGN_PR6_13_REMAINING.md`](./DESIGN_PR6_13_REMAINING.md) | Backlog design PR6–13 (deferred train) |
| [`PHASE0_DIAGNOSTIC.md`](./PHASE0_DIAGNOSTIC.md) | Early desk diagnostic |
| [`PHASE1_CAPITAL_STRIP.md`](./PHASE1_CAPITAL_STRIP.md) | Strip + taxonomy + chart discipline |
| [`PHASE1_CHECKPOINT_OPEN_RISK_AND_SETTLEMENT_DAY.md`](./PHASE1_CHECKPOINT_OPEN_RISK_AND_SETTLEMENT_DAY.md) | Open risk + settlement-day checkpoint |
| [`PHASE2_CAPITAL_UI.md`](./PHASE2_CAPITAL_UI.md) | capital_v2 Plan / Shortlist / Desk UI |
| Root [`README.md`](../README.md) | Product overview + design principles |

Tracker-only chores (not this repo): `LUMINA_INTEGRATION.md` / PACKAGE “Cal 40” formula residue (**G10** in design backlog).
