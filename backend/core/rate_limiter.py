"""
Linsiq Rate Limiter
Prevents abuse and ensures fair usage across 1000 users.
"""
import time
import os
from typing import Dict, Tuple
from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware


class RateLimiter:
    """Token bucket rate limiter."""
    
    def __init__(self, rate: str = "100/minute"):
        # Parse rate string (e.g., "100/minute", "1000/hour")
        count, period = rate.split("/")
        self.max_requests = int(count)
        
        period_seconds = {
            "second": 1,
            "minute": 60,
            "hour": 3600,
            "day": 86400,
        }
        self.window = period_seconds.get(period, 60)
        
        # In-memory store: {client_id: (count, reset_time)}
        self._store: Dict[str, Tuple[int, float]] = {}
    
    def is_allowed(self, client_id: str) -> bool:
        now = time.time()
        
        # Clean old entries
        self._store = {
            k: v for k, v in self._store.items() 
            if v[1] > now
        }
        
        # Check client
        count, reset_time = self._store.get(client_id, (0, now + self.window))
        
        if now > reset_time:
            # Window expired, reset
            self._store[client_id] = (1, now + self.window)
            return True
        
        if count >= self.max_requests:
            return False
        
        self._store[client_id] = (count + 1, reset_time)
        return True
    
    def get_retry_after(self, client_id: str) -> int:
        """Seconds until rate limit resets."""
        _, reset_time = self._store.get(client_id, (0, time.time()))
        return max(0, int(reset_time - time.time()))


class RateLimitMiddleware(BaseHTTPMiddleware):
    """FastAPI middleware for rate limiting."""
    
    def __init__(self, app, rate: str = "100/minute"):
        super().__init__(app)
        self.limiter = RateLimiter(rate)
    
    async def dispatch(self, request: Request, call_next):
        # Skip rate limiting for health checks
        if request.url.path in ["/health", "/", "/docs", "/openapi.json"]:
            return await call_next(request)
        
        # Use client IP as identifier
        client_id = request.client.host if request.client else "unknown"
        
        if not self.limiter.is_allowed(client_id):
            retry_after = self.limiter.get_retry_after(client_id)
            raise HTTPException(
                status_code=429,
                detail=f"Rate limit exceeded. Retry after {retry_after} seconds.",
                headers={"Retry-After": str(retry_after)},
            )
        
        return await call_next(request)


def get_rate_limiter() -> RateLimiter:
    """Factory: Create rate limiter from environment config."""
    rate = os.getenv("RATE_LIMIT", "100/minute")
    return RateLimiter(rate)
