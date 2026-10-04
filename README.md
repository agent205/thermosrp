# THERMO-SRP — Thermal-Mechanical Risk-Aware Well-to-Surface Digital Twin

Operator-centric decision-cockpit prototype for a heavy-oil CSS (Cyclic
Steam Stimulation) + SRP (Sucker-Rod Pump) well: live telemetry, well
health, mechanical risk, a Well Digital Twin schematic, a joint CSS+SRP
counterfactual What-If simulator with a mechanical safety gate, a Dynamic
Operating Envelope, rod-floating / pump-unsetting equipment-risk tracking,
Steam-Oil Ratio and energy optimization, Maintenance Intelligence, a PS
Requirement Coverage panel, and a scripted Normal → Thermal Degradation →
Risk Escalated → Adaptation Approved demo scenario.

This is a **fully self-contained static web app**: plain HTML/CSS/JavaScript,
no framework, no backend, no external API calls, no Claude/Anthropic runtime
dependency of any kind. [Vite](https://vitejs.dev) is used only as a local
dev server / bundler — the app itself has zero runtime dependencies and
needs no API keys. Fonts (IBM Plex Sans / IBM Plex Mono) are bundled
locally under `public/assets/fonts`, so the app also works fully offline
once installed. All demo/scenario data is deterministic and embedded
directly in `public/app.js` — there is no external dataset to fetch.

---

## 1. Prerequisites

- **Node.js 18 or later** (Node 20 LTS recommended) — includes npm.
  Download and install from **https://nodejs.org** (choose the Windows
  installer, "LTS" version). The installer includes npm automatically.
- No other software, accounts, API keys, or services are required.

Verify the install by opening **Command Prompt** or **PowerShell** and running:

```bat
node -v
npm -v
```

Both should print a version number.

---

## 2. Unzip and open the project

Unzip `ThermoSRP-local.zip` anywhere on your PC, e.g.
`C:\Users\you\Desktop\thermosrp`.

Open **Command Prompt** / **PowerShell** / **Windows Terminal** in that
folder (Shift+Right‑click the folder → "Open PowerShell window here", or
`cd` into it):

```bat
cd C:\Users\you\Desktop\thermosrp
```

---

## 3. Installation

```bat
npm install
```

This installs a single devDependency (Vite) into a local `node_modules`
folder. It does not require any account, login, or API key.

---

## 4. Environment variables

**None required — no `.env` file is needed to run this project.** The app
has no API keys, no backend URL, and no build-time secrets; it runs
entirely client-side with deterministic, embedded demo data. A
`.env.example` file is included only for completeness (it documents that
nothing is required and how to add variables later if you extend the
project with Vite's `VITE_` prefix convention).

---

## 5. Run development server

```bat
npm run dev
```

Vite starts a local dev server and opens it in your default browser
automatically. If it doesn't open, browse to:

**http://localhost:5173**

Leave this terminal window open while you use the app; press `Ctrl+C` in
the terminal to stop the server.

---

## 6. Production build

```bat
npm run build
```

Produces an optimized, minified static build in the `dist\` folder (HTML +
hashed/minified CSS + JS + fonts + favicon). `dist\` is fully
self-contained and can be copied anywhere or hosted on any static file
host — no build tooling or Node.js is required to run the output
afterward, only a static file server.

---

## 7. Preview the production build

```bat
npm run preview
```

Serves the contents of `dist\` locally, exactly as they'll behave in
production, so you can verify the build before deploying it anywhere:

**http://localhost:4173**

---

## Project structure

```
thermosrp/
├── index.html              Entry HTML (page shell: top bar, nav, screen containers, modal root)
├── package.json             npm scripts (dev / build / preview) + Vite devDependency
├── vite.config.js           Vite dev/build/preview configuration
├── .env.example              Documents that no environment variables are required
├── .gitignore
├── README.md                 This file
├── public/                  Static assets copied as-is into the build
│   ├── app.js                 Entire application: centralized state model, scenario engine,
│   │                           all 5 screens (Overview / Well Twin / Operations / What-If /
│   │                           Maintenance), the joint CSS+SRP counterfactual simulator,
│   │                           every chart/SVG builder, modals, and all interactions —
│   │                           identical logic to the published artifact.
│   └── assets/
│       ├── favicon.svg
│       └── fonts/              Self-hosted IBM Plex Sans / IBM Plex Mono (woff2, weights
│                                 400/500/600/700) + their SIL Open Font License files.
│                                 No Google Fonts / external CDN calls at runtime.
└── src/
    └── styles.css            All application CSS, including the local @font-face rules.
```

Two intentional notes on this structure vs. a typical scaffold:

- **No `tsconfig.json`.** The existing THERMO-SRP artifact is plain
  JavaScript, not TypeScript — adding a TypeScript config here would be
  configuration with nothing behind it, and the brief was explicit about
  not introducing a different stack than the one the artifact already
  uses. If you want to migrate to TypeScript later, that's a deliberate
  follow-up task, not part of this export.
- **`public/app.js` is a classic script, not a `src/` ES module.** Vite
  only bundles `<script type="module">` tags; a plain `<script src>` with
  no `type="module"` is correctly treated as a static asset and copied
  through untouched (verified in `dist/` during packaging). Loading it as
  a classic script — exactly like the original single-file artifact — is
  what keeps every dynamically-rendered `onclick="..."` handler working,
  since those resolve function names from the global scope, which ES
  modules deliberately do not expose. This was tested end-to-end: built,
  served with `vite preview`, and exercised with a full functional test
  covering navigation, the scenario engine, the joint CSS+SRP
  recommendation, and the mechanical safety gate — all passing against the
  actual production output, not just the source.

## What's included / not omitted

- All 5 screens: Overview, Well Twin, Operations, What-If, Maintenance.
- The full scenario engine (Normal → Thermal Degradation Detected → Risk
  Escalated → Adaptation Approved), demo strip (Previous/Advance/Reset),
  and live telemetry jitter.
- Well Decision Center, consolidated Active Issue card, Well Digital Twin
  schematic (pumpjack/wellbore/reservoir) + compact subsystem strip,
  Expected-vs-Actual residual analysis, Thermal State Trend, Risk Horizon,
  Dynamic Operating Envelope (SPM vs. Stroke with a rod-floating-aware
  safety gate), joint CSS+SRP What-If simulator + Scenario Comparison,
  Operation Replay, Well Health Report, Maintenance Intelligence (rod
  floating / pump unsetting / rod damage / failure risk), PS Requirement
  Coverage panel, Field Context panel, Engineering Mode, operator
  Approve/Hold flow, and every modal/diagnostic drawer.
- All styling (dark aerospace/GCS-derived theme, accessibility-tuned text
  sizes, shape-coded status indicators, keyboard focus states).
- All fonts, as local files — no network calls required at runtime.
- All calculations: Steam-Oil Ratio, energy consumption, relative
  operating-cost index, and the joint CSS+SRP counterfactual predictor are
  all live functions in `app.js`, not hardcoded display values — changing
  an input slider and clicking Simulate actually recomputes them.

Nothing was ported to a UI framework and no functionality was rewritten or
mocked out; `public/app.js` and `src/styles.css` are extracted verbatim
from the working artifact. There was no external/Claude-specific API in
the original artifact to begin with (it's a self-contained simulation), so
there is nothing to replace with a mock implementation — this is stated
explicitly per the request rather than left ambiguous.

## Notes

- `npm audit` may report a moderate advisory in `esbuild` (a transitive
  dependency of Vite's *dev server only* — see GHSA-67mh-4wv8-2f99). It
  affects `npm run dev` in the unlikely scenario of visiting a malicious
  website while the dev server is running, and has **no effect** on
  `npm run build` output or `npm run preview`. Run
  `npm audit fix --force` if you'd like to upgrade to the latest major
  Vite version; this project has been tested against Vite 5.
- This is a demonstration prototype with deterministic mock/simulated
  data (not connected to real field telemetry), consistent with how it's
  labeled throughout the UI itself ("synthetic demonstration data").
