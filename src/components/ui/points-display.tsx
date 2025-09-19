import { cn } from "@/lib/utils";

interface PointsDisplayProps {
  points: number;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function PointsDisplay({ points, className, size = "md" }: PointsDisplayProps) {
  return (
    <div className={cn(
      "flex items-center justify-center gap-2 font-bold",
      {
        "text-2xl": size === "sm",
        "text-3xl": size === "md", 
        "text-4xl": size === "lg",
      },
      className
    )}>
      <span className="text-primary">★</span>
      <span>{points.toLocaleString()}</span>
      <span className="text-sm font-normal opacity-70">points</span>
    </div>
  );
}