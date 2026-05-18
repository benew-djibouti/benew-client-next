export function withTimeout(promise, timeoutMs, errorMessage = 'Timeout') {
  let timeoutId;

  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      const timeoutError = new Error(errorMessage);
      timeoutError.name = 'TimeoutError';
      reject(timeoutError);
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).then(
    (result) => {
      clearTimeout(timeoutId);
      return result;
    },
    (error) => {
      clearTimeout(timeoutId);
      throw error;
    },
  );
}

export async function executeWithRetry(
  operation,
  maxAttempts = 2,
  baseDelay = 100,
  classifyErrorFn = null,
) {
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (classifyErrorFn) {
        const errorInfo = classifyErrorFn(error);
        if (!errorInfo.shouldRetry || attempt === maxAttempts) throw error;
      } else if (attempt === maxAttempts) {
        throw error;
      }
      const delay = baseDelay * Math.pow(2, attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}
