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
        "relative overflow-hidden border-0 shadow-soft hover:shadow-lg transition-all duration-300 animate-in fade-in",
        {
          "bg-card": variant === "default",
          "bg-gradient-primary shadow-primary text-primary-foreground": variant === "primary",
          "bg-gradient-secondary shadow-secondary text-secondary-foreground": variant === "secondary",
        },
        className
      )}
      {...props}
    >
      {children}
    </Card>
  );
}