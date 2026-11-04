"""Resolve KAYA_HOME for standalone skill scripts.

Returns the Kaya home directory (default: ``~/.kaya``).
"""
import os
from pathlib import Path


def get_kaya_home() -> Path:
    val = os.environ.get("KAYA_HOME", "").strip()
    return Path(val) if val else Path.home() / ".kaya"
