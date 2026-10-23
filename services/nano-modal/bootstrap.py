"""Create endpoint credential on the runner; export only RSA-encrypted material."""
import base64
import json
import os
import secrets
import subprocess
import time
import urllib.request
from pathlib import Path

import modal
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding

key = secrets.token_urlsafe(48)
name = "unmask-nano-auth-" + secrets.token_hex(6)
modal.Secret.objects.create(name, {"UNMASK_NANO_API_KEY": key})
os.environ["UNMASK_NANO_SECRET_NAME"] = name
subprocess.run(["modal", "deploy", "services/nano-modal/modal_app.py"], check=True)
url = modal.Function.from_name("unmask-nano-evaluation", "serve").get_web_url()
public = serialization.load_pem_public_key(Path("services/nano-modal/bootstrap-public.pem").read_bytes())
encrypted = public.encrypt(key.encode(), padding.OAEP(mgf=padding.MGF1(hashes.SHA256()), algorithm=hashes.SHA256(), label=None))
print("UNMASK_MODAL_BOOTSTRAP=" + json.dumps({"url": url, "encrypted_key": base64.b64encode(encrypted).decode(), "model": "unmask-nano"}))

# Warm the model once and publish timings without source text or credentials.
started = time.monotonic()
try:
    with urllib.request.urlopen(url + "/health", timeout=600) as response:
        print("UNMASK_MODAL_HEALTH=" + json.dumps({"status": response.status, "seconds": time.monotonic()-started}))
    request = urllib.request.Request(url + "/v1/chat/completions", data=json.dumps({
        "model": "unmask-nano", "max_tokens": 32, "temperature": 0,
        "response_format": {"type": "json_object"},
        "messages": [{"role": "user", "content": 'Return JSON {"ok":true}'}]
    }).encode(), headers={"Authorization": "Bearer " + key, "Content-Type": "application/json"})
    began = time.monotonic()
    with urllib.request.urlopen(request, timeout=120) as response:
        result = json.load(response)
    print("UNMASK_MODAL_SMOKE=" + json.dumps({"seconds": time.monotonic()-began, "usage": result.get("usage"), "output": result["choices"][0]["message"]["content"]}))
except Exception as error:
    print("UNMASK_MODAL_SMOKE_ERROR=" + type(error).__name__)
    from datetime import datetime, timedelta, timezone
    for entry in modal.Function.from_name("unmask-nano-evaluation", "serve").logs.fetch(since=datetime.now(timezone.utc)-timedelta(minutes=15)):
        print(entry.message.replace(key, "[redacted]"))
    raise
