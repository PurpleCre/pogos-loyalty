import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Bell, BellOff, Check, X } from "lucide-react";
import { useNotifications } from "@/hooks/useNotifications";

export const NotificationSettings = () => {
  const { permission, isSubscribed, loading, subscribe, unsubscribe } = useNotifications();

  const getPermissionStatus = () => {
    if (permission.granted) return { text: "Granted", color: "text-green-600", icon: Check };
    if (permission.denied) return { text: "Denied", color: "text-red-600", icon: X };
    return { text: "Not Set", color: "text-muted-foreground", icon: Bell };
  };

  const permissionStatus = getPermissionStatus();
  const StatusIcon = permissionStatus.icon;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="w-5 h-5" />
          Push Notifications
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label className="text-sm font-medium">Browser Permission</Label>
            <div className="flex items-center gap-2">
              <StatusIcon className={`w-4 h-4 ${permissionStatus.color}`} />
              <span className={`text-sm ${permissionStatus.color}`}>
                {permissionStatus.text}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="notifications-toggle" className="text-sm font-medium">
              Push Notifications
            </Label>
            <p className="text-xs text-muted-foreground">
              Receive notifications about rewards and promotions
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="notifications-toggle"
              checked={isSubscribed}
              onCheckedChange={isSubscribed ? unsubscribe : subscribe}
              disabled={loading || permission.denied}
            />
            {loading && (
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            )}
          </div>
        </div>

        {permission.denied && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
            <p className="text-sm text-destructive">
              Notifications are blocked. To enable them, click the lock icon in your browser's address bar and allow notifications.
            </p>
          </div>
        )}

        {!permission.granted && !permission.denied && (
          <div className="p-3 bg-muted rounded-md">
            <p className="text-sm text-muted-foreground">
              Enable notifications to receive updates about your rewards, special offers, and account activity.
            </p>
          </div>
        )}

        {isSubscribed && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-md">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-green-600" />
              <p className="text-sm text-green-800">
                You're subscribed to push notifications
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};