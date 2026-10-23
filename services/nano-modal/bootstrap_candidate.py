"""Create endpoint credential on the runner; export only RSA-encrypted material."""
import base64
import json
import os
import secrets
import subprocess
import time
import urllib.request
import urllib.error
from pathlib import Path

import modal
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding

# Keep the endpoint credential stable across deployments so existing callers keep working.
name = "unmask-nano-candidate-auth-v1"
try:
    known=modal.Secret.from_name(name)
    known.hydrate()
except modal.exception.NotFoundError:
    key=secrets.token_urlsafe(48)
    print("::add-mask::"+key,flush=True)
    modal.Secret.objects.create(name,{"UNMASK_NANO_API_KEY":key})
else:
    helper=modal.App("unmask-nano-bootstrap")
    @helper.function(secrets=[known])
    def retrieve_key():
        import os
        return os.environ["UNMASK_NANO_API_KEY"]
    with helper.run():key=retrieve_key.remote()
    print("::add-mask::"+key,flush=True)
os.environ["UNMASK_NANO_SECRET_NAME"] = name
subprocess.run(["modal", "deploy", "services/nano-modal/candidate_app.py"], check=True)
url = modal.Cls.from_name("unmask-nano-optimized", "Inference")().api.get_web_url()
public = serialization.load_pem_public_key(Path("services/nano-modal/bootstrap-public.pem").read_bytes())
encrypted = public.encrypt(key.encode(), padding.OAEP(mgf=padding.MGF1(hashes.SHA256()), algorithm=hashes.SHA256(), label=None))
print("UNMASK_MODAL_CANDIDATE_BOOTSTRAP=" + json.dumps({"url": url, "encrypted_key": base64.b64encode(encrypted).decode(), "model": "unmask-nano"}))

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
    # Endpoint routing can briefly retain the previous deployment and credential.
    deadline=time.monotonic()+600
    while True:
        try:
            with urllib.request.urlopen(request, timeout=180) as response:
                result=json.load(response)
            break
        except urllib.error.HTTPError as error:
            if error.code not in (401,502,503) or time.monotonic()>=deadline:raise
            time.sleep(3)
    print("UNMASK_MODAL_SMOKE=" + json.dumps({"seconds": time.monotonic()-began, "usage": result.get("usage"), "output": result["choices"][0]["message"]["content"]}))
except Exception as error:
    print("UNMASK_MODAL_SMOKE_ERROR=" + type(error).__name__)
    raise
