import os
import unittest

os.environ.setdefault('PRIMARY_RPC_URL', 'http://primary.invalid')
import rpc_guard
from rpc_guard import HEAD_ID, Guard


class FakeUpstream:
    """Answers each batch from the next scripted head; an int status entry fails the request."""

    def __init__(self, name, script):
        self.name, self.script, self.calls = name, list(script), 0

    def post(self, payload, timeout):
        self.calls += 1
        step = self.script.pop(0)
        if isinstance(step, tuple):
            return step[0], None, b''
        head, error = step if isinstance(step, list) else (step, False)
        body = []
        for item in payload:
            if item['id'] == HEAD_ID:
                body.append({'jsonrpc': '2.0', 'id': HEAD_ID, 'result': hex(head)})
            elif error:
                body.append({'jsonrpc': '2.0', 'id': item['id'], 'error': {'code': -32603, 'message': 'State already discarded'}})
            else:
                body.append({'jsonrpc': '2.0', 'id': item['id'], 'result': 'head-%d' % head})
        return 200, list(reversed(body)), b''


ITEMS = [{'jsonrpc': '2.0', 'id': 7, 'method': 'eth_getLogs', 'params': []}, {'jsonrpc': '2.0', 'id': 8, 'method': 'eth_chainId', 'params': []}]


def guard(primary, fallback=None):
    return Guard(FakeUpstream('primary', primary), FakeUpstream('fallback', fallback) if fallback is not None else None,
                 clock=lambda: 1792600000.0, sleep=lambda seconds: None)


class GuardTest(unittest.TestCase):
    def test_fresh_reply_keeps_request_order_and_drops_probe(self):
        replies, status = guard([100]).handle(ITEMS)
        self.assertEqual(status, 200)
        self.assertEqual([r['id'] for r in replies], [7, 8])

    def test_stale_backend_is_retried(self):
        g = guard([100, 43, 43, 101])
        g.handle(ITEMS)
        replies, _ = g.handle(ITEMS)
        self.assertEqual(replies[0]['result'], 'head-101')
        self.assertEqual(g.primary.calls, 4)
        self.assertEqual(g.snapshot()['stale_retries'], 2)

    def test_fallback_when_primary_stays_stale(self):
        g = guard([100] + [43] * rpc_guard.PRIMARY_ATTEMPTS, [100])
        g.handle(ITEMS)
        replies, _ = g.handle(ITEMS)
        self.assertEqual(replies[0]['result'], 'head-100')
        self.assertEqual(g.snapshot()['fallback_used'], 1)

    def test_fallback_errors_are_never_served(self):
        g = guard([100] + [43] * rpc_guard.PRIMARY_ATTEMPTS, [[100, True]])
        g.handle(ITEMS)
        replies, _ = g.handle(ITEMS)
        self.assertEqual(replies[0]['result'], 'head-43')
        self.assertEqual(g.snapshot()['served_stale'], 1)

    def test_fallback_budget_is_capped_per_day(self):
        g = guard([100], [100])
        self.assertTrue(g.take_fallback_budget(rpc_guard.FALLBACK_DAILY_CALLS))
        self.assertFalse(g.take_fallback_budget(1))
        g.clock = lambda: 1792600000.0 + 86400
        self.assertTrue(g.take_fallback_budget(1))

    def test_freshest_reply_served_without_fallback(self):
        g = guard([100] + [43, 44, 42, 41])
        g.handle(ITEMS)
        replies, status = g.handle(ITEMS)
        self.assertEqual((replies[0]['result'], status), ('head-44', 200))

    def test_rate_limit_status_reaches_caller(self):
        g = guard([(429,)] * rpc_guard.PRIMARY_ATTEMPTS)
        self.assertEqual(g.handle(ITEMS), (None, 429))


if __name__ == '__main__':
    unittest.main()
