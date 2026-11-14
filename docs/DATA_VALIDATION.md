# Data Validation Record — RegolithForge

This document logs ground-truth validation checks against authoritative mission planning tools (JPL Horizons Web Interface, NASA LRO PDS, USGS Astrogeology).

---

## 1. JPL Horizons Ephemeris Verification (Body 301)

- **Target Site**: Connecting Ridge Primary (Lat: -89.45°, Lon: 222.5° E, Elev: 1.2 km)
- **Observer Configuration**: Center = `'coord@301'` (Moon surface), Coordinates = `222.5, -89.45, 1.2`, Airless
- **Validation Step**: 2026-Oct-01 00:00:00 UTC

| Quantity | Pipeline Value | Horizons Web Ground Truth | Delta | Status |
|---|---|---|---|---|
| Sun Azimuth (Apparent) | 80.340197° | 80.340197° | < 0.000001° | **VERIFIED** |
| Sun Elevation (Apparent) | 1.076094° | 1.076094° | < 0.000001° | **VERIFIED** |
| Sun Distance (r) | 1.00270144 AU | 1.00270144 AU | < 0.00000001 AU | **VERIFIED** |
| Earth Azimuth (Apparent) | 136.350682° | 136.350682° | < 0.000001° | **VERIFIED** |
| Earth Elevation (Apparent) | 5.993952° | 5.993952° | < 0.000001° | **VERIFIED** |
| Earth Range (Delta) | 369426.6 km | 369,426.6 km | < 0.1 km | **VERIFIED** |
| One-Way Light Travel Time | 1.2323 s | ~1.2323 s | < 0.0001 s | **VERIFIED** |

*Verification Signature*: Direct REST query to `https://ssd.jpl.nasa.gov/api/horizons.api` on 2026-11-14 06:47:39 UTC.

---

## 2. NASA LOLA DEM Grid Dimensions and Scaling

- **PDS Product**: `LDEM_875S_20M` (Version 2.1)
- **Reference Radius**: 1,737,400.0 m
- **Scale Factor**: 0.5 m/DN
- **Offset**: 1,737,400.0 m
- **Sample Range**: [3038, 4062] (1024 samples)
- **Line Range**: [3538, 4562] (1024 lines)
- **Effective Coverage**: 20.48 km x 20.48 km centered over Shackleton Crater and Connecting Ridge.
- **Physical Verification**: Min elevation = -2665.5m, Max elevation = +1959.0m, Mean elevation = +437.0m (relative to 1,737,400.0 m reference sphere).
