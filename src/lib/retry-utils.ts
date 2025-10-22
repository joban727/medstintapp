export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt === maxRetries) {
        throw lastError;
      }
      
      // Exponential backoff: 1000ms, 2000ms, 4000ms
      const delay = baseDelay * 2 ** attempt;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
}

export function withRetry<T>(
  fn: () => Promise<T>,
  options?: {
    maxRetries?: number;
    delay?: number;
    onRetry?: (error: Error, attempt: number) => void;
  }
): Promise<T> {
  const { maxRetries = 3, delay = 1000, onRetry } = options || {};
  
  return retryWithBackoff(fn, maxRetries, delay);
}