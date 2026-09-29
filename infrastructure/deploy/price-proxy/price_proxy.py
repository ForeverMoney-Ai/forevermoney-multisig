"""TAO/USD for the Client Gateway, read on-chain from the ForeverMoney USDC/TAO pool on Base.

Serves the small CoinGecko-shaped subset the gateway calls (PRICES_PROVIDER_API_BASE_URI):
  /api/v3/simple/price?ids=bittensor&vs_currencies=usd&include_24hr_change=true
  /api/v3/simple/supported_vs_currencies
Price = 30-minute pool TWAP, USDC valued at exactly $1. No API keys, no third-party price service.
Cluster-internal only; stdlib only.
"""
import json
import os
import threading
import time
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlsplit

POOL = os.environ.get('TAO_POOL', '0x99f0364e162a36a77e5d77b5eeb56539563735a3').lower()
USDC = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913'
TAO = '0xf3081494b87e8d5fb7960f066e931d1d0e6e3d67'
RPCS = [u.strip() for u in os.environ.get('BASE_RPC_URLS', 'https://mainnet.base.org,https://base-rpc.publicnode.com').split(',') if u.strip()]
COIN_ID = os.environ.get('COIN_ID', 'bittensor')
TWAP_SECONDS = int(os.environ.get('TWAP_SECONDS', '1800'))
CACHE_SECONDS = int(os.environ.get('CACHE_SECONDS', '60'))
MAX_STALE_SECONDS = int(os.environ.get('MAX_STALE_SECONDS', str(6 * 3600)))
DAY = 86400

_lock = threading.Lock()
_cache = {'price': None, 'change': None, 'at': 0.0, 'tried': 0.0}
_pool_checked = False


def rpc_call(data):
    body = json.dumps({'jsonrpc': '2.0', 'id': 1, 'method': 'eth_call', 'params': [{'to': POOL, 'data': data}, 'latest']}).encode()
    last = None
    for url in RPCS:
        try:
            req = urllib.request.Request(url, body, {'Content-Type': 'application/json', 'User-Agent': 'forevermoney-price-proxy'})
            with urllib.request.urlopen(req, timeout=10) as r:
                reply = json.load(r)
            if 'result' in reply:
                return reply['result']
            last = reply.get('error')
        except Exception as e:  # try the next RPC
            last = e
    raise RuntimeError('all Base RPCs failed: %s' % last)


def word(h, i):
    return h[2 + 64 * i:2 + 64 * (i + 1)]


def signed(w):
    v = int(w, 16)
    return v - (1 << 256) if v >= 1 << 255 else v


def check_pool():
    global _pool_checked
    if not _pool_checked:
        token0 = '0x' + rpc_call('0x0dfe1681')[-40:]
        token1 = '0x' + rpc_call('0xd21220a7')[-40:]
        if (token0, token1) != (USDC, TAO):
            raise RuntimeError('unexpected pool tokens %s/%s' % (token0, token1))
        _pool_checked = True


def tick_cumulatives(seconds_agos):
    n = len(seconds_agos)
    data = '0x883bdbfd' + '%064x' % 32 + '%064x' % n + ''.join('%064x' % s for s in seconds_agos)
    h = rpc_call(data)
    # (int56[] tickCumulatives, uint160[] secondsPerLiquidity): first array starts at the offset in word 0.
    start = int(word(h, 0), 16) // 32
    count = int(word(h, start), 16)
    return [signed(word(h, start + 1 + i)) for i in range(count)]


def usd_per_tao(avg_tick):
    # 1.0001^tick = raw TAO per raw USDC; USDC 6 decimals, TAO 18, USDC = $1.
    return 10 ** 12 / (1.0001 ** avg_tick)


def fetch():
    check_pool()
    c = tick_cumulatives([TWAP_SECONDS, 0])
    price = usd_per_tao((c[1] - c[0]) / TWAP_SECONDS)
    if not (0 < price < 1e7):
        raise RuntimeError('implausible price %r' % price)
    change = None
    try:  # 30-minute TWAP ending 24h ago; unavailable if the pool's history is shorter.
        old = tick_cumulatives([DAY + TWAP_SECONDS, DAY])
        change = (price / usd_per_tao((old[1] - old[0]) / TWAP_SECONDS) - 1) * 100
    except Exception:
        pass
    return price, change


def current():
    now = time.time()
    with _lock:
        if now - _cache['at'] > CACHE_SECONDS and now - _cache['tried'] > 5:
            _cache['tried'] = now
            try:
                _cache['price'], _cache['change'] = fetch()
                _cache['at'] = now
            except Exception as e:
                print('price refresh failed: %s' % e, flush=True)
        if _cache['price'] is None or now - _cache['at'] > MAX_STALE_SECONDS:
            return None, None
        return _cache['price'], _cache['change']


class Handler(BaseHTTPRequestHandler):
    def send(self, status, body):
        data = json.dumps(body).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        url = urlsplit(self.path)
        q = parse_qs(url.query)
        if url.path == '/healthz':
            return self.send(200, {'ok': True})
        if url.path == '/api/v3/simple/supported_vs_currencies':
            return self.send(200, ['usd'])
        if url.path.startswith('/api/v3/simple/token_price/'):
            return self.send(200, {})
        if url.path == '/api/v3/simple/price':
            ids = {i.strip().lower() for i in ','.join(q.get('ids', [])).split(',')}
            currencies = {c.strip().lower() for c in ','.join(q.get('vs_currencies', [])).split(',')}
            if COIN_ID not in ids or 'usd' not in currencies:
                return self.send(200, {})
            price, change = current()
            if price is None:
                return self.send(503, {'error': 'price unavailable'})
            entry = {'usd': round(price, 6), 'usd_24h_change': None if change is None else round(change, 4)}
            return self.send(200, {COIN_ID: entry})
        return self.send(404, {'error': 'not found'})

    def log_message(self, *args):
        pass


if __name__ == '__main__':
    ThreadingHTTPServer(('0.0.0.0', int(os.environ.get('PORT', '8080'))), Handler).serve_forever()
