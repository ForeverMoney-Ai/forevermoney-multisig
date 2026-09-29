import unittest
from monitor import assess, transition

class MonitorTest(unittest.TestCase):
 def test_alert_dedup_and_recovery(self):
  state={}
  for i in range(3):
   state,msg=transition(state,['Safe indexing stalled'])
   self.assertEqual(msg is not None, i==2)
  state,msg=transition(state,['Safe indexing stalled']);self.assertIsNone(msg)
  state,msg=transition(state,[]);self.assertIn('recovered',msg)
  state,msg=transition(state,[]);self.assertIsNone(msg)
 def test_transient_resets(self):
  state,_=transition({},['API down']);state,_=transition(state,[])
  state,msg=transition(state,['API down']);self.assertEqual(state['failures'],1);self.assertIsNone(msg)
 def test_stale_rpc_even_if_synced(self):
  d={k:'2026-09-24T12:00:00Z' for k in ['currentBlockTimestamp','masterCopiesBlockTimestamp','erc20BlockTimestamp']}
  self.assertEqual(len(assess(d,1790251801)),3)
 def test_healthy(self):
  d={k:'2026-09-24T12:00:00Z' for k in ['currentBlockTimestamp','masterCopiesBlockTimestamp','erc20BlockTimestamp']}
  self.assertEqual(assess(d,1790251201),[])
if __name__=='__main__': unittest.main()
