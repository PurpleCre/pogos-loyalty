import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Send, Users } from "lucide-react";

export const AdminNotifications = () => {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    title: "",
    body: "",
    icon: "",
    sendToAll: true,
    userIds: ""
  });
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!formData.title || !formData.body) {
      toast({
        title: "Error",
        description: "Title and message are required",
        variant: "destructive"
      });
      return;
    }

    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-push-notification', {
        body: {
          title: formData.title,
          body: formData.body,
          icon: formData.icon || '/favicon.ico',
          badge: '/favicon.ico',
          sendToAll: formData.sendToAll,
          userIds: formData.sendToAll ? undefined : formData.userIds.split(',').map(id => id.trim()).filter(Boolean)
        }
      });

      if (error) throw error;

      toast({
        title: "Notification Sent",
        description: `Sent to ${data.sent} users. ${data.failed} failed.`
      });

      // Reset form
      setFormData({
        title: "",
        body: "",
        icon: "",
        sendToAll: true,
        userIds: ""
      });
    } catch (error) {
      console.error('Error sending notification:', error);
      toast({
        title: "Error",
        description: "Failed to send notification",
        variant: "destructive"
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Send className="w-5 h-5" />
          Send Push Notification
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            value={formData.title}
            onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
            placeholder="Notification title"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="body">Message</Label>
          <Textarea
            id="body"
            value={formData.body}
            onChange={(e) => setFormData(prev => ({ ...prev, body: e.target.value }))}
            placeholder="Notification message"
            rows={3}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="icon">Icon URL (optional)</Label>
          <Input
            id="icon"
            value={formData.icon}
            onChange={(e) => setFormData(prev => ({ ...prev, icon: e.target.value }))}
            placeholder="/favicon.ico"
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="send-to-all" className="text-sm font-medium">
              Send to All Users
            </Label>
            <p className="text-xs text-muted-foreground">
              Send notification to all subscribed users
            </p>
          </div>
          <Switch
            id="send-to-all"
            checked={formData.sendToAll}
            onCheckedChange={(checked) => setFormData(prev => ({ ...prev, sendToAll: checked }))}
          />
        </div>

        {!formData.sendToAll && (
          <div className="space-y-2">
            <Label htmlFor="user-ids">User IDs (comma-separated)</Label>
            <Textarea
              id="user-ids"
              value={formData.userIds}
              onChange={(e) => setFormData(prev => ({ ...prev, userIds: e.target.value }))}
              placeholder="user-id-1, user-id-2, user-id-3"
              rows={2}
            />
            <p className="text-xs text-muted-foreground">
              Enter user IDs separated by commas to send to specific users
            </p>
          </div>
        )}

        <Button 
          onClick={handleSend} 
          disabled={sending || !formData.title || !formData.body}
          className="w-full"
        >
          <Send className="w-4 h-4 mr-2" />
          {sending ? "Sending..." : "Send Notification"}
        </Button>
      </CardContent>
    </Card>
  );
};