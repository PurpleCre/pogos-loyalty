import { useCallback, useRef } from 'react';
import { haptics } from '@/utils/haptics';

interface UseLongPressOptions {
  onLongPress: () => void;
  delay?: number;
}

export function useLongPress({ onLongPress, delay = 500 }: UseLongPressOptions) {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const longPressTriggered = useRef(false);

  const start = useCallback(() => {
    longPressTriggered.current = false;
    
    timeoutRef.current = setTimeout(async () => {
      await haptics.medium();
      longPressTriggered.current = true;
      onLongPress();
    }, delay);
  }, [onLongPress, delay]);

  const cancel = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const handleTouchStart = useCallback(() => {
    start();
  }, [start]);

  const handleTouchEnd = useCallback(() => {
    cancel();
  }, [cancel]);

  const handleTouchMove = useCallback(() => {
    cancel();
  }, [cancel]);

  const handleMouseDown = useCallback(() => {
    start();
  }, [start]);

  const handleMouseUp = useCallback(() => {
    cancel();
  }, [cancel]);

  const handleMouseLeave = useCallback(() => {
    cancel();
  }, [cancel]);

  return {
    onTouchStart: handleTouchStart,
    onTouchEnd: handleTouchEnd,
    onTouchMove: handleTouchMove,
    onMouseDown: handleMouseDown,
    onMouseUp: handleMouseUp,
    onMouseLeave: handleMouseLeave,
    onClick: (e: React.MouseEvent) => {
      if (longPressTriggered.current) {
        e.preventDefault();
        e.stopPropagation();
      }
    },
  };
}
