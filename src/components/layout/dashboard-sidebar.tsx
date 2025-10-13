import { QrCode, Gift, Trophy, Users, User, LogOut, Shield } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { toast } from "@/hooks/use-toast";

const quickActions = [
  { title: "Scan QR", url: "/dashboard?action=scan", icon: QrCode, action: "scan" },
  { title: "View Rewards", url: "/rewards", icon: Gift },
  { title: "Achievements", url: "/achievements", icon: Trophy },
  { title: "Refer Friends", url: "/referrals", icon: Users },
];

const userActions = [
  { title: "Profile", url: "/profile", icon: User },
];

export function DashboardSidebar() {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { isAdmin } = useAdmin();
  const { open } = useSidebar();

  const handleSignOut = async () => {
    const { error } = await signOut();
    if (error) {
      toast({
        title: "Error",
        description: "Failed to sign out",
        variant: "destructive",
      });
    } else {
      navigate('/auth');
    }
  };

  const handleNavigation = (item: typeof quickActions[0]) => {
    if (item.action === "scan") {
      // Dispatch custom event for QR scanner
      window.dispatchEvent(new CustomEvent("open-qr-scanner"));
    } else {
      navigate(item.url);
    }
  };

  return (
    <Sidebar className="border-r border-border" collapsible="icon">
      <div className="p-4 border-b">
        <SidebarTrigger />
      </div>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Quick Actions</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {quickActions.map((item) => {
                const Icon = item.icon;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton onClick={() => handleNavigation(item)} tooltip={item.title}>
                      <Icon className="h-4 w-4" />
                      {open && <span>{item.title}</span>}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Account</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {userActions.map((item) => {
                const Icon = item.icon;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton onClick={() => navigate(item.url)} tooltip={item.title}>
                      <Icon className="h-4 w-4" />
                      {open && <span>{item.title}</span>}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
              
              {isAdmin && (
                <SidebarMenuItem>
                  <SidebarMenuButton onClick={() => navigate('/admin')} tooltip="Admin Panel">
                    <Shield className="h-4 w-4" />
                    {open && <span>Admin Panel</span>}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}

              <SidebarMenuItem>
                <SidebarMenuButton onClick={handleSignOut} tooltip="Sign Out">
                  <LogOut className="h-4 w-4" />
                  {open && <span>Sign Out</span>}
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
