import { SocialShare } from "./social-share";
import { Trophy, Star, Gift } from "lucide-react";

interface AchievementShareProps {
  type: "points" | "reward" | "milestone";
  value: string | number;
  title?: string;
  trigger?: React.ReactNode;
}

export function AchievementShare({ type, value, title, trigger }: AchievementShareProps) {
  const getShareContent = () => {
    switch (type) {
      case "points":
        return {
          title: "Points Achievement",
          message: `Just earned ${value} points at Pogo's! 🌟`,
          hashtags: ["PogosLoyalty", "Points", "Rewards"],
        };
      case "reward":
        return {
          title: "Reward Redeemed",
          message: `Just redeemed: ${value} at Pogo's! 🎁`,
          hashtags: ["PogosLoyalty", "Reward", "FreeFood"],
        };
      case "milestone":
        return {
          title: "Milestone Reached",
          message: `Reached ${value} milestone at Pogo's! 🏆`,
          hashtags: ["PogosLoyalty", "Milestone", "Achievement"],
        };
      default:
        return {
          title: "Pogo's Achievement",
          message: `Check out my achievement at Pogo's! ⭐`,
          hashtags: ["PogosLoyalty"],
        };
    }
  };

  const shareContent = getShareContent();

  return (
    <SocialShare
      title={title || shareContent.title}
      message={shareContent.message}
      hashtags={shareContent.hashtags}
      trigger={trigger}
    />
  );
}