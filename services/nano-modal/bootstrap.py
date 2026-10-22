"""Create endpoint credential on the runner; export only RSA-encrypted material."""
import base64
import json
import os
import secrets
import subprocess
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
