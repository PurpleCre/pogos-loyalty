import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MobileHeader } from "@/components/layout/mobile-header";
import { AdminUsers } from "@/components/admin/admin-users";
import { AdminRewards } from "@/components/admin/admin-rewards";
import { AdminTransactions } from "@/components/admin/admin-transactions";
import { AdminNotifications } from "@/components/admin/admin-notifications";
import { AdminOverview } from "@/components/admin/admin-overview";
import { useAdmin } from "@/hooks/useAdmin";
import { useAuth } from "@/hooks/useAuth";

export default function Admin() {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    } else if (!adminLoading && !isAdmin && user) {
      navigate('/dashboard');
    }
  }, [user, isAdmin, authLoading, adminLoading, navigate]);

  if (authLoading || adminLoading) {
    return (
      <div className="min-h-screen bg-gradient-warm flex items-center justify-center">
        <p className="text-muted-foreground">Loading admin panel...</p>
      </div>
    );
  }

  if (!user || !isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-warm">
      <MobileHeader 
        title="Admin Panel"
        showBackButton={true}
        showMenu={false}
        showNotifications={false}
        onBackClick={() => navigate('/dashboard')}
      />
      
      <div className="p-4 space-y-6">
        <div className="text-center py-4">
          <h1 className="text-2xl font-bold text-foreground">Admin Panel</h1>
          <p className="text-muted-foreground">Manage your loyalty program</p>
        </div>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-7">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="rewards">Rewards</TabsTrigger>
            <TabsTrigger value="transactions">Transactions</TabsTrigger>
            <TabsTrigger value="notifications">Push</TabsTrigger>
            <TabsTrigger value="announcements">Announce</TabsTrigger>
            <TabsTrigger value="email">Email</TabsTrigger>
          </TabsList>
          
          <TabsContent value="overview" className="space-y-4">
            <AdminOverview />
          </TabsContent>
          
          <TabsContent value="users" className="space-y-4">
            <AdminUsers />
          </TabsContent>
          
          <TabsContent value="rewards" className="space-y-4">
            <AdminRewards />
          </TabsContent>
          
          <TabsContent value="transactions" className="space-y-4">
            <AdminTransactions />
          </TabsContent>
          
          <TabsContent value="notifications" className="space-y-4">
            <AdminNotifications />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}