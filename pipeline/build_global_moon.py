"""
Downloads and processes real NASA SVS 4720 LRO/LROC WAC global albedo
and LOLA global elevation (ldem_4.tif) into offline-ready assets in public/data/.
"""

import pathlib
import numpy as np
import requests
from PIL import Image
import rasterio

ROOT = pathlib.Path(__file__).resolve().parent.parent
CACHE = ROOT / "pipeline" / ".cache"
OUT = ROOT / "public" / "data"

ALBEDO_URL = "https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_poles_2k.tif"
LDEM_URL = "https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/ldem_4.tif"

R_MOON_M = 1_737_400.0


def download_cached(url: str, dest: pathlib.Path) -> pathlib.Path:
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.exists() and dest.stat().st_size > 100_000:
        print(f"Using cached {dest.name}")
        return dest
    print(f"Downloading {url} -> {dest.name} ...")
    resp = requests.get(url, timeout=120)
    resp.raise_for_status()
    dest.write_bytes(resp.content)
    print(f"Saved {dest.name} ({dest.stat().st_size / 1e6:.2f} MB)")
    return dest


def build_albedo(tif_path: pathlib.Path, out_jpg: pathlib.Path) -> None:
    with rasterio.open(tif_path) as src:
        # Read RGB bands
        data = src.read([1, 2, 3]) if src.count >= 3 else np.repeat(src.read(1)[None, ...], 3, axis=0)
        img = np.transpose(data, (1, 2, 0))
        if img.dtype != np.uint8:
            img = np.clip(img, 0, 255).astype(np.uint8)
        pil_img = Image.fromarray(img, mode="RGB")
        pil_img.save(out_jpg, format="JPEG", quality=90, optimize=True)
        print(f"Wrote {out_jpg} ({pil_img.size[0]}x{pil_img.size[1]}, {out_jpg.stat().st_size / 1024:.1f} KB)")


def build_normal_map(ldem_path: pathlib.Path, out_png: pathlib.Path, relief_scale: float = 3.0) -> None:
    with rasterio.open(ldem_path) as src:
        elev_km = src.read(1).astype(np.float64)
        # NASA SVS ldem_4.tif stores elevation in km relative to 1737.4 km
        elev_m = elev_km * 1000.0
        h, w = elev_m.shape

        dlat = np.pi / h
        dlon = 2.0 * np.pi / w

        # Row latitudes from +90 deg (top) to -90 deg (bottom)
        lats = np.linspace(np.pi / 2 - dlat / 2, -np.pi / 2 + dlat / 2, h)[:, None]
        cos_lat = np.maximum(np.cos(lats), 0.08)

        # Wrap longitude for seamless horizontal gradient
        elev_pad_x = np.pad(elev_m, ((0, 0), (1, 1)), mode="wrap")
        dz_dlon = (elev_pad_x[:, 2:] - elev_pad_x[:, :-2]) / (2.0 * R_MOON_M * cos_lat * dlon)

        # Clamp vertical gradient at poles
        elev_pad_y = np.pad(elev_m, ((1, 1), (0, 0)), mode="edge")
        # Note: row index increases southward, so north derivative is -d/dy
        dz_dlat = -(elev_pad_y[2:, :] - elev_pad_y[:-2, :]) / (2.0 * R_MOON_M * dlat)

        nx = -dz_dlon * relief_scale
        ny = -dz_dlat * relief_scale
        nz = np.ones_like(nx)
        norm = np.sqrt(nx * nx + ny * ny + nz * nz)

        rgb = np.stack(
            [
                np.clip((nx / norm * 0.5 + 0.5) * 255.0, 0, 255),
                np.clip((ny / norm * 0.5 + 0.5) * 255.0, 0, 255),
                np.clip((nz / norm * 0.5 + 0.5) * 255.0, 0, 255),
            ],
            axis=-1,
        ).astype(np.uint8)

        pil_norm = Image.fromarray(rgb, mode="RGB")
        pil_norm.save(out_png, format="PNG", optimize=True)
        print(f"Wrote {out_png} ({w}x{h}, {out_png.stat().st_size / 1024:.1f} KB)")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    albedo_tif = download_cached(ALBEDO_URL, CACHE / "lroc_color_poles_2k.tif")
    ldem_tif = download_cached(LDEM_URL, CACHE / "ldem_4.tif")
    build_albedo(albedo_tif, OUT / "moon_global_albedo.jpg")
    build_normal_map(ldem_tif, OUT / "moon_global_normal.png")


if __name__ == "__main__":
    main()
