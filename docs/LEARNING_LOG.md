# Learning Log — RegolithForge

This document logs key domain concepts, formulas, code locations, and interactive experiments created at each milestone for software engineering and astrodynamics learning.

---

## Milestone 0: Setup and Foundations

1. **Concepts Used**:
   - Spherical horizon geometry and lunar curvature drop.
   - Topocentric horizon coordinate systems vs. polar stereographic map projections.
   - Ephemeris generation with observer body anchoring (JPL Horizons Moon body 301).
   - Progressive disclosure and workspace rules in agentic engineering.

2. **Key Formula in Plain Language**:
   - *Curvature drop*: $h_{drop} = \frac{d^2}{2 R_{moon}}$. As you gaze across the lunar surface, the ground curves downward by the square of your distance divided by twice the Moon's radius ($1,737.4\text{ km}$). At $20\text{ km}$, the lunar horizon has fallen over $115\text{ meters}$ relative to your local tangent plane!

3. **File Where It Lives**:
   - [SKILL.md](file:///c:/Users/berga/Documents/Regolithforge/.agent/skills/lunar-math/SKILL.md) and [.agent/rules/regolithforge-core.md](file:///c:/Users/berga/Documents/Regolithforge/.agent/rules/regolithforge-core.md).

4. **One Experiment to Run**:
   - Calculate the drop at $d = 20\text{ km}$: $(20000)^2 / (2 \times 1737400) = 400,000,000 / 3,474,800 = 115.11\text{ m}$. Notice that without this correction, a crater rim $20\text{ km}$ away would appear over $100\text{ m}$ higher in your sky than it actually is, falsely blocking Earth or Sun line-of-sight!

---

## Milestone 1: Real LOLA Terrain & Moon-Centric Ephemeris Pipeline

1. **Concepts Used**:
   - HTTP Range extraction of raw 16-bit PDS raster data without multi-gigabyte downloads.
   - Moon-surface topocentric ephemerides via JPL Horizons API (Observer Body 301, airless).
   - 2D central-differences slope tensors ($p = \partial z/\partial x, q = \partial z/\partial y$).
   - Horizon rayfield precomputation with extended solar disc ($0.53^\circ$) penumbra integration.

2. **Key Formula in Plain Language**:
   - *Slope angle*: $\alpha = \arctan\left(\sqrt{(\Delta z_x / 2\Delta x)^2 + (\Delta z_y / 2\Delta y)^2}\right)$. The steepness at each point is the arctangent of the Pythagorean sum of elevation change rates along both grid directions.
   - *Free-Space Path Loss*: $\text{FSPL (dB)} = 20\log_{10}(d) + 20\log_{10}(f) - 147.55$. Signal strength drops with the square of the distance to Earth (~370,000 km), giving ~222.6 dB loss at X-band.

3. **File Where It Lives**:
   - `pipeline/build_assets.py` and `config/mission_config.json`.

4. **One Experiment to Run**:
   - Open `public/data/ephemeris.json` and compare the Sun's elevation between Oct 1 (1.08°) and Oct 30 (1.59°). Notice how the Moon's axial tilt causes the Sun to drift up and down by over half a degree, dramatically altering which ridge peaks stay sunlit!

---

## Milestone 2: Pure TypeScript Math Core & Web Workers

1. **Concepts Used**:
   - Pure astrodynamics/geometry (`src/core/`) separated from React/WebGL and offloaded to Web Workers (`src/workers/`).
   - Circular-segment solar disc occultation ($0.533^\circ$ angular diameter) instead of binary point-source sun shadows.
   - Least-squares plane fitting over a lander's physical footprint for slope safety.
   - Directional slope-constrained A* pathfinding with regolith rolling resistance and gravity work.

2. **Key Formula in Plain Language**:
   - *Partial solar disc illumination*: $f_{\text{ill}} = \frac{1}{\pi}[\arccos(-x) + x\sqrt{1 - x^2}]$, where $x = (\theta_\odot - H(\phi_\odot)) / R_\odot$. When the Sun's center sits right on the ridge horizon ($x = 0$), exactly 50% of the solar disc shines over the rim.

3. **File Where It Lives**:
   - [`src/core/horizon.ts`](file:///c:/Users/berga/Documents/Regolithforge/src/core/horizon.ts), [`src/core/power.ts`](file:///c:/Users/berga/Documents/Regolithforge/src/core/power.ts), and [`src/core/__tests__/mathCore.test.ts`](file:///c:/Users/berga/Documents/Regolithforge/src/core/__tests__/mathCore.test.ts).

4. **One Experiment to Run**:
   - Run `npm test` and inspect the curvature test in `mathCore.test.ts`: at 20 km distance, a 500 m peak appears $115.1\text{ m}$ lower due to lunar curvature, and a vertical tracking solar panel captures $>30\times$ more power than a flat horizontal panel at $1.5^\circ$ polar Sun elevation!

---

## Milestones 3 & 4: 3D Lunar Scene, Fragment Shader Overlays & Mission HUD

1. **Concepts Used**:
   - Fragment shader injection (`onBeforeCompile` on `MeshStandardMaterial`) to blend slope hazards, Peaks of Eternal Light, and PSRs per-pixel while preserving Three.js PCF directional shadows.
   - Logarithmic depth buffer (`logarithmicDepthBuffer: true`) to prevent z-fighting across a $20.48\text{ km}$ terrain tile with meter-scale lander markers.
   - Screen-space vs. world-space point sizing (`sizeAttenuation={false}` uses screen pixels, not meters).

2. **Key Formula in Plain Language**:
   - *Polar chart projection*: Elevation angles $[-10^\circ, +30^\circ]$ map linearly to radial distance from the center zenith, so the irregular terrain horizon forms a closed sky-mask polygon around the Sun and Earth trajectories.

3. **Files Where They Live**:
   - [`src/scene/TerrainMesh.tsx`](file:///c:/Users/berga/Documents/Regolithforge/src/scene/TerrainMesh.tsx), [`src/scene/Lighting.tsx`](file:///c:/Users/berga/Documents/Regolithforge/src/scene/Lighting.tsx), [`src/ui/planner/MissionHUD.tsx`](file:///c:/Users/berga/Documents/Regolithforge/src/ui/planner/MissionHUD.tsx), [`src/ui/planner/HorizonPolarChart.tsx`](file:///c:/Users/berga/Documents/Regolithforge/src/ui/planner/HorizonPolarChart.tsx).

4. **One Experiment to Run**:
   - Toggle the **Solar Mast Height** between `0m` and `30m` on Connecting Ridge Primary and watch the `SUNLIT %` and `MAX DARK` telemetry update live in ~5–12 ms via the Web Worker!

---

## Milestones 5–8: Site Finder, Explorer Mode, A* Rover Traverse & Pitch Tools

1. **Concepts Used**:
   - Two-stage Web Worker site scoring (coarse 32px pre-filter + exact curvature-corrected shortlist ranking).
   - Directional slope-constrained A* pathfinding with regolith rolling resistance and gravitational climbing work.
   - URL-encoded state serialization for reproducible mission sharing.

2. **Key Formula in Plain Language**:
   - *Rover Mechanical Energy*: $E = \sum \Delta s \cdot [C_{\text{roll}} m g_{\text{moon}} \cos(\alpha) + m g_{\text{moon}} \sin(\alpha_{\text{uphill}})]$. Driving uphill costs extra gravitational potential energy that is not recovered on descents.

3. **Files Where They Live**:
   - [`src/ui/planner/SiteFinderPanel.tsx`](file:///c:/Users/berga/Documents/Regolithforge/src/ui/planner/SiteFinderPanel.tsx), [`src/ui/planner/TraversePanel.tsx`](file:///c:/Users/berga/Documents/Regolithforge/src/ui/planner/TraversePanel.tsx), [`src/ui/planner/MissionToolsPanel.tsx`](file:///c:/Users/berga/Documents/Regolithforge/src/ui/planner/MissionToolsPanel.tsx), [`src/ui/explorer/ExplorerHUD.tsx`](file:///c:/Users/berga/Documents/Regolithforge/src/ui/explorer/ExplorerHUD.tsx).

4. **One Experiment to Run**:
   - In the **Rover** tab, toggle **"Prefer Sunlit Segments"** off and on while routing to the Nearest PSR and compare the `EST. TIME / SUNLIT %` and `MECH. ENERGY (Wh)` trade-off!

---

## Milestone 9 — Polish, Performance, Accessibility & Static Deployment

1. **Concepts used:** Frame-time / FPS telemetry via `requestAnimationFrame` delta averaging, Web Worker round-trip latency instrumentation, reduced-motion media queries (`prefers-reduced-motion`), keyboard-first HUD navigation, and immutable static asset caching for offline-first CDN delivery.
2. **Key formula in plain language:** Rolling FPS is `N / ΣΔt` over the last 30 animation frames (`60 Hz` target = `16.67 ms/frame` budget), while worker latency measures wall-clock `performance.now()` from `postMessage` dispatch to result receipt so UI interaction stays decoupled from terrain raycasting and A* pathfinding.
3. **Where it lives:** `src/ui/PerfHUD.tsx`, `src/ui/planner/MissionHUD.tsx` (keyboard shortcuts + Perf toggle), `src/index.css` (`prefers-reduced-motion`), `netlify.toml`, and `README.md`.
4. **One experiment to try:** Press `P` to open the Performance HUD, then click across the 3D terrain or scrub the timeline while watching `Worker` latency and `FPS` — notice how Web Workers keep the main UI thread responsive even during 360° horizon raycasts.
