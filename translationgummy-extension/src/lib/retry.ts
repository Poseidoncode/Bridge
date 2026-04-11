interface RetryOptions {
  attempts: number;
  baseDelay: number;
  multiplier: number;
  maxDelay: number;
}

const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  attempts: 3,
  baseDelay: 100,
  multiplier: 2,
  maxDelay: 5000,
};

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const config = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let attempt = 0;

  while (attempt < config.attempts) {
    try {
      return await fn();
    } catch (error: any) {
      attempt++;

      if (error?.name === 'NotAllowedError') {
        throw error;
      }

      if (attempt >= config.attempts) {
        throw error;
      }

      const delay = Math.min(
        config.baseDelay * Math.pow(config.multiplier, attempt - 1),
        config.maxDelay
      );
      const jitter = delay * 0.2 * (Math.random() * 2 - 1);
      const finalDelay = Math.max(0, delay + jitter);

      await new Promise(resolve => setTimeout(resolve, finalDelay));
    }
  }

  throw new Error('Retry exhausted');
}
