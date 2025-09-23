import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { UserPlus, UserMinus, Edit, Search } from "lucide-react";
import { useAdmin } from "@/hooks/useAdmin";
import { toast } from "@/hooks/use-toast";

export const AdminUsers = () => {
  const { 
    users, 
    fetchUsers, 
    makeUserAdmin, 
    removeUserAdmin, 
    adjustUserPoints 
  } = useAdmin();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [pointsAdjustment, setPointsAdjustment] = useState("");
  const [adjustmentReason, setAdjustmentReason] = useState("");
  const [isAdjustDialogOpen, setIsAdjustDialogOpen] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const filteredUsers = users.filter(user => 
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (user.full_name && user.full_name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleMakeAdmin = async (userId: string) => {
    const { error } = await makeUserAdmin(userId);
    if (error) {
      toast({
        title: "Error",
        description: "Failed to make user admin",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "User is now an admin",
      });
    }
  };

  const handleRemoveAdmin = async (userId: string) => {
    const { error } = await removeUserAdmin(userId);
    if (error) {
      toast({
        title: "Error",
        description: "Failed to remove admin status",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Admin status removed",
      });
    }
  };

  const handleAdjustPoints = async () => {
    if (!selectedUser || !pointsAdjustment || !adjustmentReason) return;

    const points = parseInt(pointsAdjustment);
    if (isNaN(points)) {
      toast({
        title: "Error",
        description: "Please enter a valid number",
        variant: "destructive",
      });
      return;
    }

    const { error } = await adjustUserPoints(selectedUser.id, points, adjustmentReason);
    if (error) {
      toast({
        title: "Error",
        description: "Failed to adjust points",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: `Points ${points > 0 ? 'added' : 'deducted'} successfully`,
      });
      setIsAdjustDialogOpen(false);
      setPointsAdjustment("");
      setAdjustmentReason("");
      setSelectedUser(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search users..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <div className="grid gap-4">
        {filteredUsers.map((user) => (
          <Card key={user.id}>
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg">
                    {user.full_name || user.email}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">{user.email}</p>
                  <div className="flex items-center space-x-2 mt-2">
                    <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                      {user.role}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      Joined {new Date(user.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <div className="flex space-x-2">
                  {user.role === 'admin' ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRemoveAdmin(user.id)}
                    >
                      <UserMinus className="h-4 w-4 mr-1" />
                      Remove Admin
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleMakeAdmin(user.id)}
                    >
                      <UserPlus className="h-4 w-4 mr-1" />
                      Make Admin
                    </Button>
                  )}
                  <Dialog open={isAdjustDialogOpen && selectedUser?.id === user.id} onOpenChange={setIsAdjustDialogOpen}>
                    <DialogTrigger asChild>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedUser(user)}
                      >
                        <Edit className="h-4 w-4 mr-1" />
                        Adjust Points
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Adjust Points for {user.full_name || user.email}</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="points">Points Adjustment</Label>
                          <Input
                            id="points"
                            type="number"
                            placeholder="Enter positive or negative number"
                            value={pointsAdjustment}
                            onChange={(e) => setPointsAdjustment(e.target.value)}
                          />
                        </div>
                        <div>
                          <Label htmlFor="reason">Reason</Label>
                          <Input
                            id="reason"
                            placeholder="Enter reason for adjustment"
                            value={adjustmentReason}
                            onChange={(e) => setAdjustmentReason(e.target.value)}
                          />
                        </div>
                        <div className="flex justify-end space-x-2">
                          <Button variant="outline" onClick={() => setIsAdjustDialogOpen(false)}>
                            Cancel
                          </Button>
                          <Button onClick={handleAdjustPoints}>
                            Adjust Points
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold text-primary">{user.current_points}</p>
                  <p className="text-xs text-muted-foreground">Current Points</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-600">{user.total_earned}</p>
                  <p className="text-xs text-muted-foreground">Total Earned</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-purple-600">{user.total_redeemed}</p>
                  <p className="text-xs text-muted-foreground">Total Redeemed</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};