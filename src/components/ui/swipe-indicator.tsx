import { ChevronRight } from 'lucide-react';

interface SwipeIndicatorProps {
  progress: number;
}

export function SwipeIndicator({ progress }: SwipeIndicatorProps) {
  if (progress === 0) return null;

  const opacity = Math.min(progress * 2, 1);
  const scale = 0.8 + progress * 0.2;

  return (
    <div
      className="fixed left-0 top-0 bottom-0 w-24 pointer-events-none z-50 flex items-center justify-start pl-4"
      style={{
        opacity,
        transform: `translateX(${progress * 20 - 20}px)`,
        transition: 'none',
      }}
    >
      <div
        className="bg-primary/20 backdrop-blur-sm rounded-full p-3 shadow-lg border border-primary/30"
        style={{
          transform: `scale(${scale})`,
          transition: 'transform 0.1s ease-out',
        }}
      >
        <ChevronRight
          className="h-6 w-6 text-primary"
          style={{
            transform: `rotate(${180 * progress}deg)`,
            transition: 'transform 0.2s ease-out',
          }}
        />
      </div>
    </div>
  );
}
