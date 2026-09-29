"""Bounded governance history backfill with request-level RPC throttling."""
import json
import time
from urllib.parse import urlsplit


class RpcPacer:
    def __init__(self, send, lock, sleep=time.sleep, clock=time.monotonic, interval=15):
        self.send, self.lock, self.sleep, self.clock = send, lock, sleep, clock
        self.interval, self.next_request = interval, 0

    def __call__(self, session, request, **kwargs):
        # Pace either supported archive provider; never pace unrelated services.
        host = urlsplit(request.url).hostname or ''
        if not (host.endswith('.onfinality.io') or host == 'archive.chain.opentensor.ai'):
            return self.send(session, request, **kwargs)
        with self.lock:
            try:
                payload = json.loads(request.body or '{}')
                weight = max(1, len(payload)) if isinstance(payload, list) else 1
            except (ValueError, TypeError):
                weight = 1
            for attempt in range(5):
                self.sleep(max(0, self.next_request - self.clock()))
                self.next_request = self.clock() + self.interval * weight
                response = self.send(session, request, **kwargs)
                limited = response.status_code == 429
                if response.status_code == 200:
                    try:
                        data = response.json()
                        entries = data if isinstance(data, list) else [data]
                        limited = any(isinstance(e, dict) and e.get('error', {}).get('code') in (-32029, -32004) for e in entries)
                    except ValueError:
                        pass
                if not limited:
                    return response
                try:
                    retry_after = float(response.headers.get('Retry-After', 0))
                except (ValueError, TypeError):
                    retry_after = 0
                delay = max(120 * 2 ** attempt, retry_after)
                response.close()
                self.next_request = max(self.next_request, self.clock() + delay)
                print('RPC_RATE_LIMIT wait_seconds=', delay, 'attempt=', attempt + 1, flush=True)
            raise RuntimeError('Archive RPC remains rate limited; stopping without skipping history')

