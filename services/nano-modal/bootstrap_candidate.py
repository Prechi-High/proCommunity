"""Deploy with a stable server-side secret; export only RSA-encrypted credentials."""
import json
import secrets
import subprocess
import modal


def main():
    name='unmask-nano-candidate-auth-v1'
    try:
        modal.Secret.from_name(name).hydrate()
    except modal.exception.NotFoundError:
        key=secrets.token_urlsafe(48)
        print('::add-mask::'+key,flush=True)
        modal.Secret.objects.create(name,{'UNMASK_NANO_API_KEY':key})
    subprocess.run(['modal','deploy','services/nano-modal/candidate_app.py'],check=True)
    url=modal.Cls.from_name('unmask-nano-optimized','Inference')().api.get_web_url()
    result=modal.Function.from_name('unmask-nano-optimized','bootstrap_report').remote(url)
    print('UNMASK_MODAL_CANDIDATE_BOOTSTRAP='+json.dumps(result['bootstrap']),flush=True)
    print('UNMASK_MODAL_HEALTH='+json.dumps(result['health']),flush=True)
    print('UNMASK_MODAL_SMOKE='+json.dumps(result['smoke']),flush=True)


if __name__=='__main__':main()
