import { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { haptics } from '@/utils/haptics';

const SWIPE_THRESHOLD = 100; // Minimum distance to trigger back navigation
const EDGE_THRESHOLD = 50; // Maximum distance from left edge to start swipe

export function useSwipeBack() {
  const navigate = useNavigate();
  const location = useLocation();
  const touchStartX = useRef<number>(0);
  const touchStartY = useRef<number>(0);
  const isSwiping = useRef<boolean>(false);

  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      touchStartX.current = touch.clientX;
      touchStartY.current = touch.clientY;
      
      // Only enable swipe if starting from left edge
      if (touch.clientX <= EDGE_THRESHOLD) {
        isSwiping.current = true;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isSwiping.current) return;

      const touch = e.touches[0];
      const deltaX = touch.clientX - touchStartX.current;
      const deltaY = Math.abs(touch.clientY - touchStartY.current);

      // Cancel swipe if moving more vertically than horizontally
      if (deltaY > deltaX) {
        isSwiping.current = false;
      }
    };

    const handleTouchEnd = async (e: TouchEvent) => {
      if (!isSwiping.current) return;

      const touch = e.changedTouches[0];
      const deltaX = touch.clientX - touchStartX.current;

      // Check if swipe distance exceeds threshold
      if (deltaX >= SWIPE_THRESHOLD) {
        // Don't go back from root pages
        const rootPages = ['/auth', '/dashboard', '/'];
        if (!rootPages.includes(location.pathname)) {
          await haptics.light();
          navigate(-1);
        }
      }

      isSwiping.current = false;
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: true });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [navigate, location.pathname]);
}
