import { ReactNode, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { SidebarProvider, useSidebar } from "@/components/ui/sidebar";
import { DashboardSidebar } from "@/components/layout/dashboard-sidebar";
import { MobileHeader } from "@/components/layout/mobile-header";
import { useAuth } from "@/hooks/useAuth";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useBackButton } from "@/hooks/useBackButton";
import { useSwipeBack } from "@/hooks/useSwipeBack";
import { SwipeIndicator } from "@/components/ui/swipe-indicator";
import { useIsMobile } from "@/hooks/use-mobile";

interface AuthenticatedLayoutProps {
  children: ReactNode;
}

function AuthenticatedContent({ children }: { children: ReactNode }) {
  const { toggleSidebar } = useSidebar();
  const isMobile = useIsMobile();

  return (
    <>
      {isMobile && (
        <MobileHeader
          showMenu={true}
          onMenuClick={toggleSidebar}
        />
      )}
      <div className="flex min-h-screen w-full bg-background relative">
        <DashboardSidebar />
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </>
  );
}

export function AuthenticatedLayout({ children }: AuthenticatedLayoutProps) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  useBackButton();
  const { swipeProgress } = useSwipeBack();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-warm flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <SidebarProvider>
      <SwipeIndicator progress={swipeProgress} />
      <AuthenticatedContent>
        {children}
      </AuthenticatedContent>
    </SidebarProvider>
  );
}
