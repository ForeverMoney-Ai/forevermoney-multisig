"""Regression: builder URLs must never redirect to the internal HTTP listener."""
import sys, urllib.request, json
from pathlib import Path
base=sys.argv[1].rstrip('/')
class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl): return None
opener=urllib.request.build_opener(NoRedirect)
for path in ['/tx-builder','/tx-builder/','/tx-builder/review-and-confirm','/tx-builder/manifest.json']:
    with opener.open(base+path,timeout=15) as r:
        body=r.read()
        assert r.status==200
        if path.endswith('json'): assert json.loads(body)['name']=='Transaction Builder'
        else: assert b'<title>Transaction Builder Safe App</title>' in body
    print('PASS',path)
