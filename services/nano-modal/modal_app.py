"""Bounded GPU inference; existing Supabase workers own evidence validation."""
import os
import subprocess
import modal

MODEL = "Qwen/Qwen3-4B-Instruct-2507"
app = modal.App("unmask-nano-evaluation")
image = (modal.Image.from_registry("nvidia/cuda:12.9.0-devel-ubuntu22.04", add_python="3.12")
         .entrypoint([]).uv_pip_install("vllm==0.21.0"))
weights = modal.Volume.from_name("unmask-nano-model-cache", create_if_missing=True)

@app.function(image=image, gpu="A10G", max_containers=1, min_containers=0,
              scaledown_window=180, timeout=600,
              volumes={"/root/.cache/huggingface": weights},
              secrets=[modal.Secret.from_name(os.environ.get("UNMASK_NANO_SECRET_NAME", "unmask-nano-auth"))])
@modal.concurrent(max_inputs=32)
@modal.web_server(8000, startup_timeout=600)
def serve():
    # vLLM reads the key from the environment; never put it in process arguments/logs.
    os.environ["VLLM_API_KEY"] = os.environ["UNMASK_NANO_API_KEY"]
    subprocess.Popen(["vllm", "serve", MODEL, "--served-model-name", "unmask-nano",
                      "--host", "0.0.0.0", "--port", "8000", "--dtype", "half",
                      "--max-model-len", "8192", "--max-num-seqs", "32",
                      "--gpu-memory-utilization", "0.85", "--enforce-eager",
                      "--no-enable-log-requests"])
