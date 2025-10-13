import { QrCode, Gift, Trophy, Users, User, LogOut, Shield, Home } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
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
import pogosLogo from "@/assets/pogos-logo.jpg";

const navigation = [
  { title: "Dashboard", url: "/dashboard", icon: Home },
  { title: "Rewards", url: "/rewards", icon: Gift },
  { title: "Achievements", url: "/achievements", icon: Trophy },
  { title: "Referrals", url: "/referrals", icon: Users },
  { title: "Profile", url: "/profile", icon: User },
];

export function DashboardSidebar() {
  const navigate = useNavigate();
  const location = useLocation();
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

  const handleScanQR = () => {
    window.dispatchEvent(new CustomEvent("open-qr-scanner"));
  };

  const isActiveRoute = (url: string) => location.pathname === url;

  return (
    <Sidebar className="border-r border-border" collapsible="icon">
      <div className="p-4 border-b flex items-center gap-3">
        <SidebarTrigger />
        {open && (
          <div className="flex items-center gap-2">
            <img 
              src={pogosLogo} 
              alt="Pogo's" 
              className="h-8 w-8 rounded-lg"
            />
            <span className="font-bold text-lg">Pogo's</span>
          </div>
        )}
      </div>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigation.map((item) => {
                const Icon = item.icon;
                const isActive = isActiveRoute(item.url);
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton 
                      onClick={() => navigate(item.url)} 
                      tooltip={item.title}
                      isActive={isActive}
                      className={isActive ? "bg-primary/10 text-primary" : ""}
                    >
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
          <SidebarGroupLabel>Actions</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={handleScanQR} tooltip="Scan QR Code">
                  <QrCode className="h-4 w-4" />
                  {open && <span>Scan QR</span>}
                </SidebarMenuButton>
              </SidebarMenuItem>
              
              {isAdmin && (
                <SidebarMenuItem>
                  <SidebarMenuButton 
                    onClick={() => navigate('/admin')} 
                    tooltip="Admin Panel"
                    isActive={isActiveRoute('/admin')}
                    className={isActiveRoute('/admin') ? "bg-primary/10 text-primary" : ""}
                  >
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
