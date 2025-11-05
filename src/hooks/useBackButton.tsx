import { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { App } from '@capacitor/app';
import { haptics } from '@/utils/haptics';
import { toast } from '@/hooks/use-toast';

export function useBackButton() {
  const navigate = useNavigate();
  const location = useLocation();
  const lastBackPress = useRef<number>(0);
  const EXIT_DELAY = 2000; // 2 seconds to press back again

  useEffect(() => {
    let listenerHandle: any;

    const setupListener = async () => {
      listenerHandle = await App.addListener('backButton', async ({ canGoBack }) => {
        await haptics.light();

        const currentPath = location.pathname;
        
        // If we're on the auth page or dashboard (root pages), handle exit
        if (currentPath === '/auth' || currentPath === '/dashboard' || currentPath === '/') {
          const now = Date.now();
          const timeSinceLastPress = now - lastBackPress.current;

          if (timeSinceLastPress < EXIT_DELAY) {
            // Second press within delay - exit app
            await haptics.medium();
            App.exitApp();
          } else {
            // First press - show toast
            lastBackPress.current = now;
            toast({
              title: "Press back again to exit",
              duration: 2000,
            });
          }
        } else if (canGoBack) {
          // Navigate back in history
          navigate(-1);
        } else {
          // No history, go to dashboard
          navigate('/dashboard');
        }
      });
    };

    setupListener();

    return () => {
      if (listenerHandle) {
        listenerHandle.remove();
      }
    };
  }, [navigate, location.pathname]);
}
