# Flight Control Lab

**An Interactive Journey Through Missile Autopilot Design and Target Interception**

Browser-based engineering demonstration with a real, deterministic numerical engine. Inspired by a Guidance and Control assignment and its corrected MATLAB implementations. The website does not simulate fictitious six-degree-of-freedom aerodynamics; the animated vehicle is explicitly identified as a visual projection of the supplied longitudinal linearized dynamics.

## Current working version

- **Autopilot:** corrected `+q` 3-state plant, first-order actuator, IMU acceleration and pitch-rate measurements, continuous-time LQE observer, integral feedback, command saturation, and an unknown actuator-command disturbance. Also includes theoretical full-state feedback and fixed-deflection open-loop modes.
- **Interception:** 2D proportional navigation, gravity compensation, ±2g normal acceleration constraint, ideal response and first-order lag response, moving target, event-accurate 5 m stopping radius, and trajectory/telemetry plots.
- **Visualization:** custom interactive three-dimensional projected generic vehicle, movable control surfaces, body-axis vectors, rotatable camera, chart cursors, playback/scrubbing, and a full-screen presentation mode. Vehicle attitude/deflection are visually **magnified with explicit on-screen disclosure** so the sub-degree physical motion can be seen. All displayed numeric values are the *unscaled* simulation outputs.
- **Verification:** `node --test` numerical regressions against MATLAB reference values; dedicated in-browser validation screen.
- **Deploy:** completely static; no mandatory runtime backend, numerical service or API, package install, or external JavaScript needed. The optional Google Font stylesheet is cosmetic only; the site works with local fallback fonts offline.

## Run locally

```bash
python -m http.server 8080
```

Open `http://localhost:8080/`. The application requires an HTTP server because native ES modules cannot normally be loaded from `file://`.

## Check and test

```bash
node --version      # >=20 recommended; tested with Node 22
npm test            # Node's built-in test runner (no npm install required)
npm run build       # verifies deployable static assets
```

No `node_modules` are required.

## Publish on GitHub Pages

1. Open **Repository → Settings → Pages → Build and deployment**.
2. Choose **GitHub Actions** as source.
3. Push a commit to `main`, or manually run **Actions → Test and deploy static laboratory → Run workflow**.
4. After a successful run, access `https://danielrouach.github.io/flight-control-lab/`.

The static assets use relative paths, so both a project Pages URL and a custom domain are supported. For a future custom domain, configure DNS and Pages custom domain settings (no domain currently assumed).

## Repository map

```text
index.html                    application screens and math panels
app.js                        UI state, playback, telemetry, presentation mode
styles.css                    responsive engineering dark theme
src/simulation/core.js        numerical plant, observer, controller, PN, RK4/events
src/charts/plot.js            synchronized canvas charts
src/visualization/airframe.js projected 3D vehicle + 2D interception scene
tests/numerics.test.mjs       baseline and invariance regression tests
docs/ENGINEERING.md           mathematical provenance and constraints
.github/workflows/ci.yml      continuous tests and GitHub Pages deployment
```

## Mathematical integrity

- Part 1 outputs **incremental body-down specific acceleration**, positive along body +Z, at a nominal 100 m/s airspeed.
- Part 2 uses **upward-positive** normal acceleration and constant interceptor speed 50 m/s by default. These models are *not* silently coupled.
- Commanded vs actual deflection/normal acceleration are always distinguished.
- No IMU random noise is introduced in nominal plots. The stated measurement covariance enters the reference LQE design, but the downloaded MATLAB gains are fixed for the nominal model.
- MATLAB uses `ode45` with `RelTol=1e-8`/`AbsTol=1e-9`; browser code uses fixed-step RK4 (1 ms for autopilot and 20 ms for guidance by default) with a bisection root search for hit-radius termination. This difference is reported and covered by regression checks.
- Browser validation **does not independently re-compute** gain/phase/delay margins or frequency responses; the MATLAB report remains the reference for these metrics.

See [ENGINEERING.md](docs/ENGINEERING.md) for exact equations and assumptions.

## Next iterations

Add richer 3D mesh detail, extended parametric robustness exploration, synchronized LOS-rate plots, more comparison modes, and optional React/TypeScript/Vite migration while preserving this independently testable, framework-free numerical baseline. Any full end-to-end autopilot/PN coupling must first have a justified speed/trim conversion and mathematical validation.
