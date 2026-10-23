"""Canary inference with GPU snapshots and a private vLLM control plane."""
import os
import json
from pathlib import Path
import subprocess
import time
import modal

app = modal.App('unmask-nano-optimized')
image = (modal.Image.from_registry('nvidia/cuda:12.9.0-devel-ubuntu22.04',add_python='3.12')
         .entrypoint([]).add_local_file(Path(__file__).with_name('evidence-schemas.json'),'/opt/evidence-schemas.json',copy=True).uv_pip_install('vllm==0.21.0','fastapi==0.135.1','httpx==0.28.1','requests==2.32.5'))
weights = modal.Volume.from_name('unmask-nano-model-cache',create_if_missing=True)

@app.cls(image=image,gpu='H100',cpu=8,memory=16384,max_containers=2,min_containers=0,
         scaledown_window=600,timeout=600,volumes={'/root/.cache/huggingface':weights},
         enable_memory_snapshot=True,experimental_options={'enable_gpu_snapshot':True},
         secrets=[modal.Secret.from_name('unmask-nano-candidate-auth-v1')])
@modal.concurrent(max_inputs=64,target_inputs=16)
class Inference:
    @modal.enter(snap=True)
    def load(self):
        import requests
        os.environ['VLLM_API_KEY']=os.environ['UNMASK_NANO_API_KEY']
        os.environ['VLLM_SERVER_DEV_MODE']='1'
        self.process=subprocess.Popen(['vllm','serve','Qwen/Qwen3-4B-Instruct-2507',
           '--served-model-name','unmask-nano','--host','127.0.0.1','--port','8000',
           '--dtype','half','--max-model-len','8192','--max-num-seqs','64',
           '--gpu-memory-utilization','0.70','--max-cudagraph-capture-size','64','--enable-sleep-mode',
           '--enable-prefix-caching','--structured-outputs-config','{"disable_any_whitespace":true}','--no-enable-log-requests'])
        self.wait_ready()
        headers={'Authorization':'Bearer '+os.environ['UNMASK_NANO_API_KEY']}
        for _ in range(2):
            requests.post('http://127.0.0.1:8000/v1/chat/completions',headers=headers,
                json={'model':'unmask-nano','max_tokens':16,'messages':[{'role':'user','content':'Return JSON {"ok":true}'}]},timeout=90).raise_for_status()
        schemas=json.loads(Path('/opt/evidence-schemas.json').read_text())
        for stage, schema in schemas.items():
            requests.post('http://127.0.0.1:8000/v1/chat/completions',headers=headers,
                json={'model':'unmask-nano','max_tokens':256,'temperature':0,'response_format':schema,
                      'messages':[{'role':'user','content':'Return a minimal valid JSON object using this schema. Use ID 1 only. This is infrastructure warmup.'}]},timeout=180).raise_for_status()
        print('UNMASK_SNAPSHOT_PREPARED',flush=True)
        requests.post('http://127.0.0.1:8000/sleep?level=1',headers=headers,timeout=60).raise_for_status()

    def wait_ready(self):
        import requests
        deadline=time.monotonic()+480
        while time.monotonic()<deadline:
            if self.process.poll() is not None:raise RuntimeError('vLLM exited during startup')
            try:
                if requests.get('http://127.0.0.1:8000/health',timeout=2).ok:return
            except requests.RequestException:pass
            time.sleep(1)
        raise TimeoutError('vLLM startup deadline')

    @modal.enter(snap=False)
    def wake(self):
        import requests
        requests.post('http://127.0.0.1:8000/wake_up',headers={'Authorization':'Bearer '+os.environ['UNMASK_NANO_API_KEY']},timeout=60).raise_for_status()
        self.wait_ready()

    @modal.asgi_app()
    def api(self):
        import hmac
        import httpx
        from fastapi import FastAPI,Request,HTTPException
        from fastapi.responses import Response
        service=FastAPI(docs_url=None,redoc_url=None,openapi_url=None)
        @service.get('/health')
        async def health():return {'ready':True,'revision':'one-minute-v3'}
        @service.post('/v1/chat/completions')
        async def completions(request:Request):
            expected='Bearer '+os.environ['UNMASK_NANO_API_KEY']
            if not hmac.compare_digest(request.headers.get('authorization',''),expected):raise HTTPException(401)
            body=await request.body()
            if len(body)>500000:raise HTTPException(413)
            async with httpx.AsyncClient(timeout=90) as client:
                result=await client.post('http://127.0.0.1:8000/v1/chat/completions',content=body,headers={'Authorization':expected,'Content-Type':'application/json'})
            return Response(content=result.content,status_code=result.status_code,media_type='application/json')
        return service
