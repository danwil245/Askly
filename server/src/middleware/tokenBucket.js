/**
 * A tiny in-memory token-bucket rate limiter. Each key gets `capacity` tokens that
 * refill continuously at `capacity / windowMs`. `take()` returns false when empty.
 *
 * In-memory is intentional for a single-process deployment (see DECISIONS.md). A
 * distributed deployment would back this with Redis.
 */
export class TokenBucket {
  constructor({ capacity, windowMs }) {
    this.capacity = capacity;
    this.windowMs = windowMs;
    this.refillPerMs = capacity / windowMs;
    this.buckets = new Map(); // key -> { tokens, last }
  }

  take(key, cost = 1) {
    const now = Date.now();
    let b = this.buckets.get(key);
    if (!b) {
      b = { tokens: this.capacity, last: now };
      this.buckets.set(key, b);
    }
    // Refill based on elapsed time.
    const elapsed = now - b.last;
    b.tokens = Math.min(this.capacity, b.tokens + elapsed * this.refillPerMs);
    b.last = now;

    if (b.tokens >= cost) {
      b.tokens -= cost;
      return true;
    }
    return false;
  }

  /** Periodically drop idle buckets so the map doesn't grow unbounded. */
  sweep() {
    const now = Date.now();
    for (const [key, b] of this.buckets) {
      if (now - b.last > this.windowMs * 2 && b.tokens >= this.capacity) {
        this.buckets.delete(key);
      }
    }
  }

  reset() {
    this.buckets.clear();
  }
}
