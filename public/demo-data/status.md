# NT Status (auto-generated)

## Bankroll
- **Equity**: 563.09 NOK
- Realized P/L: +63.09 NOK (baseline 500.0)
- Pending risk: 32.00 NOK
- Liquid: 531.09 NOK
- Ledger: 211 bets (47 archive + 164 later)

## Phase (auto)
- **1A** — Protect
- Stake band: 10–12 NOK
- Max bets/round: 3 | Max doubles: 0
- Rolling ROI: -6.2%

## Daily risk (auto — changes with equity/phase)
- Cap: **42.00 NOK** (`daily_cap = clamp(equity * phase.daily_risk_pct, floor, ceil)`)
- Open pending: 32.00
- Remaining today: **10.00 NOK**
- Today P/L: +0.00 | Stop if ≤ -45.05
- Can bet: **True**

## High odds policy
- Odds **> 2.5 are allowed** when evidence grade **A**, EV ≥ high-odds min after haircut, and stake uses high-odds multiplier.
- Historical bad band ROI raises the EV bar further — it does not hard-ban the band.

## ROI by odds band (this era ledger)
| Band | n | ROI | P/L |
|------|---|-----|-----|
| 1.5-1.8 | 78 | -0.6% | -5.8 |
| 1.8-2.2 | 57 | 16.9% | +121.8 |
| 2.2-2.5 | 21 | -32.2% | -78.6 |
| 2.5-3.0 | 10 | -1.9% | -2.3 |
| <1.5 | 32 | 15.2% | +66.5 |
| >=3.0 | 10 | -33.8% | -38.5 |

## Open pending
- 2026-07-15: Tagger, Lilli vs Bejlek, Sara / Vinner: Bejlek, Sara @ 1.67 stake 11
- 2026-07-15: KF Malisheva vs Vllaznia / KF Malisheva to Win @ 1.7 stake 11
- 2026-07-15: Altmaier, Daniel vs Darderi, Luciano / Vinner: Darderi, Luciano @ 1.47 stake 10

## Your workflow
1. Put odds in `inbox/`
2. `python -m nt recommend --odds inbox/YOURFILE.csv`
3. Place bets from `outbox/PLACE_THESE.md`
4. Put results in `inbox/`
5. `python -m nt settle --results inbox/YOUR_RESULTS.yaml`

Updated: 2026-07-15T15:17:48Z
