import pathlib
import sys
import unittest
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[2]/'apps'/'voice-engine'))
from lease_deadline import LeaseDeadline
class DeadlineTests(unittest.TestCase):
 def test_monotonic_expiry_and_no_resurrection(self):
  now=[0.0]; lease=LeaseDeadline(1000,clock=lambda:now[0]);self.assertEqual(lease.remaining(),1.0)
  now[0]=0.5;lease.renew(1000);now[0]=1.25;self.assertFalse(lease.expired())
  now[0]=1.5;self.assertTrue(lease.expired())
  with self.assertRaisesRegex(ValueError,'LEASE_EXPIRED'):lease.renew(1000)
 def test_renewal_bounds(self):
  for duration in [True,0,99,60001,1.5]:
   with self.assertRaises(ValueError):LeaseDeadline(duration)
