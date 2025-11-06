import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Star, Gift } from "lucide-react";
import { Reward } from "@/hooks/useRewards";

interface RewardPreviewDialogProps {
  reward: Reward | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentPoints: number;
  onRedeem: (rewardId: string, pointsCost: number, rewardName: string) => void;
  isRedeeming: boolean;
}

export function RewardPreviewDialog({
  reward,
  open,
  onOpenChange,
  currentPoints,
  onRedeem,
  isRedeeming,
}: RewardPreviewDialogProps) {
  if (!reward) return null;

  const canRedeem = currentPoints >= reward.points_cost;

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'food':
        return '🍔';
      case 'drink':
        return '🥤';
      case 'special':
        return '🎉';
      default:
        return '🎁';
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'food':
        return 'bg-orange-100 text-orange-800';
      case 'drink':
        return 'bg-blue-100 text-blue-800';
      case 'special':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="text-4xl">
              {getCategoryIcon(reward.category)}
            </div>
            <div className="flex-1">
              <DialogTitle className="text-xl">{reward.name}</DialogTitle>
              <Badge className={`${getCategoryColor(reward.category)} mt-1`}>
                {reward.category}
              </Badge>
            </div>
          </div>
          <DialogDescription className="text-base pt-2">
            {reward.description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-4">
          <div className="flex items-center justify-between p-4 rounded-lg bg-muted">
            <div className="flex items-center gap-2">
              <Star className="h-5 w-5 text-primary" />
              <span className="font-semibold text-lg">{reward.points_cost} points</span>
            </div>
            <div className="text-sm text-muted-foreground">
              {canRedeem ? (
                <span className="text-green-600 font-medium">✓ Available</span>
              ) : (
                <span className="text-destructive font-medium">
                  Need {reward.points_cost - currentPoints} more
                </span>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={() => {
                onRedeem(reward.id, reward.points_cost, reward.name);
                onOpenChange(false);
              }}
              disabled={!canRedeem || isRedeeming}
              className="flex-1"
              size="lg"
            >
              <Gift className="mr-2 h-4 w-4" />
              {isRedeeming ? 'Redeeming...' : 'Redeem Now'}
            </Button>
          </div>

          <p className="text-xs text-center text-muted-foreground">
            Long press on any reward card to preview
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
