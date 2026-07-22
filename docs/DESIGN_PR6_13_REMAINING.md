# LuminaNT Design â€” remaining PR6â€“13

Source: grok-design-doc-67eedbcd.md (rev5).  
Shipped on main as of 2026-07-22: **PR1â€“PR5** (Exploration/stale risk, fingerprint, demo package, empty-slip, Ops board-first).

Shipped on main via execute-plan **bea3efca** (2026-07-22). All PR6–13 items below are implemented and stacked.

## Gap map (from design)

| G1 | Regime UI styles `calibration` not `exploration` | **High** | `DeskStrip.tsx` | **DONE PR1** |
| G2 | Stale risk.json schema drift | **Critical** | risk.json | **DONE PR1** |
| G3 | Fingerprint omits coverage + control_signals | **High** | loader.rs | **DONE PR2** |
| G4 | Demo file risk pre-package | **Med–High** | demo-data | **DONE PR3** |
| G5 | Ops has no Board / place-ack / abandon | **High** | Ops.tsx | **DONE PR5** |
| G6 | Bare recommend / empty-slip CTAs | **High** | Ops + Shortlist | **DONE PR4+PR5** |
| G7 | Weekly explore fields **exported by engine** but not on strip | **Med** | `risk.py` 507â€“511; UI absent | PR6 read `regime_weekly_explore_*` |
| G8 | Deep queue composition not in coverage_health; no UI | **Med** | `light_research` only | PR8a coverage panel; PR8b via `data/state/deep_queue.json` (D17) |
| G9 | README unqualified empty-slip success | **Med** | README | **DONE PR4** |
| G10 | LUMINA_INTEGRATION example Calibration/cap40; PACKAGE formula â€œCal 40â€ residue | **Low** | engine docs | Tracker chore (not Lumina merge) |
| G11 | Professional standards capital_v2 “OFF” | **Low** | checklist | **DONE PR11** (this train: LIVE + regime/coverage/empty-slip/board-first) |
| G12 | Settlement-day forensic drill debt | **Low** | checklist | PR12 |
| G13 | Tauri FS `**` | **Med** | capabilities | PR10 runtime allowlist |
| G14 | place-ack not on Shortlist Pending | **Med** | Shortlist | PR7 |
| G15 | ~~Fields not exported~~ **Closed:** fields exported; absence means **stale disk** | **Closedâ†’G2** | `risk.py` | See G2 / PR6 |

**What already works well (keep):**

- DeskStrip Remaining / Regime / TG / Coverage / COV FORCE / Can bet structure  
- Soft gate separate from Can bet  
- `deriveRiskStatus` open-risk + gate priority  
- Shortlist coverage critical callout (partial)  
- ControlSignals dual kinds Â· SettleDesk strict packet  
- OpenRiskConcentration Â· Pending+ConfirmedPlaced taxonomy  
- Snapshot load of coverage_health + control_signals  
- Windows `run_nt.py` path Â· `demo-data.ts` capital_v2 patch seed  

---

---

## PR Plan (deferred)

### PR6 â€” Weekly explore quota chip

- **Title:** `feat(desk): surface regime_weekly_explore_used/max`
- **Files:** `riskStatus.ts`, `DeskStrip.tsx`, `CapitalPlanPanel.tsx`, `gateChips.ts`
- **Dependencies:** PR1 recommended (stale banner if fields missing)
- **Description:** Read engine fields only (no export work). Show used/max + EV window in Exploration. Fallback note-scan only if fields absent with â€œderivedâ€ label. Hide when max is 0.

**Acceptance:** After engine refresh, strip shows e.g. Explore 0/2; verification step in PR description.

---

### PR7 â€” Shortlist place-ack / abandon CTAs

- **Title:** `feat(shortlist): place-ack and abandon on Pending cards`
- **Files:** `ShortlistBoard.tsx`, optional CaseFile
- **Dependencies:** PR5 preferred for shared patterns
- **Description:** Single-card confirm; multi-select post-MVP (D16).

**Acceptance:** Pending card â†’ place-ack â†’ ConfirmedPlaced after refresh.

---

### PR8a â€” Coverage / research health panel (no 55/25 bars)

- **Title:** `feat(research): coverage health panel on Shortlist (coverage_health only)`
- **Files:** `DeepQueuePanel.tsx` or `CoverageHealthPanel.tsx`, ShortlistBoard
- **Dependencies:** PR4
- **Description:** deep%, surv%, mid unresearched, COV FORCE, empty-slip classification. **Explicitly out of scope:** preferred_share / short_main_share bars.

**Acceptance:** Panel matches coverage_health.json; no invented composition %.

---

### PR8b â€” Composition bars from `deep_queue.json` (tracker + Lumina)

- **Title:** `feat(research): deep_queue.json composition bars (engine SSOT)`
- **Files (tracker):** write `data/state/deep_queue.json` on board/light (composition preferred/short-main shares + queue line list; include `deep_queue_composition` fields)  
- **Files (Lumina):** `src-tauri/src/nt/paths.rs` + `loader.rs` + models; fingerprint include `deep_queue.json`; `types/index.ts`; Shortlist / `DeepQueuePanel.tsx`
- **Dependencies:** Tracker export PR merged first (or same monorepo train); PR8a
- **Description (D17):** Preferred â‰¥55% / short-main â‰¤25% bars + optional line list **only** from snapshot `deep_queue`. No markdown parse. Demo may ship a stub `public/demo-data/deep_queue.json` for panel training.

**Acceptance:** Bars match JSON composition object; loader returns null-safe empty when file missing; no invented %.

---

### PR9 â€” Day-start checklist card

- **Title:** `feat(desk): day-start process checklist card`
- **Files:** `Dashboard.tsx`, `DayStartChecklist.tsx`
- **Dependencies:** PR5 hooks
- **Description:** Persistent card (not modal): settle â†’ odds â†’ board â†’ packs if COVâ†“ â†’ recommend dry-run â†’ place â†’ place-ack.

---

### PR10 â€” Security: runtime FS allowlist + agent confirms + model allowlist

- **Title:** `security: path allowlist, agent mutation confirms, model allowlist`
- **Files:** `src-tauri` state + loader/write guards, `agent.ts`, Agent view, Settings
- **Dependencies:** After money-path PRs 1â€“7
- **Description:** Runtime path allowlist (A6/security section); regression checklist; cite agent recommend call sites. **D20:** Settings model dropdown = closed allowlist from config/app constants â€” reject free-form model IDs in UI and agent store.

**Acceptance:** Outside-root write denied; non-dry-run recommend requires modal; unknown model string rejected.

---

### PR13 â€” Opt-in OS notifications (COV CRITICAL / STALE RISK)

- **Title:** `feat(settings): opt-in OS notifications for COV CRITICAL`
- **Files:** Settings view, `app-store` settings, Tauri notification permission/plugin, hooks on coverage level / stale schema when minimized
- **Dependencies:** PR1 (stale detection) + PR2 (coverage refresh) preferred; mergeable after
- **Description (D18):** Default **off**. Toggle â€œNotify when coverage criticalâ€ (+ optional â€œNotify on stale riskâ€). Short OS toast only; no bet details. Windows focus: WebView2 / Tauri notification API.

**Acceptance:** Off by default; when on, COV CRITICAL while backgrounded shows OS notification once per transition (debounce); demo mode no-op or silent.

---

### PR11 â€” Lumina docs / standards sync — **DONE**

- **Title:** `docs: standards checklist package + capital_v2 live`
- **Files:** `PROFESSIONAL_STANDARDS_CHECKLIST.md`, README cross-links, PHASE2 status, this gap map (G11)
- **Dependencies:** After PR1–4 preferred
- **Description:** Capital_v2 **LIVE**, Exploration→Survival→Normal, coverage health / empty-slip / board-first Ops documented. **Note:** `LUMINA_INTEGRATION.md` + PACKAGE “Cal 40” formula line remain **tracker-repo** chores (G10).

---

### PR12 â€” Settlement-day forensic drill alignment

- **Title:** `fix(analyze): settlement-day drill uses settlement filters`
- **Files:** `analytics.ts`, Performance/Analyze, charts as needed
- **Dependencies:** None

---

### Suggested merge order

```text
PR1 â†’ PR2 â†’ PR3 â†’ PR4 â†’ PR5 â†’ PR6 â†’ PR7 â†’ PR8a â†’ PR9 â†’ PR10 â†’ PR11
  â†˜ fixtures/tests in PR1/PR3/PR4
PR12 parallel anytime
PR13 (notifications) after PR1+PR2; parallel with polish
PR8b after tracker deep_queue.json export (independent train)
```

**MVP desk correctness:** PR1 + PR2 + PR3 + PR4  
**MVP production workflow:** + PR5 + PR7  
**Early-bankroll excellence:** + PR6 + PR8a + PR9  
**Harden:** PR10 + PR11  
**Composition fidelity:** PR8b (`deep_queue.json` engine-gated)  
**Optional desk alerts:** PR13 (D18)

---


