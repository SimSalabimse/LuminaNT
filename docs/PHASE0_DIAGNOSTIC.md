# Phase 0 — Full Diagnostic: **LuminaNT** (primary App)

**Status:** Diagnostic complete. **No production code changes.**  
**Date:** 2026-07-21  
**Supersedes:** `nt-betting-tracker/artifacts/PHASE0_APP_DIAGNOSTIC.md` (incorrectly treated Flet as primary).

**Primary target:** `C:\Users\Sander\Documents\GitHub\LuminaNT`  
**Engine of truth:** `C:\Users\Sander\Documents\GitHub\nt-betting-tracker` (`nt/*`, `data/*`)  
**Legacy (non-primary):** `nt-betting-tracker/desktop/` (Flet)

---

# A. Correct application identification & scope mapping

## A.1 What the operator actually runs

| Artifact | Role |
|----------|------|
| **`Launch LuminaNT.bat`** | Preferred entry: release `luminant.exe` if current, else `npm run tauri:dev` |
| **`Launch LuminaNT (dev).bat`** | Always Tauri dev |
| **`Launch LuminaNT (demo browser).bat`** | Vite browser + demo data (no full FS/CLI) |
| **Release installers** | `src-tauri/target/release/bundle/` (MSI/NSIS) |
| **Binary** | `src-tauri/target/release/luminant.exe` |

Confirmed from `package.json` description: *“premium visual dashboard & companion for NT Betting Tracker”*.

## A.2 Stack

```
React 19 + TypeScript + Vite
  + Zustand (app-store, data-store, agent-store)
  + Tailwind + Radix/shadcn-style UI
  + ECharts (echarts-for-react) + custom SVG FluidPlChart
  + Framer Motion
  + Tauri v2 (Rust) → reads tracker files, runs `python -m nt …`
```

## A.3 Component / view hierarchy

```
main.tsx
└── App.tsx
    ├── AmbientOrbs (decorative)
    ├── Sidebar + WorkspaceTabs
    ├── TopBar (repo / git / kill-switch / refresh)
    ├── DeskStrip (persistent risk strip — when snapshot loaded)
    ├── ViewRouter
    │   ├── dashboard → Desk (Dashboard.tsx)
    │   ├── performance | calibration → Analyze.tsx
    │   ├── bets → BetsExplorer.tsx
    │   ├── odds → Odds.tsx
    │   ├── workflow | plans → Ops.tsx
    │   ├── learnings | evidence | agent → Research.tsx
    │   └── settings → Settings.tsx
    ├── CommandPalette, HelpOverlay, Onboarding
    └── ToastHost
```

**Workspaces** (`src/lib/workspaces.ts`): Desk · Analyze · Ledger · Odds · Research · Ops · System.

## A.4 Data flow (App ← Engine)

1. Operator **Open** → selects `nt-betting-tracker` root (`config.yaml` + `data/`).
2. Tauri `load_snapshot` (`src-tauri/src/nt/loader.rs`) reads:
   - `data/bets.csv`
   - `data/state/bankroll.json`, `phase.json`, `risk.json`, `learning.json`, …
   - evidence list, inbox/outbox files, odds structured JSON (newer of `data/odds/latest.json` vs `artifacts/odds_structured.json`)
   - git status
3. Frontend `data-store` parses CSV (`parse-bets.ts`), holds `TrackerSnapshot`, derives metrics (`analytics.ts`).
4. **Refresh** optionally runs `python -m nt refresh` then reloads snapshot.
5. Ops/Workflow invokes CLI (`status`, `validate`, `recommend`, `settle`, …).
6. Optional auto-watch: content fingerprint → reload.

**Law:** UI must not invent bankroll/phase/risk math. It may *display* engine JSON and *derive* presentation metrics from the ledger.

## A.5 Not the primary App

| Repo / path | Status |
|-------------|--------|
| **LuminaNT** | **PRIMARY** day-to-day capital + ops UI |
| **LuminaViz** | Generic chart playground (iris/sales demos) — **not** the betting desk |
| **nt-betting-tracker/desktop/** (Flet) | **Legacy leftover** — still invokable via `run_desktop.py` but **not** operator primary |
| **nt-betting-tracker/nt/** | Engine sole truth |

## A.6 Dual-path residual risk

| Residual | Risk |
|----------|------|
| Flet still in tracker repo | Confusion in docs; possible dual metrics if someone runs both |
| App-side `computeMetrics` / `equityCurve` | Parallel analytics vs engine `deep_dive` — can diverge (especially result taxonomy & date bucketing) |
| Demo mode bundled CSV | Safe for UX demos; must never be mistaken for live capital |

**Later isolation:** Mark Flet as `legacy/` or stop documenting it as “the desktop”; single “Open tracker folder” path remains LuminaNT → engine files.

---

# B. Visual system & design coherence (LuminaNT only)

## B.1 Design tokens

### CSS (`src/index.css` `:root`) — “God Desk”

| Token | Role | Approx |
|-------|------|--------|
| `--background` | Navy void | deep blue-black |
| `--primary` / `--profit` | **Same electric gold** | HSL 44 70% 47% |
| `--accent` | Brighter gold | |
| `--loss` / destructive | Coral | |
| `--pending` | Risk amber (distinct) | HSL 32 95% 52% |
| `--violet` | Soft indigo secondary | |
| `--glow` | Glow driver (= gold) | |
| Surfaces | card / elevated / rail | glass panels |

### TS palette (`src/lib/palette.ts`)

- `profit` / `primary` / `gold` all **`#C9A227`**
- `loss` `#FF6B7A`, `pending` `#F59E0B`, `indigo` `#8B95FF`
- `goldGlow` rgba stack for charts
- Sport color map gold-led + cool secondary

### Tailwind extras (`tailwind.config.js`)

- Shadows: `glow`, `glow-sm`, `glow-violet`, `glass`, `glass-lg`
- Animations: `pulseGlow`, `aurora`, `float`, `shimmer`, `gradient-shift`
- **Legacy `brand-gradient`** still cyan→teal→violet→magenta (pre-gold redesign residue)
- Fonts: Inter + JetBrains Mono

## B.2 Decorative / neon inventory (high severity for capital desk)

| Source | Behavior | Severity |
|--------|----------|----------|
| **`AmbientOrbs.tsx`** | Fixed full-viewport blurs: gold/indigo orbs, `animate-aurora` | **High** — competes with numbers |
| **Body CSS** | Multi-layer gold/indigo radial aurora + grid + grain | Medium–High |
| **`.metric-glow-profit/loss`** | Multi-stop **text-shadow** glow on KPI values | **High** — hurts numeric scan |
| **Buttons** `shadow-glow`, `shadow-glow-sm`, variant `glow` | Gold bloom on CTAs | Medium |
| **`fluidPlChartOption`** (`charts.ts`) | Dual series: width **10** glow line opacity 0.12 + shadowBlur 28; main stroke **3** + shadowBlur 18; area fill gold→teal wash | **Critical** for chart honesty |
| **`FluidPlChart.tsx`** | Catmull-Rom “silk” path + offset ribbon (organic finance aesthetic) | Medium — pretty over precise |
| **`Dashboard` KPI cells** | `holo-border`, gradient hairline, card lift on hover | Medium |
| **Pending pulse** | `animate-pulse` on open blotter | Low–OK for attention |

## B.3 Chart readability (ECharts + Fluid)

| Parameter | Observed | Pro capital target | Gap |
|-----------|----------|--------------------|-----|
| Primary stroke | **3 px** (+ 10 px ghost glow) | **1.5–2.0 px**, no ghost | Excess glow |
| Markers | often off (`showSymbol: false`) | Good | OK |
| Smooth | `smooth: 0.55` / Catmull-Rom | Mild or none for equity | Over-smooths levels |
| Area fill | Strong gold gradient 0.45→0 | Optional DD-only | Noise |
| Tooltip | Solid glass + gold border | Good | OK |
| dataZoom | inside zoom present | Keep | Good |
| HWM overlay | **Absent** on fluid/equity options | Required | Missing |
| Dual axis equity + DD | **Absent** | Industry standard | Missing |
| Axis labels | size 12, high-contrast labels | Good | Better than Flet |

## B.4 Tables / ledger (`BetsExplorer.tsx` + TanStack virtual)

| Strength | Gap |
|----------|-----|
| Virtualized full ledger | Result taxonomy incomplete (see C) |
| Multi-filters, notes search, case file | No explicit ConfirmedPlaced / Abandoned badges in `resultBadgeClass` |
| Forensic drill from charts | Pending-only open blotter ignores ConfirmedPlaced stakes |
| Numeric mono/tabular | Zebra optional; sticky header depends on table impl |

## B.5 Information architecture vs capital cockpit

### What **is** always visible (`DeskStrip`)

| Metric | In strip? |
|--------|-----------|
| Can bet / stopped | Yes |
| Open risk | Yes |
| Remaining daily capacity | Yes |
| Util % of daily cap | Yes |
| Phase + stake band | Yes |
| Full book / Filtered scope | Yes |
| Forensic chip | Yes |

### What is **missing or buried** for capital truth

| Metric | Engine has it? | Lumina surface today |
|--------|----------------|----------------------|
| **Equity** | `bankroll.equity_nok` | Desk **KPI row** only (scrollable), not strip |
| **Liquid** | `bankroll.liquid_nok` | **Under-surfaced** (types know it; strip ignores) |
| **Today’s realized P/L** | `risk.today_realized_pl_nok` | **Not on strip/header** |
| **Drawdown % from peak** | `phase.drawdown_from_peak_pct` | **Ops** only (buried) |
| Peak equity | phase | Buried |
| Placement EV residual | partial notes/decisions | Case file / Calibration incomplete |
| **CLV** | **No data** | Correctly absent |

### Default landing

**Desk workspace** (`dashboard`) — prioritizes **risk util + pending blotter + process KPIs**, not pure “liquid capital first.” Good for live ops; weak for pure morning capital check unless strip is expanded.

### Clicks to common questions

| Question | Clicks |
|----------|--------|
| Can I bet / remaining? | 0 (strip) |
| Equity? | 0–1 (Desk KPIs) |
| Liquid? | **Search / unknown** |
| Today P/L vs kill-switch? | **Not 1-glance** |
| DD from peak? | Ops deep |
| Calibration | Analyze → Calibration |
| Full ticket case file | Ledger + row |

## B.6 Highest-severity defect inventory

| # | Path | Defect | Capital impact |
|---|------|--------|----------------|
| 1 | `DeskStrip.tsx` | No Equity / Liquid / Today P/L / DD% | Incomplete capital truth strip |
| 2 | `lib/utils.ts` `isPending` | Only `"pending"` — **not ConfirmedPlaced** | Understates open risk in blotter/filters if ConfirmedPlaced used |
| 3 | `lib/utils.ts` `isSettled` | Win/Loss/Void/Push — **Refunded excluded**; no Abandoned handling | Metrics/equity curve wrong vs engine |
| 4 | `lib/charts.ts` `fluidPlChartOption` | Neon multi-layer glow + heavy fill | Decision noise; looks “demo” |
| 5 | `AmbientOrbs.tsx` + body aurora | Full-screen decorative bloom | Cognitive load under time pressure |
| 6 | `metric-glow-*` CSS | Glowing P/L text | Harder to read digits quickly |
| 7 | `analytics.ts` `equityCurve` | Buckets by **match `date`** | Diverges from settlement-day risk day |
| 8 | Profit = Primary gold | Semantic conflation brand/profit | Weak risk color hierarchy |
| 9 | `RESULT_ORDER` analytics | Missing ConfirmedPlaced / Abandoned | Incomplete taxonomy |
| 10 | Parallel metrics | App re-derives equity from bets vs `bankroll.json` | Drift risk if filters/taxonomy differ |

---

# C. Data plane audit

## C.1 What LuminaNT consumes

| Source | Via |
|--------|-----|
| `data/bets.csv` | Snapshot → PapaParse |
| `data/state/bankroll.json` | Snapshot fields |
| `data/state/phase.json` | Phase / DD fields |
| `data/state/risk.json` | Cap / remaining / stopped / today P/L |
| `data/state/learning.json` (+ history) | Research/Learnings |
| Evidence file list + pack content | Research/Evidence |
| `data/edges.jsonl` | Lessons |
| Odds structured JSON | Odds workspace |
| outbox PLACE_THESE / rejects | Ops |
| Calibration path | Analyze/Calibration (if wired) |
| Demo CSV/JSON | `public/demo-data` / `demo-data/` |

## C.2 Ledger / state semantics

Engine result enum (tracker):  
`Pending | ConfirmedPlaced | Win | Loss | Refunded | Abandoned`

Lumina today:

| Function | Behavior | Engine mismatch |
|----------|----------|-----------------|
| `isPending` | exact `pending` | Misses **ConfirmedPlaced** (still open risk) |
| `isSettled` | win/loss/void/push | Misses **Refunded**; Abandoned unclear |
| Open blotter | `isPending` only | ConfirmedPlaced invisible as open |
| Equity curve | match date buckets | Risk uses settlement day (Oslo via `updated_at`) |

Live tracker book (reference, n=28): complete BET_HEADER, **no CLV columns**, p_model often in notes.

## C.3 Engine-known, App under-surfaced

| Metric | Engine | Lumina |
|--------|--------|--------|
| liquid_nok | bankroll.json | Rarely primary UI |
| today_realized_pl_nok | risk.json | Not strip |
| drawdown_from_peak_pct | phase.json | Ops only |
| peak_equity_nok | phase | Buried |
| remaining_risk_nok | risk | Strip **yes** |
| open_pending_risk_nok | risk | Strip **yes** |
| Calibration log | calibration.jsonl | Partial Analyze |
| Diversify concentration | portfolio at recommend | Not live open-risk breakdown |
| Recommended vs actual stake | Not dual-written | N/A |
| CLV | **Absent** | Correctly no fake UI |

## C.4 CLV stance

**No closing-line capture path exists** in ledger or odds history.  
→ **Do not design CLV charts** until operator commits to a capture method (second dump, manual close field, or external feed).

Prefer interim process metrics: **calibration reliability** + **placement p_model residual** from notes/decisions/calibration.jsonl.

---

# D. Visualization stack assessment (Lumina-centric)

## D.1 Current approach

- **ECharts** for performance, breakdowns, heatmaps, fluid option.
- **Custom SVG** FluidPlChart for hero organic P/L.
- Strong tooling for professional charts **if glow is dialed down**.

## D.2 Recommendation (time-bounded)

### Next 6–8 weeks: **Keep ECharts inside LuminaNT; discipline, don’t migrate**

| Action | Why |
|--------|-----|
| Remove dual glow series; stroke 1.75–2.0 | Precision over “God Desk neon” |
| Optional mild area or **DD band only** | Convention |
| Add HWM dashed series | Capital truth |
| Prefer engine `bankroll.json` equity for headline numbers | Single source |
| Fix result taxonomy before more chart types | Correctness |
| Defer framework migration | Capital strip first |

### Later (optional read-only advanced panel still *in* LuminaNT)

Reliability diagram, sport×market heatmap intensity, brush-linked multi-chart — all still ECharts-capable; no need for Recharts/D3 rewrite.

### Do not

- Port primary UX back to Flet.
- Introduce a second write-path for bankroll.
- Ship CLV without data.

---

# E. Chart-type map (Phase 1 design)

| Data category | Chart | Justification |
|---------------|--------|----------------|
| Equity + HWM + DD | Multi-series **line** (equity solid, HWM dashed) + DD area or aligned panel | Trading desk: level + underwater |
| Open risk concentration | **Stacked bar** by sport (and table by match) | Portfolio exposure under time pressure |
| Daily / period P/L | **Diverging bar** | Instant up/down attribution |
| Rolling process | Thin line ROI/WR (already present) | Trend without glow |
| Calibration | **Reliability diagram** (binned p vs freq) | Process quality |
| Sport/market rank | **Horizontal bar** with n labels | Ranked breakdown |
| CLV (future only) | Histogram + mean marker | Edge distribution |
| Pending ladder | Table + spark stake total (keep blotter) | Ops actionability |

---

# Phase 1 sequence (LuminaNT only — after acceptance)

| Step | Scope | Success |
|------|--------|---------|
| **1.0** | Expand **DeskStrip** / capital strip: Equity, Liquid, Open, Remaining, Today P/L, DD% (from engine JSON) | Visible without scroll on every workspace |
| **1.1** | Chart discipline: kill ghost glow series, thinner stroke, HWM, label match-day vs settlement-day | Equity readable in &lt;2s |
| **1.2** | Result taxonomy: ConfirmedPlaced open risk; Refunded settled; Abandoned filter + badges | Align with engine |
| **1.3+** | Calibration residual; open concentration; de-glow AmbientOrbs/metrics | Process views |

**No Phase 2 engine work until 1.0–1.2 accepted.**

---

# Phase 2–3 preview (deferred)

Engine: multi-layer risk, fixed-unit small BR, weekly stop, sizing audit log, MC stress, recommended vs actual stake.  
Bankroll vision: 10 NOK floor, step phases, no pure Kelly, optional secure profit bucket — document in App Settings/Ops when implemented.

---

# Professional Standards Checklist (living)

- [ ] LuminaNT identified as sole primary App; Flet documented legacy  
- [ ] Persistent capital strip: Equity, Liquid, Open, Remaining, Today P/L, DD%  
- [ ] Open risk includes all engine open states (Pending + ConfirmedPlaced)  
- [ ] Settled metrics include Refunded; Abandoned excluded from risk/sample correctly  
- [ ] Charts: precision strokes; no decorative neon glow layers  
- [ ] Settlement-day vs match-day labeled consistently  
- [ ] No CLV UI without close-line capture  
- [ ] Headline capital numbers prefer engine JSON over re-derived filters  
- [ ] Engines sole write path for bankroll/risk/phase  
- [ ] Fail-closed ops actions; overrides visible  

---

# Set A — answer before any Phase 1.0 code

1. Primary daily use of LuminaNT: morning capital check, live monitoring, or post-settlement review?  
2. Density: dense terminal vs spacious glass cards?  
3. Rank non-negotiable strip metrics: Liquid, Open, Remaining, Today P/L, DD%, Equity (order).  
4. Closing odds / CLV later, or de-scope CLV for now (calibration + EV residual only)?  
5. Confirm 6–8 weeks of **disciplined ECharts improvement** (no framework migration)?  
6. Must ConfirmedPlaced / Abandoned appear in daily filters and visual taxonomy?  
7. Dark only, or light theme required?

# Set B — after App 1.0 (engine/bankroll)

1. Hard freeze DD % from peak?  
2. Weekly loss limit (NOK / units)?  
3. Fixed 10 NOK unit until which equity?  
4. Secure-profit bucket yes/no + thresholds?  
5. Confirm pure continuous Kelly forbidden?  
6. Auto-apply proposals on, or Lumina gate?

---

# Before / after sketch (design only)

### DeskStrip today

```
Can bet YES | Open risk 0 | Remaining 42 | Util 0% | Phase 1A | Stake 10–12 | Full book | Refresh
```

### DeskStrip proposed (1.0)

```
EQUITY 550.99  LIQUID 550.99  OPEN 0.00  REMAIN 42.00  TODAY +22.88  DD 0.0%
Can bet YES · Phase 1A · Unit 10–12 · min 10 · Full book | Refresh
```

### Fluid chart today

- 10px glow layer + 3px neon gold + heavy area fill.

### Fluid / equity chart proposed

- Single 1.75–2.0px line, optional soft fill max 8% opacity, HWM dashed muted, no shadowBlur theater.

---

# Bottom line

1. **Primary App = LuminaNT** (Tauri + React + ECharts). Flet is legacy. LuminaViz is unrelated.  
2. Risk strip is a strong start but **not a full capital cockpit** (missing Liquid, Today P/L, DD%, Equity on strip).  
3. **Result taxonomy bugs** (`isPending` / `isSettled`) are real-money correctness issues.  
4. Visual system optimizes for **“God Desk” neon gold** more than institutional scan speed — fix by discipline, not rewrite.  
5. **No code until Set A answers and explicit acceptance of this diagnostic.**

Awaiting operator Set A + acceptance to start **Phase 1.0 capital strip only**.
