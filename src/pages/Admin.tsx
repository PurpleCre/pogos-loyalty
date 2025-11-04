import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AuthenticatedLayout } from "@/components/layout/authenticated-layout";
import { AdminUsers } from "@/components/admin/admin-users";
import { AdminRewards } from "@/components/admin/admin-rewards";
import { AdminTransactions } from "@/components/admin/admin-transactions";
import { AdminNotifications } from "@/components/admin/admin-notifications";
import { AdminAnnouncements } from "@/components/admin/admin-announcements";
import { AdminEmailNotifications } from "@/components/admin/admin-email-notifications";
import { AdminOverview } from "@/components/admin/admin-overview";
import { useAdmin } from "@/hooks/useAdmin";
import { useAuth } from "@/hooks/useAuth";
import { Shield } from "lucide-react";

export default function Admin() {
  const { user } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const navigate = useNavigate();

  useEffect(() => {
    if (user && !adminLoading && !isAdmin) {
      navigate('/dashboard');
    }
  }, [user, isAdmin, adminLoading, navigate]);

  if (adminLoading) {
    return null; // Layout handles auth loading
  }

  if (!user || !isAdmin) {
    return null;
  }

  return (
    <AuthenticatedLayout>
      <div className="min-h-screen bg-background">
        <div className="container py-6 px-4 max-w-7xl mx-auto">
          <div className="text-center py-4 mb-6 animate-in fade-in slide-in-from-top duration-500">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Shield className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-3xl font-bold text-foreground">Admin Panel</h1>
            <p className="text-muted-foreground">Manage your loyalty program</p>
          </div>

          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-7 animate-in fade-in slide-in-from-bottom duration-500">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="users">Users</TabsTrigger>
              <TabsTrigger value="rewards">Rewards</TabsTrigger>
              <TabsTrigger value="transactions">Transactions</TabsTrigger>
              <TabsTrigger value="notifications">Push</TabsTrigger>
              <TabsTrigger value="announcements">Announce</TabsTrigger>
              <TabsTrigger value="email">Email</TabsTrigger>
            </TabsList>
            
            <TabsContent value="overview" className="space-y-4 animate-in fade-in duration-700">
              <AdminOverview />
            </TabsContent>
            
            <TabsContent value="users" className="space-y-4 animate-in fade-in duration-700">
              <AdminUsers />
            </TabsContent>
            
            <TabsContent value="rewards" className="space-y-4 animate-in fade-in duration-700">
              <AdminRewards />
            </TabsContent>
            
            <TabsContent value="transactions" className="space-y-4 animate-in fade-in duration-700">
              <AdminTransactions />
            </TabsContent>
            
            <TabsContent value="notifications" className="space-y-4 animate-in fade-in duration-700">
              <AdminNotifications />
            </TabsContent>

            <TabsContent value="announcements" className="space-y-4 animate-in fade-in duration-700">
              <AdminAnnouncements />
            </TabsContent>

            <TabsContent value="email" className="space-y-4 animate-in fade-in duration-700">
              <AdminEmailNotifications />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </AuthenticatedLayout>
  );
}