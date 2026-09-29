"""Read-only Finney URL resolver. No RPC calls or signing operations."""
import hashlib
import json
import os
import re
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit, parse_qs

ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'

def ss58(evm):
    key = hashlib.blake2b(b'evm:' + bytes.fromhex(evm[2:]), digest_size=32).digest()
    body = bytes([42]) + key
    data = body + hashlib.blake2b(b'SS58PRE' + body, digest_size=64).digest()[:2]
    n = int.from_bytes(data, 'big')
    encoded = ''
    while n:
        n, r = divmod(n, 58)
        encoded = ALPHABET[r] + encoded
    return encoded

def valid_ss58(value):
    if len(value) != 48 or any(c not in ALPHABET for c in value):
        return False
    n = 0
    for c in value:
        n = n * 58 + ALPHABET.index(c)
    data = n.to_bytes((n.bit_length() + 7) // 8, 'big')
    return len(data) == 35 and data[0] == 42 and data[-2:] == hashlib.blake2b(b'SS58PRE' + data[:-2], digest_size=64).digest()[:2]

def main():
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.production')
    import django
    django.setup()
    from django.db import close_old_connections
    from safe_transaction_service.history.models import SafeContract
    from web3 import Web3

    lock = threading.Lock()
    cache = {}
    refreshed = 0

    def resolve(value):
        nonlocal cache, refreshed
        if re.fullmatch(r'0x[0-9a-fA-F]{40}', value):
            address = Web3.to_checksum_address(value)
            return {'chainId': '964', 'evm': address, 'ss58': ss58(address)}
        if not valid_ss58(value):
            raise ValueError('Invalid Finney address')
        with lock:
            if time.monotonic() - refreshed > 5:
                close_old_connections()
                cache = {ss58(a): a for a in SafeContract.objects.values_list('address', flat=True).iterator(chunk_size=1000)}
                refreshed = time.monotonic()
                close_old_connections()
            address = cache.get(value)
        if not address:
            return None
        return {'chainId': '964', 'evm': address, 'ss58': value}

    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            path = urlsplit(self.path)
            if path.path == '/healthz':
                return self.reply(200, {'ok': True})
            if path.path != '/resolve':
                return self.reply(404, {'error': 'Not found'})
            try:
                value = parse_qs(path.query).get('address', [''])[0]
                result = resolve(value)
                self.reply(200 if result else 404, result or {'error': 'This SS58 address has not been discovered yet. Open the Safe using its EVM address.'})
            except ValueError:
                self.reply(400, {'error': 'Invalid Finney address'})
            except Exception:
                self.reply(503, {'error': 'Address lookup temporarily unavailable'})

        def reply(self, status, data):
            encoded = json.dumps(data).encode()
            self.send_response(status)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Cache-Control', 'no-store')
            self.send_header('Content-Length', str(len(encoded)))
            self.end_headers()
            self.wfile.write(encoded)

        def log_message(self, *args):
            pass

    ThreadingHTTPServer(('0.0.0.0', 8090), Handler).serve_forever()

if __name__ == '__main__':
    main()
