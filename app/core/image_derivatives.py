"""Génération des dérivés JPEG allégés d'un screenshot (vignette "thumb", image
"detail") — module séparé de core.capture pour rester importable sans mss/psutil
(utilisé aussi par le build consultation-only, voir core.api_base)."""

from __future__ import annotations

from PIL import Image

THUMB_WIDTH = 240
THUMB_JPEG_QUALITY = 70
DETAIL_MAX_WIDTH = 1600
DETAIL_JPEG_QUALITY = 95


def save_resized_jpeg(image: Image.Image, path, max_width: int, quality: int) -> None:
    if image.width > max_width:
        ratio = max_width / image.width
        image = image.resize((max_width, round(image.height * ratio)), Image.LANCZOS)
    image.convert("RGB").save(path, "JPEG", quality=quality)
