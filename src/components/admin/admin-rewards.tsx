import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Plus, Edit, Trash2 } from "lucide-react";
import { useAdmin } from "@/hooks/useAdmin";
import { toast } from "@/hooks/use-toast";

export const AdminRewards = () => {
  const { 
    rewards, 
    fetchRewards, 
    createReward, 
    updateReward, 
    deleteReward 
  } = useAdmin();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedReward, setSelectedReward] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    points_cost: "",
    category: "",
    available: true,
    image_url: ""
  });

  useEffect(() => {
    fetchRewards();
  }, []);

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      points_cost: "",
      category: "",
      available: true,
      image_url: ""
    });
  };

  const handleCreate = async () => {
    if (!formData.name || !formData.points_cost || !formData.category) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    const points = parseInt(formData.points_cost);
    if (isNaN(points) || points <= 0) {
      toast({
        title: "Error",
        description: "Points cost must be a positive number",
        variant: "destructive",
      });
      return;
    }

    const { error } = await createReward({
      name: formData.name,
      description: formData.description,
      points_cost: points,
      category: formData.category,
      available: formData.available,
      image_url: formData.image_url || null
    });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to create reward",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Reward created successfully",
      });
      setIsCreateDialogOpen(false);
      resetForm();
    }
  };

  const handleEdit = async () => {
    if (!selectedReward || !formData.name || !formData.points_cost || !formData.category) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    const points = parseInt(formData.points_cost);
    if (isNaN(points) || points <= 0) {
      toast({
        title: "Error",
        description: "Points cost must be a positive number",
        variant: "destructive",
      });
      return;
    }

    const { error } = await updateReward(selectedReward.id, {
      name: formData.name,
      description: formData.description,
      points_cost: points,
      category: formData.category,
      available: formData.available,
      image_url: formData.image_url || null
    });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update reward",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Reward updated successfully",
      });
      setIsEditDialogOpen(false);
      setSelectedReward(null);
      resetForm();
    }
  };

  const handleDelete = async (rewardId: string) => {
    if (!confirm("Are you sure you want to delete this reward?")) return;

    const { error } = await deleteReward(rewardId);
    if (error) {
      toast({
        title: "Error",
        description: "Failed to delete reward",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Reward deleted successfully",
      });
    }
  };

  const openEditDialog = (reward: any) => {
    setSelectedReward(reward);
    setFormData({
      name: reward.name,
      description: reward.description || "",
      points_cost: reward.points_cost.toString(),
      category: reward.category,
      available: reward.available,
      image_url: reward.image_url || ""
    });
    setIsEditDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Manage Rewards</h3>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="h-4 w-4 mr-2" />
              Create Reward
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Reward</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="points">Points Cost *</Label>
                <Input
                  id="points"
                  type="number"
                  value={formData.points_cost}
                  onChange={(e) => setFormData({ ...formData, points_cost: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="category">Category *</Label>
                <Input
                  id="category"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="image_url">Image URL</Label>
                <Input
                  id="image_url"
                  value={formData.image_url}
                  onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="available"
                  checked={formData.available}
                  onCheckedChange={(checked) => setFormData({ ...formData, available: checked })}
                />
                <Label htmlFor="available">Available</Label>
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreate}>
                  Create Reward
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {rewards.map((reward) => (
          <Card key={reward.id}>
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg">{reward.name}</CardTitle>
                  <p className="text-sm text-muted-foreground">{reward.description}</p>
                  <div className="flex items-center space-x-2 mt-2">
                    <Badge variant="outline">{reward.category}</Badge>
                    <Badge variant={reward.available ? 'default' : 'secondary'}>
                      {reward.available ? 'Available' : 'Unavailable'}
                    </Badge>
                    <span className="text-sm font-medium text-primary">
                      {reward.points_cost} points
                    </span>
                  </div>
                </div>
                <div className="flex space-x-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openEditDialog(reward)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDelete(reward.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            {reward.image_url && (
              <CardContent>
                <img 
                  src={reward.image_url} 
                  alt={reward.name}
                  className="w-full h-32 object-cover rounded-md"
                />
              </CardContent>
            )}
          </Card>
        ))}
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Reward</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-name">Name *</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit-points">Points Cost *</Label>
              <Input
                id="edit-points"
                type="number"
                value={formData.points_cost}
                onChange={(e) => setFormData({ ...formData, points_cost: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit-category">Category *</Label>
              <Input
                id="edit-category"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit-image_url">Image URL</Label>
              <Input
                id="edit-image_url"
                value={formData.image_url}
                onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="edit-available"
                checked={formData.available}
                onCheckedChange={(checked) => setFormData({ ...formData, available: checked })}
              />
              <Label htmlFor="edit-available">Available</Label>
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleEdit}>
                Update Reward
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};