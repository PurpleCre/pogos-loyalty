import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

interface LoyaltyCardProps {
  className?: string;
  children?: React.ReactNode;
  variant?: "default" | "primary" | "secondary";
}

export function LoyaltyCard({ className, children, variant = "default", ...props }: LoyaltyCardProps) {
  return (
    <Card
      className={cn(
        "relative overflow-hidden border-0 shadow-soft",
        {
          "bg-card": variant === "default",
          "bg-gradient-primary shadow-primary": variant === "primary",
          "bg-gradient-secondary shadow-secondary": variant === "secondary",
        },
        className
      )}
      {...props}
    >
      {children}
    </Card>
  );
}