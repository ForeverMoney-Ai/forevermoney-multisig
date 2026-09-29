"""Offline checks for inclusive coverage and rate-limit handling."""
import runpy
import threading
from pathlib import Path
root = Path(__file__).parent
window = runpy.run_path(str(root / 'continuous-sync.py'))['next_window']
assert window(100, 100) is None
assert window(100, 101) == (101, 101)
assert window(100, 1200) == (101, 1100)
assert window(1100, 1200) == (1101, 1200)
try:
    window(100, 99)
    raise AssertionError('stale head must be rejected')
except ValueError:
    pass
pacer_class = runpy.run_path(str(root / 'paced-backfill.py'))['RpcPacer']
now, calls = [0], []
class Request:
    url = 'https://bittensor-finney.api.onfinality.io/rpc'
    body = '{}'
class Response:
    def __init__(self, status):
        self.status_code = status
        self.headers = {'Retry-After': '180'}
    def json(self): return {'result': []}
    def close(self): pass
responses = iter([Response(429), Response(200), Response(200)])
def send(*args, **kwargs):
    calls.append(now[0])
    return next(responses)
def sleep(seconds): now[0] += seconds
pacer = pacer_class(send, threading.Lock(), sleep, lambda: now[0])
pacer(None, Request())
pacer(None, Request())
assert calls == [0, 180, 195], calls
now[0] = 0
calls.clear()
Request.url = 'https://archive.chain.opentensor.ai'
responses = iter([Response(429), Response(200), Response(200)])
pacer = pacer_class(send, threading.Lock(), sleep, lambda: now[0], interval=1)
pacer(None, Request())
pacer(None, Request())
assert calls == [0, 180, 181], calls
print('PASS: contiguous windows, single-block boundary, stale head, Retry-After preserved for both archive providers and pacing speeds')
