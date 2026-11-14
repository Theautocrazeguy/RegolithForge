# RegolithForge Core Workspace Rules
# Non-negotiables & Technical Ground Truth (Overrides Blueprint)

These rules are permanent across all sessions for RegolithForge. They override any contrary statements in early project blueprints or design sketches.

## 1. Lunar Curvature in Horizon Raycaster
- The Moon curves away from any observer point.
- Effective height formula: `h_eff(d) = h(d) - d^2 / (2 * R_MOON)` where `R_MOON = 1,737,400 m`.
- At distance d = 20 km, the horizon drops by ~115 m. Omitting this causes massive overestimation of distant crater rim obstructions.
- All horizon mask algorithms must include lunar curvature. A unit test must assert the difference between flat and curved models.

## 2. JPL Horizons Observer Configuration
- Target: Sun (10), Earth (399).
- Observer location: location dictionary MUST specify `'body': 301` (Moon).
- Coordinates: Longitude (East-positive), Latitude (degrees), Elevation (km relative to reference sphere 1737.4 km).
- Atmospheric refraction: explicitly disabled (`airless`).
- Quantities requested: must include Azimuth, Elevation, Sun heliocentric distance `r` (AU), and Earth-observer distance `delta` (km).
- Validation: at least one time step must be validated against JPL Horizons web interface and logged in `docs/DATA_VALIDATION.md`.

## 3. Real Terrain First
- Use the real 20 m/pixel south-polar LOLA DEM (USGS Astrogeology / NASA PDS Geosciences Node).
- Handle South Polar Stereographic projection correctly (Moon reference sphere R = 1,737,400 m, standard parallel -90°).
- Account for grid convergence angle between map coordinates and true topocentric North.
- If network download or processing fails, fallback to synthetic terrain is permitted ONLY if labeled with a prominent `SYNTHETIC` badge in the UI.

## 4. Height Precision
- Heightmaps must be 16-bit (e.g., 16-bit grayscale PNG or Float32 `.bin` + metadata JSON).
- Document vertical quantization (e.g. 0.5 m/DN) and min/max elevation offsets.
- Never truncate or quantize heightmaps to 8-bit.

## 5. Shader-based Hazard Overlay
- Hazard highlighting must be implemented via GPU fragment shader sampling local slope texture.
- Highlight red above threshold; smoothly grade below threshold; blend with terrain PBR lighting.
- Never recolor the entire mesh geometry or replace the base terrain material globally.

## 6. Slope Threshold & Footprint Parameters
- Default critical slope threshold is 15° (configurable by user between 5° and 30°).
- UI must visibly display the caveat: "DEM-resolution-limited (20 m/px cannot resolve metric boulders or micro-craters)".
- Provide footprint-scale slope option (least-squares plane fit over lander footprint size, e.g., 5 m to 20 m).

## 7. Extended Solar Disc & Flux Scaling
- The Sun is an extended disc of angular diameter ≈ 0.53° (angular radius ≈ 0.265°), not a point source.
- Model partial illumination factor f_ill in [0.0, 1.0] when the solar disc intersects the local horizon profile.
- Solar constant S_0 = 1361 W/m² scaled by `(1 AU / r)^2` where r is the true heliocentric distance in AU from Horizons ephemeris.

## 8. Configurable Solar Array & Mast Height
- Support three array models:
  1. Vertical azimuth-tracking: `P = S * A * eta * cos(EL) * f_ill` (for EL >= 0)
  2. Fixed horizontal panel: `P = S * A * eta * sin(EL) * f_ill`
  3. Two-axis tracking panel: `P = S * A * eta * f_ill`
- Mast height `h_mast` must be an adjustable parameter (0 m, 2 m, 5 m, 10 m, 30 m). Observer elevation = `h_terrain + h_mast`.

## 9. Direct-to-Earth (DTE) Link & Geometric LOS
- The condition `EL_earth > horizon(AZ_earth)` is strictly Geometric Line-of-Sight (LOS).
- Label all DTE metrics as "Geometric LOS (unobstructed terrain vector)" unless a full RF link budget is computed.
- Compute auxiliary metrics: one-way distance `delta`, light travel time `tau = delta / c` (~1.24 to 1.35 s), free-space path loss (FSPL), and currently facing Deep Space Network (DSN) complex (Goldstone, Madrid, Canberra).

## 10. 3D Shadow and HUD Metric Consistency
- 3D visual shadow maps must match HUD numerical raycaster outputs.
- Maintain a verification test sampling at least 20 random (site, time) pairs ensuring visual illumination matches HUD horizon mask calculation within acceptable sampling tolerance.

## 11. Coordinate Systems & Units
- 1 world unit = 1 meter (or documented consistent scale).
- Standard topocentric scene coordinate frame:
  - `-Z` = North (towards lunar North / pole vector)
  - `+X` = East
  - `+Y` = Up (Zenith)
- Azimuth: 0° = North, 90° = East, 180° = South, 270° = West.
- Explicitly test for polar azimuth degeneracy and grid convergence near the pole.

## 12. Configurable Ephemeris Window
- Default time window: 2026-10-01T00:00:00Z to 2026-10-30T23:00:00Z (hourly steps).
- Time bounds, resolution, and mission duration must be configured in a single shared configuration file (`config/mission_config.json`) shared between Python data pipeline and TypeScript frontend.

## 13. Data Provenance & Honesty
- Every data layer must carry an explicit badge:
  - `REAL`: Unmodified NASA / USGS / JPL authoritative dataset.
  - `DERIVED`: Computed deterministically by RegolithForge pipeline or engine from real data.
  - `SYNTHETIC`: Procedural or placeholder fallback.
- Never present synthetic or mocked numbers as real lunar measurements.
