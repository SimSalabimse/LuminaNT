# Checkpoint — Open risk · settlement-day charts · polish

**Status:** Ready for operator review  
**Date:** 2026-07-21  
**Phase 1.0 capital strip:** **not regressed** (order + labels polished only)

## What changed

### 1. Capital strip polish (`DeskStrip.tsx`) — locked strip preserved
| Item | Behavior |
|------|----------|
| Order | `EQUITY \| LIQUID \| OPEN RISK \| DD% FROM PEAK \| TODAY P/L \| REMAINING` then **Bet YES/NO** far right |
| DD% | Label **DD% FROM PEAK**; tooltip explains peak HWM; tone orange/red ≥5% / ≥10% / ≥15% |
| Secondary | UTIL · PHASE · STAKE BAND · CAP · Full/Filtered — still collapsible |
| Engine JSON | Still preferred for all capital/risk fields |

### 2. Settlement-day equity default (`analytics.ts`, `utils.ts`)
| Item | Behavior |
|------|----------|
| `settlementCalendarDay()` | `updated_at` → **Europe/Oslo** YYYY-MM-DD (fallback match `date`) |
| `equityCurve(bets, baseline, mode?)` | Default **`settlement`**; optional `"match"` |
| `dailyPl(..., mode?)` | Same default |
| UI toggle | Desk equity pulse + Analyze Performance: **Settlement (Oslo)** default / Match optional |
| Tooltips | Explicit “settlement day (Europe/Oslo)” vs match date — no silent “today” ambiguity |

### 3. Open-risk concentration (`OpenRiskConcentration.tsx` on Desk)
| Item | Behavior |
|------|----------|
| Definition | **Pending + ConfirmedPlaced** only |
| Chart | Horizontal bars by sport (empty state when zero) |
| Table | By match: status labels, n, stake |
| Drill | Click bar/row → forensic ledger filter |
| Always on | Visible even at zero open risk |

### 4. Chart discipline
| Item | Behavior |
|------|----------|
| Equity ECharts | HWM dashed + **DD%** secondary axis (light fill); stroke ~1.75; no glow series |
| Fluid / pulse | Settlement-default series; HWM; no neon bloom |
| Daily P/L | Settlement-day default |

### 5. Calibration polish
| Item | Behavior |
|------|----------|
| Group tables | Residual note: Bias = mean(p) − WR; column “Bias (p−y)” |
| Metric cards | Quieter borders (less glass/holo) |

### 6. Visual cleanup
| Item | Behavior |
|------|----------|
| Primary buttons | No `shadow-glow` |
| Desk KPIs | Flat card borders (no holo lift) |
| Ambient orbs | Already minimal (prior pass) |

## Files touched
- `src/lib/utils.ts` — `settlementCalendarDay`
- `src/lib/analytics.ts` — equity/daily date modes, `openRiskConcentration`
- `src/lib/charts.ts` — equity + open-risk options, fluid tooltips
- `src/types/index.ts` — EquityPoint hwm/drawdownPct
- `src/components/layout/DeskStrip.tsx`
- `src/components/dashboard/OpenRiskConcentration.tsx` **(new)**
- `src/views/Dashboard.tsx`
- `src/views/Performance.tsx`
- `src/views/Calibration.tsx`
- `src/components/ui/button.tsx`

## Capital strip regression check
- Primary metrics still always visible without scroll  
- Engine JSON still source for Equity/Liquid/Open/Today/DD/Remain  
- Taxonomy helpers unchanged from 1.0 lock  

## Screenshots
Operator: refresh with `Launch LuminaNT (dev).bat` and capture Desk (concentration + blotter), Analyze equity/daily (note Settlement toggle), Calibration groups.

## Not done (still App backlog)
- Settlement-day forensic drill for daily bars when mode is settlement (currently filters match `date` field — known limitation; label is honest)
- Full card de-glass across Odds/Research  
- CLV (still de-scoped)

## Checklist update
See `docs/PROFESSIONAL_STANDARDS_CHECKLIST.md`
