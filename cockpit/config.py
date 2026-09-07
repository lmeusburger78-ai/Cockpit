"""Lädt die YAML-Konfiguration (Kennzahlen, Rollen, Hierarchie, Mapping-Profile)."""
from __future__ import annotations

from pathlib import Path

import yaml

KONFIG_DIR = Path(__file__).resolve().parent.parent / "config"


def _lade(pfad: Path) -> dict:
    with open(pfad, encoding="utf-8") as f:
        return yaml.safe_load(f) or {}


def lade_kpis(konfig_dir: Path = KONFIG_DIR) -> dict:
    return _lade(konfig_dir / "kpis.yaml")


def lade_rollen(konfig_dir: Path = KONFIG_DIR) -> dict:
    return _lade(konfig_dir / "rollen.yaml")


def lade_hierarchie(konfig_dir: Path = KONFIG_DIR) -> dict:
    return _lade(konfig_dir / "hierarchie.yaml")


def lade_mapping(name: str, konfig_dir: Path = KONFIG_DIR) -> dict:
    return _lade(konfig_dir / "mappings" / f"{name}.yaml")
