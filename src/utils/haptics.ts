/**
 * Haptic feedback utilities for mobile devices
 * Uses Capacitor Haptics API when available, falls back gracefully
 */

import { Haptics, ImpactStyle } from '@capacitor/haptics';

export const haptics = {
  /**
   * Light impact feedback for small interactions (buttons, toggles)
   */
  light: async () => {
    try {
      await Haptics.impact({ style: ImpactStyle.Light });
    } catch {
      // Silently fail if not supported
    }
  },

  /**
   * Medium impact feedback for standard interactions
   */
  medium: async () => {
    try {
      await Haptics.impact({ style: ImpactStyle.Medium });
    } catch {
      // Silently fail if not supported
    }
  },

  /**
   * Heavy impact feedback for important actions
   */
  heavy: async () => {
    try {
      await Haptics.impact({ style: ImpactStyle.Heavy });
    } catch {
      // Silently fail if not supported
    }
  },

  /**
   * Selection feedback for picking items
   */
  selection: async () => {
    try {
      await Haptics.selectionStart();
      await Haptics.selectionChanged();
      await Haptics.selectionEnd();
    } catch {
      // Silently fail if not supported
    }
  },

  /**
   * Vibrate for notifications
   */
  notification: async () => {
    try {
      await Haptics.vibrate({ duration: 200 });
    } catch {
      // Silently fail if not supported
    }
  },
};
