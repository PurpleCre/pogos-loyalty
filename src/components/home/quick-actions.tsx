import { Button } from "@/components/ui/button";
import { QrCode, Gift, ShoppingBag } from "lucide-react";
import { cn } from "@/lib/utils";

interface QuickActionsProps {
  onScanQR: () => void;
  onViewRewards: () => void;
  onOrderNow: () => void;
  className?: string;
}

const actions = [
  {
    id: "scan",
    label: "Scan QR",
    icon: QrCode,
    variant: "default" as const,
  },
  {
    id: "rewards",
    label: "View Rewards",
    icon: Gift,
    variant: "secondary" as const,
  },
  {
    id: "order",
    label: "Order Now",
    icon: ShoppingBag,
    variant: "outline" as const,
  },
];

export function QuickActions({ 
  onScanQR, 
  onViewRewards, 
  onOrderNow, 
  className 
}: QuickActionsProps) {
  const handlers = {
    scan: onScanQR,
    rewards: onViewRewards,
    order: onOrderNow,
  };

  return (
    <div className={cn("grid grid-cols-3 gap-3", className)}>
      {actions.map((action) => {
        const Icon = action.icon;
        return (
          <Button
            key={action.id}
            variant={action.variant}
            onClick={handlers[action.id as keyof typeof handlers]}
            className="flex flex-col gap-2 h-20 shadow-soft"
          >
            <Icon className="h-5 w-5" />
            <span className="text-sm">{action.label}</span>
          </Button>
        );
      })}
    </div>
  );
}