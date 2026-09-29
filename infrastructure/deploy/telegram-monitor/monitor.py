"""Read-only Safe sync checks; fixed Telegram destination and alert state."""
import datetime as dt
import json
import time
import urllib.request
from pathlib import Path

URL = 'http://ui:8080/txs/api/v1/about/indexing/'

def assess(data, now):
    problems = []
    for label, key in [('RPC head', 'currentBlockTimestamp'), ('Safe indexing', 'masterCopiesBlockTimestamp'), ('Token indexing', 'erc20BlockTimestamp')]:
        stamp = dt.datetime.fromisoformat(data[key].replace('Z', '+00:00')).timestamp()
        age = now - stamp
        if age < -60:
            raise ValueError('Unexpected future block timestamp')
        if age > 300:
            problems.append(f'{label} is {int(age // 60)} minutes behind')
    return problems

def transition(state, problems):
    new = dict(state)
    new['failures'] = state.get('failures', 0) + 1 if problems else 0
    message = None
    if problems and new['failures'] >= 3 and not state.get('alerted', False):
        new['alerted'] = True
        message = '⚠️ ForeverMoney Safe needs attention\n' + '\n'.join(problems) + '\nConfirmed on 3 consecutive checks.\nhttps://safe.forevermoney.ai'
    elif not problems and state.get('alerted', False):
        new['alerted'] = False
        message = '✅ ForeverMoney Safe recovered\nSafe and token indexing are within 5 minutes of current time; the sync API is responding.'
    return new, message

def redis(*args):
    import socket
    payload = ('*' + str(len(args)) + '\r\n').encode()
    for arg in args:
        raw = arg.encode()
        payload += ('$' + str(len(raw)) + '\r\n').encode() + raw + b'\r\n'
    with socket.create_connection(('redis', 6379), timeout=5) as conn:
        conn.sendall(payload)
        stream = conn.makefile('rb')
        line = stream.readline()
        if line.startswith(b'$'):
            size = int(line[1:])
            return None if size == -1 else stream.read(size).decode()
        if line == b'+OK\r\n': return 'OK'
        raise RuntimeError('Unexpected state response')

def send(message):
    config = json.loads(Path('/telegram/config.json').read_text())
    # No updates polling or user-supplied destinations: only this installed chat ID.
    request = urllib.request.Request('https://api.telegram.org/bot' + config['token'] + '/sendMessage',
        data=json.dumps({'chat_id': config['chat_id'], 'text': message, 'disable_web_page_preview': True}).encode(),
        headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(request, timeout=15) as response:
        if not json.load(response).get('ok'):
            raise RuntimeError('Telegram rejected delivery')

def main():
    state = json.loads(redis('GET', 'forevermoney:safe:sync-alert-state') or '{}')
    try:
        with urllib.request.urlopen(URL, timeout=20) as response:
            data = json.load(response)
        problems = assess(data, time.time())
    except Exception:
        problems = ['Sync API is unavailable or returned invalid data']
    new, message = transition(state, problems)
    if message:
        send(message)
    new.update(checked_at=dt.datetime.now(dt.timezone.utc).isoformat(), problems=problems)
    redis('SET', 'forevermoney:safe:sync-alert-state', json.dumps(new))
    print(json.dumps(new), flush=True)

if __name__ == '__main__':
    try:
        main()
    except Exception as exc:
        # Never log URLs from urllib exceptions: the Telegram URL contains a credential.
        print('Monitor failed: ' + type(exc).__name__, flush=True)
        raise SystemExit(1)
