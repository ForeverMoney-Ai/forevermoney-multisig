from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import urllib.request
import urllib.error
from urllib.parse import urlsplit, unquote

ROOT = Path(__file__).resolve().parents[1] / 'output/web'


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_GET(self):
        path = urlsplit(self.path).path
        if path.startswith(('/cgw/', '/txs/api/', '/address-resolver/', '/finney-decoder/')):
            try:
                with urllib.request.urlopen('https://safe.forevermoney.ai' + self.path, timeout=30) as response:
                    self.send_response(response.status)
                    self.send_header('Content-Type', response.headers.get('Content-Type', 'application/json'))
                    self.end_headers()
                    self.wfile.write(response.read())
            except urllib.error.HTTPError as error:
                self.send_error(error.code)
            return
        candidate = ROOT / unquote(path).lstrip('/')
        if not candidate.is_file() and candidate.with_suffix('.html').is_file():
            self.path = path + '.html'
        super().do_GET()


ThreadingHTTPServer(('127.0.0.1', 8772), Handler).serve_forever()
