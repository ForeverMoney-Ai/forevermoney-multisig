"""Bounded governance history backfill with request-level RPC throttling."""
import json
import time
from urllib.parse import urlsplit


class RpcPacer:
    def __init__(self, send, lock, sleep=time.sleep, clock=time.monotonic, interval=15):
        self.send, self.lock, self.sleep, self.clock = send, lock, sleep, clock
        self.interval, self.next_request = interval, 0

    def __call__(self, session, request, **kwargs):
        # Serialize all OnFinality HTTP requests in this backfill process.
        if not urlsplit(request.url).hostname.endswith('.onfinality.io'):
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


def run():
    import requests
    from gevent import sleep
    from gevent.lock import Semaphore
    from safe_transaction_service.history.services import IndexServiceProvider
    pacer = RpcPacer(requests.Session.send, Semaphore(), sleep=sleep)
    def send(session, request, **kwargs):
        return pacer(session, request, **kwargs)
    requests.Session.send = send
    # Importing the service initializes Django providers used by the indexer.
    IndexServiceProvider()
    addresses = {'0xADF60fcC63217961c931d57f1dCE2C5d70Af3546'}
    stop = 9122933
    from safe_transaction_service.history.indexers import Erc20EventsIndexerProvider

    def token_chunk(lo, hi):
        """Process exactly one fixed window without the service's 1-block fallback."""
        indexer = Erc20EventsIndexerProvider.get_new_instance()
        indexer.block_auto_process_limit = False
        elements = indexer.find_relevant_elements(addresses, lo, hi)
        return len(indexer.process_elements(elements))

    for phase, start, method in [('TOKEN', 8899146, token_chunk)]:
        print('PHASE_START', phase, start, stop, flush=True)
        for lo in range(start, stop + 1, 1000):
            hi = min(lo + 999, stop)
            for attempt in range(5):
                try:
                    n = method(lo, hi)
                    break
                except Exception as exc:
                    if attempt == 4:
                        raise
                    delay = 120 * 2**attempt
                    print('WINDOW_BACKOFF', phase, lo, type(exc).__name__, delay, flush=True)
                    time.sleep(delay)
            print('CHECKPOINT', phase, hi, 'events', n, flush=True)
        if phase == 'SAFE':
            s.reprocess_addresses(addresses)
        print('PHASE_COMPLETE', phase, flush=True)
    print('BACKFILL_COMPLETE through=', stop, flush=True)

if __name__ == '__main__':
    run()
