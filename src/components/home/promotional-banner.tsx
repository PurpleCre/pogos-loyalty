import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight } from "lucide-react";
import foodBanner from "@/assets/food-banner.jpg";

interface PromotionalBannerProps {
  title: string;
  description: string;
  badgeText?: string;
  onClick?: () => void;
}

export function PromotionalBanner({ 
  title, 
  description, 
  badgeText = "Limited Time", 
  onClick 
}: PromotionalBannerProps) {
  return (
    <Card 
      className="relative overflow-hidden cursor-pointer shadow-soft transition-transform hover:scale-[1.02]"
      onClick={onClick}
    >
      <div className="absolute inset-0">
        <img 
          src={foodBanner} 
          alt="Promotional banner" 
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 to-black/30" />
      </div>
      
      <div className="relative p-6 text-white">
        <Badge variant="secondary" className="mb-3">
          {badgeText}
        </Badge>
        <h3 className="text-xl font-bold mb-2">{title}</h3>
        <p className="text-sm opacity-90 mb-4">{description}</p>
        <div className="flex items-center gap-2 text-sm font-medium">
          <span>Learn More</span>
          <ArrowRight className="h-4 w-4" />
        </div>
      </div>
    </Card>
  );
}