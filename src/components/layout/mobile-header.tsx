import { ArrowLeft, Menu, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface MobileHeaderProps {
  title?: string;
  showBackButton?: boolean;
  showMenu?: boolean;
  showNotifications?: boolean;
  onBackClick?: () => void;
  onMenuClick?: () => void;
  onNotificationClick?: () => void;
  className?: string;
}

export function MobileHeader({
  title,
  showBackButton = false,
  showMenu = true,
  showNotifications = true,
  onBackClick,
  onMenuClick,
  onNotificationClick,
  className,
}: MobileHeaderProps) {
  return (
    <header className={cn(
      "flex items-center justify-between p-4 bg-background/95 backdrop-blur-sm border-b border-border sticky top-0 z-50",
      className
    )}>
      <div className="flex items-center gap-3">
        {showBackButton && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onBackClick}
            className="h-8 w-8"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
        {showMenu && !showBackButton && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onMenuClick}
            className="h-8 w-8"
          >
            <Menu className="h-4 w-4" />
          </Button>
        )}
        {title && (
          <h1 className="text-lg font-bold text-foreground">{title}</h1>
        )}
      </div>
      
      {showNotifications && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onNotificationClick}
          className="h-8 w-8 relative"
        >
          <Bell className="h-4 w-4" />
          <div className="absolute -top-1 -right-1 h-3 w-3 bg-secondary rounded-full border-2 border-background" />
        </Button>
      )}
    </header>
  );
}