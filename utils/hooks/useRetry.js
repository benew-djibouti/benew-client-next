// utils/hooks/useRetry.js
import { useEffect, useRef, useState } from 'react';
import { trackEvent } from '@/utils/analytics';

export function useRetry({ reset, page, maxRetries = 3 }) {
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  const timeoutRef = useRef(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleRetry = () => {
    if (retryCount >= maxRetries || isRetrying) return;

    setIsRetrying(true);
    setRetryCount((prev) => prev + 1);

    trackEvent('error_retry_attempt', {
      event_category: 'errors',
      page,
      retry_number: retryCount + 1,
    });

    const delay = Math.min(1000 * (retryCount + 1), 3000);

    timeoutRef.current = setTimeout(() => {
      setIsRetrying(false);
      reset();
    }, delay);
  };

  return {
    retryCount,
    isRetrying,
    handleRetry,
    canRetry: retryCount < maxRetries,
    isMaxRetriesReached: retryCount >= maxRetries,
  };
}
