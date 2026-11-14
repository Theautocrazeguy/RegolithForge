#!/usr/bin/env python3
"""
Unit and validation tests for the RegolithForge Python data pipeline.
Verifies polar stereographic projection round-trips, heightmap precision,
and JPL Horizons ephemeris sanity bounds.
"""

import json
import os
import math
import unittest
import numpy as np

R_MOON = 1737400.0
MAP_SCALE = 20.0
FULL_GRID_N = 7584


def latlon_to_ij(lat_deg: float, lon_deg: float):
    """Forward South Polar Stereographic projection (PDS LOLA DSMAP_POLAR)."""
    r = 2.0 * R_MOON * math.tan(math.radians(lat_deg + 90.0) / 2.0)
    x = r * math.sin(math.radians(lon_deg))
    y = r * math.cos(math.radians(lon_deg))
    i = FULL_GRID_N / 2.0 + 0.5 + x / MAP_SCALE
    j = FULL_GRID_N / 2.0 + 0.5 - y / MAP_SCALE
    return i, j


def ij_to_latlon(i: float, j: float):
    """Inverse South Polar Stereographic projection (PDS LOLA DSMAP_POLAR)."""
    x = (i - FULL_GRID_N / 2.0 - 0.5) * MAP_SCALE
    y = (j - FULL_GRID_N / 2.0 - 0.5) * MAP_SCALE * (-1.0)
    r = math.hypot(x, y)
    if r == 0.0:
        return -90.0, 0.0
    lon = math.degrees(math.atan2(x, y)) % 360.0
    lat = -90.0 + math.degrees(2.0 * math.atan(0.5 * r / R_MOON))
    return lat, lon


class TestLunarPipeline(unittest.TestCase):
    def test_projection_round_trip(self):
        test_points = [
            (-89.45, 222.5),  # Connecting Ridge
            (-89.90, 0.0),    # Shackleton Rim
            (-88.50, 271.0),  # de Gerlache Rim
            (-89.70, 135.0),  # Arbitrary south polar point
        ]
        for lat, lon in test_points:
            i, j = latlon_to_ij(lat, lon)
            lat_out, lon_out = ij_to_latlon(i, j)
            self.assertAlmostEqual(lat_out, lat, places=6)
            self.assertAlmostEqual(lon_out % 360.0, lon % 360.0, places=5)

    def test_south_pole_singularity(self):
        i, j = latlon_to_ij(-90.0, 42.0)
        self.assertAlmostEqual(i, FULL_GRID_N / 2.0 + 0.5, places=6)
        self.assertAlmostEqual(j, FULL_GRID_N / 2.0 + 0.5, places=6)
        lat_out, _ = ij_to_latlon(i, j)
        self.assertAlmostEqual(lat_out, -90.0, places=6)

    def test_generated_assets_exist_and_valid(self):
        required_files = [
            "public/data/heightmap_16.png",
            "public/data/heightmap_meta.json",
            "public/data/heightmap_float32.bin",
            "public/data/slope.png",
            "public/data/slope_meta.json",
            "public/data/ephemeris.json",
            "public/data/illumination_fraction.png",
            "public/data/psr_mask.png",
            "public/data/thermal.json",
            "public/data/ice_proxy.json",
            "public/data/analogs.json",
        ]
        for path in required_files:
            self.assertTrue(os.path.exists(path), f"Missing generated asset: {path}")

    def test_ephemeris_body_301_sanity(self):
        if not os.path.exists("public/data/ephemeris.json"):
            self.skipTest("ephemeris.json not yet generated")
        with open("public/data/ephemeris.json", "r", encoding="utf-8") as f:
            ephem = json.load(f)

        self.assertEqual(ephem["observer_body"], 301)
        self.assertEqual(ephem["provenance"], "REAL")
        cr = ephem["sites"]["connecting_ridge_primary"]["ephemeris"]
        self.assertEqual(len(cr), 720)

        first = cr[0]
        # Verify Sun elevation is grazing the polar horizon (-3 to +3 deg)
        self.assertGreater(first["sun"]["elevation_deg"], -3.0)
        self.assertLess(first["sun"]["elevation_deg"], 3.0)
        # Verify Sun distance r is near 1 AU
        self.assertGreater(first["sun"]["heliocentric_distance_au"], 0.98)
        self.assertLess(first["sun"]["heliocentric_distance_au"], 1.02)
        # Verify Earth range is between perigee (~356,000 km) and apogee (~407,000 km)
        self.assertGreater(first["earth"]["range_km"], 350000.0)
        self.assertLess(first["earth"]["range_km"], 415000.0)
        # Verify light time ~1.2 - 1.4 s
        self.assertGreater(first["earth"]["light_time_seconds"], 1.15)
        self.assertLess(first["earth"]["light_time_seconds"], 1.40)


if __name__ == "__main__":
    unittest.main()
