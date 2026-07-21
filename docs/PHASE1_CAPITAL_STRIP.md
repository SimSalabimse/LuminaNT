# Phase 1.0–1.2 — Capital strip + taxonomy + chart discipline

**Date:** 2026-07-21  
**App:** LuminaNT (primary)  
**Status:** Implemented — operator review checkpoint

## Set A decisions applied

| Decision | Implementation |
|----------|----------------|
| Dense terminal | DeskStrip mono dense readout; secondary row collapsible |
| Tone down God Desk | AmbientOrbs minimal; body aurora reduced; metric text-shadow removed |
| Strip ranking | EQUITY · LIQUID · OPEN · DD% · TODAY P/L · REMAIN (+ secondary UTIL/PHASE/STAKE) |
| CLV de-scoped | No CLV UI |
| ECharts discipline | Ghost glow series removed; stroke ~1.85; HWM dashed series |
| Full result taxonomy | `isPending`/`isSettled` fixed; badges; blotter; pie order |
| Dark only | Unchanged |

## Correctness fixes (real money)

| Helper | Before | After |
|--------|--------|-------|
| `isPending` / open risk | only `Pending` | `Pending` + `ConfirmedPlaced` |
| `isSettled` | win/loss/void/push | + **Refunded**; Abandoned **not** sample |
| Blotter | Pending only | All open-risk tickets + Status column |
| Badges | 3 states | Confirmed / Abandoned / Refunded styles |

## Files touched

- `src/lib/utils.ts` — taxonomy helpers  
- `src/lib/analytics.ts` — RESULT_ORDER, equityCurve note  
- `src/lib/palette.ts` — result colors  
- `src/lib/charts.ts` — fluid + equity chart discipline + HWM  
- `src/components/layout/DeskStrip.tsx` — capital strip  
- `src/components/layout/AmbientOrbs.tsx` — subtle only  
- `src/components/charts/FluidPlChart.tsx` — no neon bloom stack  
- `src/views/Dashboard.tsx` — open risk blotter  
- `src/views/Performance.tsx` — isSettled filter  
- `src/views/BetsExplorer.tsx` — result labels  
- `src/types/index.ts` — BetResult union  
- `src/index.css` — metric glow + body background  

## How to verify

1. `Launch LuminaNT (dev).bat` (or refresh if already open).  
2. Connect to `nt-betting-tracker` root.  
3. Confirm strip shows EQUITY / LIQUID / OPEN / DD / TODAY P/L / REMAIN without scroll.  
4. Ledger filters still list all result strings present in CSV.  
5. Equity charts: thin line, dashed HWM, no fat gold glow.

## Next (after your visual OK)

- 1.3 Calibration residual polish  
- Open risk concentration by sport on Desk  
- Optional settlement-day equity series (engine-aligned)  
- Further glass/holo-border reduction on cards  

**No Phase 2 engine work until you accept this checkpoint.**
