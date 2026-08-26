"""
Cliente HTTP minimo (stdlib, sin dependencias) para hablarle a la API admin
de Odyssey. Compartido por los scripts mundo2_pronombres_*.py de esta carpeta.

Credenciales: por defecto usa el admin sembrado por SeedAdminUser()
(gather-rpg-backend/internal/database/seed.go) -- admin@odyssey.dev /
Admin123!, ya publico en el codigo del seed. Se puede sobreescribir con las
variables de entorno ODYSSEY_API_BASE / ODYSSEY_ADMIN_EMAIL /
ODYSSEY_ADMIN_PASSWORD si en algun momento se crea un admin dedicado.
"""
import json
import os
import urllib.error
import urllib.request

BASE = os.environ.get("ODYSSEY_API_BASE", "https://api.odisea-rpg.com")
ADMIN_EMAIL = os.environ.get("ODYSSEY_ADMIN_EMAIL", "admin@odyssey.dev")
ADMIN_PASSWORD = os.environ.get("ODYSSEY_ADMIN_PASSWORD", "Admin123!")


def call(method, path, body=None, token=None):
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(BASE + path, data=data, method=method)
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", "Bearer " + token)
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            raw = resp.read()
            return resp.status, (json.loads(raw) if raw else None)
    except urllib.error.HTTPError as e:
        raw = e.read()
        try:
            return e.code, json.loads(raw)
        except Exception:
            return e.code, raw.decode("utf-8", "replace")


def must(method, path, body, token, label):
    status, resp = call(method, path, body, token)
    if status >= 300:
        print(f"FAILED [{label}] {method} {path} -> {status}: {resp}")
        raise SystemExit(1)
    print(f"[ok] {label} -> {status}")
    return resp


def login():
    status, resp = call("POST", "/auth/login", {"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    if status != 200:
        print("LOGIN FAILED", status, resp)
        raise SystemExit(1)
    print("[ok] login")
    return resp["token"]
