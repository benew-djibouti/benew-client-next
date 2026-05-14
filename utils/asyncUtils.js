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
