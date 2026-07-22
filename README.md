# LuminaNT

**Premium local desktop companion for [NT Betting Tracker](https://github.com/SimSalabimse/nt-betting-tracker).**

LuminaNT wraps your local tracker clone with a modern dark dashboard: live equity & risk metrics, rich animated charts, full-ledger explorer (including deep notes search), CLI workflow actions, evidence packs, edges, git sync, and an optional tool-calling AI agent.

> **Code is law.** Phase, stakes, daily risk, kill-switches, and settlement math stay in the Python engine (`python -m nt …`). LuminaNT reads the same files and can *trigger* CLI commands — it never invents alternate rules.

---

## Features

| Area | What you get |
|------|----------------|
| **Repo & refresh** | Pick tracker root · git status / fetch / pull · Refresh Data (`nt refresh` + reload) · optional file-watch polling |
| **Dashboard** | Equity, phase, daily risk, kill-switch, P/L, win rate, ROI, streaks · equity curve · pending & recent bets · status.md |
| **Performance** | ECharts: equity, daily P/L, rolling WR/ROI, **canonical market families** (not raw dump strings), readable pie legends, high-contrast calendar · PNG export · reports |
| **Learnings** | Sport/market/band mult tables · **stake × and EV boost** change log between snapshots · history timelines |
| **Bets explorer** | Virtualized table of all `data/bets.csv` columns · full-text notes search · multi-filters · detail modal |
| **Workflow** | Run `status` / `validate` / `refresh` / `recommend` / `settle` · inbox composer · PLACE_THESE.md preview |
| **Evidence** | Formatted `evidence/*.json` packs · `data/edges.jsonl` lessons |
| **Agent** | Optional xAI / OpenAI / Anthropic · tools for metrics, breakdowns, search, status, edges, high-odds review |
| **Demo mode** | Bundled sample ledger so you can explore without a clone |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  LuminaNT UI (React 19 + Zustand + ECharts + Framer Motion) │
└───────────────┬─────────────────────────────┬───────────────┘
                │ Tauri invoke / FS           │ HTTPS (AI only)
┌───────────────▼───────────────┐   ┌─────────▼─────────┐
│  Tauri v2 backend (Rust)      │   │  xAI / OpenAI /   │
│  · read bets.csv, state JSON  │   │  Anthropic APIs   │
│  · git status / pull / fetch  │   └───────────────────┘
│  · python -m nt <cmd>         │
└───────────────┬───────────────┘
                │
┌───────────────▼───────────────┐
│  nt-betting-tracker root      │
│  config.yaml · data/ · nt/    │
│  inbox/ · outbox/ · evidence/ │
└───────────────────────────────┘
```

**Data flow**

1. User selects tracker root (folder with `config.yaml` + `data/`).
2. Backend loads snapshot: `data/bets.csv`, `data/state/*`, `config.yaml`, edges, evidence list, outbox, git status.
3. Frontend parses CSV (PapaParse), derives metrics/charts, filters the table.
4. **Refresh Data** optionally runs `python -m nt refresh`, then reloads the snapshot.
5. Workflow buttons run `python -m nt status|validate|recommend|settle` in the repo root.
6. Auto-watch polls a content fingerprint; on change, UI reloads.

---

## Prerequisites

- **Node.js** 20+ and npm  
- **Rust** (for Tauri) — https://rustup.rs  
- **Python 3.11+** with the tracker deps (`pip install -r requirements.txt` in the tracker repo)  
- **Git** on PATH (for pull/fetch)  
- Windows: WebView2 (usually preinstalled)  
- macOS 10.15+ / modern Linux with WebKitGTK for Tauri

---

## Setup

```bash
cd LuminaNT
npm install
```

### Easy launch (Windows)

Double-click one of these in the project folder:

| File | What it does |
|------|----------------|
| **`Launch LuminaNT.bat`** | Preferred: runs the release `.exe` if built, otherwise starts Tauri dev |
| **`Launch LuminaNT (dev).bat`** | Always starts `npm run tauri:dev` |
| **`Launch LuminaNT (demo browser).bat`** | Browser-only Vite + demo data |

Optional Desktop shortcut:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\create-desktop-shortcut.ps1
```

### Desktop (CLI)

```bash
npm run tauri:dev
```

### Frontend only (demo mode)

```bash
npm run dev
```

Open the URL Vite prints (default `http://localhost:1420`) and click **Load demo data**.

### Production installers

```bash
npm run tauri:build
```

Artifacts land under `src-tauri/target/release/bundle/` (MSI/NSIS on Windows, DMG on macOS, AppImage/deb on Linux). After a release build, **`Launch LuminaNT.bat`** starts the native exe directly.

---

## Pointing at your tracker

1. Launch LuminaNT.  
2. **Select tracker folder** → choose the root of your clone, e.g.  
   `C:\Users\Sander\Documents\GitHub\nt-betting-tracker`  
3. Confirm metrics match `python -m nt status`.  
4. Use **Refresh Data** after settlements or manual ledger edits.

Enhanced local ledgers with extra CSV columns are supported — extra fields appear in the bet detail modal.

### Public repo / sample data

- Clone https://github.com/SimSalabimse/nt-betting-tracker and point LuminaNT at it, **or**  
- Use **Load demo data** (bundled snapshot under `public/demo-data/`).

---

## Git integration

With a valid `.git` directory in the tracker root:

| UI action | Command |
|-----------|---------|
| Branch badge | Local status (dirty / ahead / behind vs upstream) |
| **Fetch** | `git fetch --prune` |
| **Pull** | `git pull --ff-only` |

Behind-count updates after fetch when upstream tracking refs exist.

---

## CLI from the UI

Commands run in the tracker root:

```text
python -m nt status
python -m nt validate
python -m nt refresh
python -m nt recommend --odds inbox/….csv [--dry-run]
python -m nt settle --results inbox/….yaml
```

Set the Python binary under **Settings** if `python` is not on PATH (`py`, `python3`, or full path).

---

## AI Agent

1. Open **Settings** → AI Agent.  
2. Choose provider (**xAI / Grok**, OpenAI, or Anthropic).  
3. Paste API key (stored only in local app storage).  
4. Optional model override.  
5. Use the **Agent** view; suggested prompts exercise tool calling against your ledger.

Env alternatives (frontend only): `VITE_XAI_API_KEY` in `.env` (see `.env.example`).

---

## Keyboard shortcuts

| Key | Action |
|-----|--------|
| `1`–`7` | Dashboard → … → Settings |
| `Ctrl/Cmd+R` | Refresh Data |

---

## Project structure

```text
LuminaNT/
├── src/                 # React UI
│   ├── components/      # layout, charts, bets, ui (shadcn)
│   ├── views/           # Dashboard, Performance, Bets, Workflow, …
│   ├── stores/          # Zustand (app, data, agent)
│   ├── lib/             # analytics, charts, tauri bridge, agent, demo
│   └── types/
├── src-tauri/           # Tauri v2 + Rust commands
│   └── src/nt/          # loader, git, CLI runner
├── public/demo-data/    # Demo snapshot
└── package.json
```

### Stack

- **Desktop:** Tauri v2  
- **UI:** React 19, TypeScript, Vite, Tailwind, shadcn/ui, Framer Motion  
- **Charts:** Apache ECharts + echarts-for-react  
- **Table:** TanStack Table + Virtual  
- **State:** Zustand  
- **CSV:** PapaParse  

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| CLI fails | Set Python path in Settings; run `pip install -r requirements.txt` in tracker |
| “Not a tracker root” | Select folder that contains `config.yaml` and `data/` |
| Git behind always 0 | Click **Fetch** so upstream refs update |
| Charts empty | Ledger has no settled bets, or filters hide everything — **Clear** filters in Bets Explorer |
| Agent errors | Check API key / model name; CSP allows api.x.ai, api.openai.com, api.anthropic.com |

---

## Design principles

1. **Code is law** — display and orchestrate, don’t reimplement staking.  
2. **Empty slip is success when coverage is healthy and `shortlist_with_deep_n` ≥ 1** — honest no-edge after deep research. Starvation and coverage problems surface as **no-research / process-miss** kinds (never success): zero shortlist deep packs → `no_research`; warn → soft miss; critical / `empty_slip_risk` → process miss; missing Coverage Health → fail-closed unavailable.  
3. **Never hide detail** — notes, evidence, and edges stay one click away.  
4. **Local first** — ledger stays on disk; only optional AI calls leave the machine.  
5. **capital_v2 LIVE** — SECURE / size_mode / unit / open & loss rooms / Unfreeze come from engine `risk.json` when `capital_v2_enabled` is true; Lumina never invents those numbers.  
6. **Bankroll regime** — package law is **Exploration → Survival → Normal**. Legacy disk `calibration` is STALE (label *Exploration (legacy)* only; never map `calibration_exit` → package Exploration exit).  
7. **Board-first Ops** — run research **board** before live recommend; D14 sticky freshness refuses stale odds (dry-run still inspectable).

---

## Docs

| Doc | What it covers |
|-----|----------------|
| [`docs/PROFESSIONAL_STANDARDS_CHECKLIST.md`](docs/PROFESSIONAL_STANDARDS_CHECKLIST.md) | Living operator/engineering standards (capital_v2 live, regime, coverage, empty-slip, board-first) |
| [`docs/DESIGN_PR6_13_REMAINING.md`](docs/DESIGN_PR6_13_REMAINING.md) | Deferred PR6–13 backlog (explore chip, coverage panel, security, …) |
| [`docs/PHASE2_CAPITAL_UI.md`](docs/PHASE2_CAPITAL_UI.md) | Plan / Shortlist / Desk capital_v2 UI |
| [`docs/PHASE1_CAPITAL_STRIP.md`](docs/PHASE1_CAPITAL_STRIP.md) | Strip ranking, result taxonomy, chart discipline |
| [`docs/PHASE1_CHECKPOINT_OPEN_RISK_AND_SETTLEMENT_DAY.md`](docs/PHASE1_CHECKPOINT_OPEN_RISK_AND_SETTLEMENT_DAY.md) | Open risk + settlement-day checkpoint |
| [`docs/PHASE0_DIAGNOSTIC.md`](docs/PHASE0_DIAGNOSTIC.md) | Early desk diagnostic |

---

## License

Companion UI; use with your own clone of nt-betting-tracker. Respect that project’s license for tracker code and data.
