#!/usr/bin/env python3
"""Acquire a JWT for the BioInformatics serving API in RESTler token format."""

from __future__ import annotations

import json
import os
import sys

import requests


def main() -> int:
    base_url = os.environ.get("BIO_API_BASE_URL", "http://host.docker.internal:8001")
    username = os.environ.get("BIO_USERNAME", "admin")
    password = os.environ.get("BIO_PASSWORD", "admin123")

    login_url = f"{base_url.rstrip('/')}/api/auth/login"
    payload = {"username": username, "password": password}

    response = requests.post(login_url, json=payload, timeout=30)
    response.raise_for_status()

    data = response.json()
    token = data.get("access_token")
    if not token:
        raise RuntimeError("Login response did not include 'access_token'.")

    # RESTler expects metadata JSON on the first line and auth headers after that.
    print("{'bio':{}}")
    print(f"Authorization: Bearer {token}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:  # pragma: no cover - helper script
        print(f"Token acquisition failed: {exc}", file=sys.stderr)
        raise SystemExit(1)
