# Architecture Decision Records (ADR) — RegolithForge

This log documents major architectural, data source, and technical decisions made during the development of RegolithForge.

---

## ADR-001: Technical Overrides to Initial Blueprint (Curvature, Horizons, 16-bit DEM)
- **Date**: 2026-11-14
- **Status**: Accepted
- **Context**: The project blueprint contained several mathematical and physical simplifications (omitting lunar curvature in horizon calculation, missing Moon body `301` in Horizons query, 8-bit heightmap generation, and mesh-wide recoloring for hazards).
- **Decision**: Implemented mandatory overrides codified in `.agent/rules/regolithforge-core.md` and `.agent/skills/lunar-math/SKILL.md`. All horizon calculations incorporate $h_{eff} = h - d^2 / (2R_{moon})$, heightmaps use 16-bit precision, JPL Horizons queries explicitly target body `301` (airless, Moon-centric), and hazards are rendered via GPU slope fragment shaders.
- **Consequences**: Rigorous physical accuracy matching peer-reviewed lunar mission planning tools; prevents severe obstruction overestimation at distant crater rims.
