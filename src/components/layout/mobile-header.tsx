import { ArrowLeft, Menu, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
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
      "flex items-center justify-between p-4 bg-background/95 backdrop-blur-md border-b border-border sticky top-0 z-50 shadow-soft animate-in slide-in-from-top duration-300",
      "safe-area-inset-top",
      className
    )}>
      <div className="flex items-center gap-3">
        {showBackButton && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onBackClick}
            className="h-10 w-10"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
        )}
        {showMenu && !showBackButton && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onMenuClick}
            className="h-10 w-10"
          >
            <Menu className="h-5 w-5" />
          </Button>
        )}
        {title && (
          <h1 className="text-lg font-bold text-foreground truncate">{title}</h1>
        )}
      </div>
      
      <div className="flex items-center gap-2">
        <ThemeToggle />
        {showNotifications && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onNotificationClick}
            className="h-10 w-10 relative"
          >
            <Bell className="h-5 w-5" />
            <div className="absolute top-1 right-1 h-2.5 w-2.5 bg-secondary rounded-full border-2 border-background animate-pulse" />
          </Button>
        )}
      </div>
    </header>
  );
}