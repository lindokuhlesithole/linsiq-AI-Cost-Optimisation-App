"""
Linsiq Caching Layer
Redis in production, in-memory dict fallback for local dev.
"""
import os
import json
import hashlib
import time
from typing import Optional, Any


class BaseCache:
    """Base cache interface."""
    
    def get(self, key: str) -> Optional[Any]:
        raise NotImplementedError
    
    def set(self, key: str, value: Any, ttl: int = 300) -> None:
        raise NotImplementedError
    
    def delete(self, key: str) -> None:
        raise NotImplementedError
    
    def clear(self) -> None:
        raise NotImplementedError


class MemoryCache(BaseCache):
    """In-memory cache for development / fallback."""
    
    def __init__(self):
        self._data = {}
        self._expires = {}
    
    def get(self, key: str) -> Optional[Any]:
        if key in self._expires and time.time() > self._expires[key]:
            self.delete(key)
            return None
        return self._data.get(key)
    
    def set(self, key: str, value: Any, ttl: int = 300) -> None:
        self._data[key] = value
        self._expires[key] = time.time() + ttl
    
    def delete(self, key: str) -> None:
        self._data.pop(key, None)
        self._expires.pop(key, None)
    
    def clear(self) -> None:
        self._data.clear()
        self._expires.clear()


class RedisCache(BaseCache):
    """Redis cache for production."""
    
    def __init__(self, redis_url: str):
        import redis
        self._client = redis.from_url(redis_url, decode_responses=True)
    
    def get(self, key: str) -> Optional[Any]:
        value = self._client.get(key)
        return json.loads(value) if value else None
    
    def set(self, key: str, value: Any, ttl: int = 300) -> None:
        self._client.setex(key, ttl, json.dumps(value))
    
    def delete(self, key: str) -> None:
        self._client.delete(key)
    
    def clear(self) -> None:
        self._client.flushdb()


def get_cache() -> BaseCache:
    """Factory: Returns Redis cache if available, else memory cache."""
    redis_url = os.getenv("REDIS_URL", "")
    cache_enabled = os.getenv("CACHE_ENABLED", "false").lower() == "true"
    
    if cache_enabled and redis_url and not redis_url.startswith("memory"):
        try:
            return RedisCache(redis_url)
        except Exception:
            pass  # Fall through to memory cache
    
    return MemoryCache()


# Global cache instance
cache = get_cache()


def cached(ttl: int = 300, key_prefix: str = "cache"):
    """Decorator to cache function results."""
    def decorator(func):
        def wrapper(*args, **kwargs):
            # Generate cache key from function name + args
            key_data = f"{key_prefix}:{func.__name__}:{str(args)}:{str(kwargs)}"
            cache_key = hashlib.md5(key_data.encode()).hexdigest()
            
            # Try cache first
            cached_value = cache.get(cache_key)
            if cached_value is not None:
                return cached_value
            
            # Call function and cache result
            result = func(*args, **kwargs)
            cache.set(cache_key, result, ttl)
            return result
        return wrapper
    return decorator
