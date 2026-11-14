# Data Sources & Attribution — RegolithForge

This project relies on open scientific data provided by NASA, USGS, and international lunar science teams. RegolithForge does not claim NASA endorsement and complies with all open-data citation standards.

---

## Authoritative Data Sources

1. **Lunar Reconnaissance Orbiter (LRO) LOLA (Lunar Orbiter Laser Altimeter)**
   - **Entity**: NASA Goddard Space Flight Center / PDS Geosciences Node / USGS Astrogeology.
   - **Product**: South Polar Digital Elevation Model (DEM) at 20 m/pixel (LOLA RDR / LDEM_80S or LDEM_875S series).
   - **Projection**: Polar Stereographic, spherical Moon radius $R = 1,737,400\text{ m}$.
   - **Usage**: Displaced 3D terrain, slope calculations, horizon occlusion raycasting.
   - **Provenance**: `REAL` (base elevation), `DERIVED` (slopes, horizon profiles, illumination fractions).

2. **JPL Horizons On-Line Solar System Data Service**
   - **Entity**: NASA Jet Propulsion Laboratory / Solar System Dynamics Group.
   - **Product**: High-precision topocentric ephemerides for Sun and Earth observed from lunar surface coordinates (Observer Body 301).
   - **Usage**: Real-time hourly azimuth, elevation, solar distance, Earth distance, and light travel time.
   - **Provenance**: `REAL`.

3. **LRO Diviner Lunar Radiometer Experiment**
   - **Entity**: NASA GSFC / UCLA / PDS Geosciences.
   - **Product**: Bolometric and surface brightness temperature maps of the lunar south pole.
   - **Usage**: Surface thermal environment overlays and cryogenic trap characterization.
   - **Provenance**: `REAL` (where available at tile resolution) / `DERIVED`.

4. **Lunar Prospector / LRO LEND Neutron Spectrometer Hydrogen Maps**
   - **Entity**: NASA PDS.
   - **Product**: Epithermal neutron count suppression mapping hydrogen / water-equivalent hydrogen (WEH) abundance.
   - **Usage**: Ice proxy resource overlay.
   - **Provenance**: `REAL` (coarse spatial resolution).

5. **Terrestrial Lunar Analog Sites**
   - **Entity**: Peer-reviewed planetary science literature & USGS Analog Database (e.g., Mauna Kea basaltic terrains, Antarctic Dry Valleys).
   - **Usage**: Comparative mission engineering telemetry and educational analog modules.
   - **Provenance**: `DERIVED` / `REAL (Literature-cited)`.
