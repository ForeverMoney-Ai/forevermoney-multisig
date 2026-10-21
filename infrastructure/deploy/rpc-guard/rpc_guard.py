"""Freshness guard between the Safe services and the Bittensor EVM archive RPC.

The primary provider load-balances every request across backends, and a lagging
backend answers with an old head and silently empty logs. Each request is sent
upstream as one batch together with eth_blockNumber, so the head proves which
state answered it; replies from a lagging backend are retried. When the primary
stays stale or fails, a capped fallback provider is tried. If nothing fresh
arrives, the freshest reply is returned so indexing is never worse than direct use.
Cluster-internal only; stdlib only. Upstream URLs carry credentials: never log them.
"""
import datetime as dt
import json
import os
import threading
import time
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PRIMARY_URL = os.environ['PRIMARY_RPC_URL']
FALLBACK_URL = os.environ.get('FALLBACK_RPC_URL', '')
MAX_LAG_BLOCKS = int(os.environ.get('MAX_LAG_BLOCKS', '10'))
PRIMARY_ATTEMPTS = int(os.environ.get('PRIMARY_ATTEMPTS', '20'))
# Safe's client times out regular calls at 15s; never start a retry past this point.
RETRY_WINDOW_SECONDS = float(os.environ.get('RETRY_WINDOW_SECONDS', '8'))
UPSTREAM_TIMEOUT_SECONDS = float(os.environ.get('UPSTREAM_TIMEOUT_SECONDS', '50'))
# Counted per JSON-RPC call, not per batch, to stay inside the fallback's daily plan.
FALLBACK_DAILY_CALLS = int(os.environ.get('FALLBACK_DAILY_CALLS', '1500'))
FALLBACK_MIN_INTERVAL_SECONDS = float(os.environ.get('FALLBACK_MIN_INTERVAL_SECONDS', '0.1'))
HEAD_ID = 'rpc-guard-head'
UNAVAILABLE = {'jsonrpc': '2.0', 'id': None, 'error': {'code': -32603, 'message': 'No RPC upstream available'}}
STATS_INTERVAL_SECONDS = 300


class Upstream:
    """One JSON-RPC provider; post() returns (status, parsed body or None, raw bytes)."""

    def __init__(self, name, url):
        self.name, self.url = name, url

    def post(self, payload, timeout):
        request = urllib.request.Request(self.url, json.dumps(payload).encode(), {
            'Content-Type': 'application/json', 'User-Agent': 'forevermoney-rpc-guard'})
        try:
            with urllib.request.urlopen(request, timeout=timeout) as response:
                raw = response.read()
                status = response.status
        except urllib.error.HTTPError as err:
            raw, status = err.read(), err.code
        try:
            return status, json.loads(raw), raw
        except ValueError:
            return status, None, raw


class Guard:
    def __init__(self, primary, fallback=None, clock=time.time, sleep=time.sleep):
        self.primary, self.fallback = primary, fallback
        self.clock, self.sleep = clock, sleep
        self.lock = threading.Lock()
        self.fallback_lock = threading.Lock()
        self.best_head = 0
        self.fallback_day, self.fallback_calls = None, 0
        self.fallback_next = 0.0
        self.stats = {'requests': 0, 'stale_retries': 0, 'fallback_used': 0, 'fallback_skipped': 0, 'served_stale': 0}

    def note(self, key):
        with self.lock:
            self.stats[key] += 1

    def observe(self, head):
        with self.lock:
            self.best_head = max(self.best_head, head)
            return head >= self.best_head - MAX_LAG_BLOCKS

    def take_fallback_budget(self, calls):
        day = dt.datetime.fromtimestamp(self.clock(), dt.timezone.utc).date()
        with self.lock:
            if day != self.fallback_day:
                self.fallback_day, self.fallback_calls = day, 0
            if self.fallback_calls + calls > FALLBACK_DAILY_CALLS:
                return False
            self.fallback_calls += calls
            return True

    def attempt(self, upstream, items, timeout):
        """Send items plus a head probe in one batch.

        Returns ((fresh, head, replies), 200) on success, or (None, http_status) on failure (0 = no response).
        """
        started = self.clock()
        methods = ','.join(sorted({str(item.get('method')) for item in items}))
        try:
            status, body, _ = upstream.post(items + [{'jsonrpc': '2.0', 'id': HEAD_ID, 'method': 'eth_blockNumber', 'params': []}], timeout)
        except Exception as err:
            print('[rpc-guard] %s request failed: %s after %.1fs (%s)' % (upstream.name, type(err).__name__, self.clock() - started, methods), flush=True)
            return None, 0
        if status != 200 or not isinstance(body, list):
            print('[rpc-guard] %s answered HTTP %s after %.1fs (%s)' % (upstream.name, status, self.clock() - started, methods), flush=True)
            return None, status
        replies = {}
        head = None
        for entry in body:
            if not isinstance(entry, dict):
                return None, status
            if entry.get('id') == HEAD_ID:
                try:
                    head = int(entry['result'], 16)
                except (KeyError, TypeError, ValueError):
                    return None, status
            else:
                replies[json.dumps(entry.get('id'))] = entry
        if head is None or any(json.dumps(item.get('id')) not in replies for item in items):
            return None, status
        return (self.observe(head), head, [replies[json.dumps(item.get('id'))] for item in items]), status

    def call_fallback(self, items, timeout):
        if not self.fallback:
            return None, 0
        if not self.take_fallback_budget(len(items) + 1):
            self.note('fallback_skipped')
            return None, 0
        # Serialised and spaced to respect the fallback's per-second limit.
        with self.fallback_lock:
            self.sleep(max(0.0, self.fallback_next - self.clock()))
            self.fallback_next = self.clock() + FALLBACK_MIN_INTERVAL_SECONDS
            return self.attempt(self.fallback, items, timeout)

    def handle(self, items):
        """Return (replies in item order, 200), or (None, status) when no upstream produced a usable answer.

        The failure status is the primary's last HTTP status, so a 429 still reaches the caller's pacer.
        """
        self.note('requests')
        started = self.clock()
        freshest = None
        failure = 0
        for number in range(PRIMARY_ATTEMPTS):
            if number and self.clock() - started > RETRY_WINDOW_SECONDS:
                break
            result, status = self.attempt(self.primary, items, UPSTREAM_TIMEOUT_SECONDS)
            if result is None:
                failure = status
                continue
            if result[0]:
                return result[2], 200
            self.note('stale_retries')
            if freshest is None or result[1] > freshest[1]:
                freshest = result
        result, _ = self.call_fallback(items, UPSTREAM_TIMEOUT_SECONDS)
        # The fallback is not an archive node: use it only when every call succeeded.
        if result is not None and not any('error' in reply for reply in result[2]):
            if result[0]:
                self.note('fallback_used')
                return result[2], 200
            if freshest is None or result[1] > freshest[1]:
                freshest = result
        if freshest is not None:
            self.note('served_stale')
            return freshest[2], 200
        return None, failure

    def snapshot(self):
        with self.lock:
            return dict(self.stats, best_head=self.best_head, fallback_calls_today=self.fallback_calls)


def make_handler(guard):
    class Handler(BaseHTTPRequestHandler):
        protocol_version = 'HTTP/1.1'

        def reply(self, status, body):
            data = body if isinstance(body, bytes) else json.dumps(body).encode()
            self.send_response(status)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        def do_GET(self):
            if self.path == '/healthz':
                return self.reply(200, dict(guard.snapshot(), ok=True))
            return self.reply(404, {'error': 'not found'})

        def do_POST(self):
            raw = self.rfile.read(int(self.headers.get('Content-Length') or 0))
            try:
                payload = json.loads(raw)
            except ValueError:
                return self.reply(400, {'jsonrpc': '2.0', 'id': None, 'error': {'code': -32700, 'message': 'Parse error'}})
            single = isinstance(payload, dict)
            items = [payload] if single else payload
            if not items or not all(isinstance(item, dict) and 'id' in item for item in items):
                # Notifications and malformed batches have no reply to check; pass them through.
                try:
                    status, _, body = guard.primary.post(payload, UPSTREAM_TIMEOUT_SECONDS)
                except Exception as err:
                    print('[rpc-guard] primary passthrough failed: %s' % type(err).__name__, flush=True)
                    return self.reply(502, UNAVAILABLE)
                return self.reply(status, body)
            replies, status = guard.handle(items)
            if replies is None:
                # Keep the primary's 429 so the worker pacer backs off; otherwise a plain gateway error.
                return self.reply(429 if status == 429 else 502, UNAVAILABLE)
            return self.reply(200, replies[0] if single else replies)

        def log_message(self, *args):
            pass

    return Handler


def report(guard):
    while True:
        time.sleep(STATS_INTERVAL_SECONDS)
        print('[rpc-guard] ' + json.dumps(guard.snapshot()), flush=True)


if __name__ == '__main__':
    guard = Guard(Upstream('primary', PRIMARY_URL), Upstream('fallback', FALLBACK_URL) if FALLBACK_URL else None)
    threading.Thread(target=report, args=(guard,), daemon=True).start()
    ThreadingHTTPServer(('0.0.0.0', int(os.environ.get('PORT', '8545'))), make_handler(guard)).serve_forever()
