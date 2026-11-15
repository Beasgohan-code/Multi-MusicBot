"""Conservative supervisor-granted duration, never a worker-supplied wall-clock expiry."""
import time
class LeaseDeadline:
 def __init__(self,duration_ms,clock=time.monotonic):
  self.clock=clock
  self._validate(duration_ms)
  self.deadline=clock()+duration_ms/1000
 def _validate(self,duration):
  if type(duration) is not int or not 100<=duration<=60000:raise ValueError('LEASE_INVALID')
 def remaining(self):return max(0.0,self.deadline-self.clock())
 def expired(self):return self.remaining()<=0
 def renew(self,duration_ms):
  self._validate(duration_ms)
  if self.expired():raise ValueError('LEASE_EXPIRED')
  self.deadline=self.clock()+duration_ms/1000
