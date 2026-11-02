import * as Notifications from 'expo-notifications';
import { transactionPayloadSchema } from './push-installation';
let recipient: string | null = null;
export function setPushRecipient(owner: string | null) { recipient = owner; }
Notifications.setNotificationHandler({
  handleNotification: async notification => {
    const data = notification.request.content.data;
    const parsed = transactionPayloadSchema.safeParse(data);
    const show = data?.kind === 'branch-queue' || (parsed.success && parsed.data.recipient_id === recipient);
    return { shouldPlaySound: show, shouldSetBadge: false, shouldShowBanner: show,
      shouldShowList: show, priority: Notifications.AndroidNotificationPriority.HIGH };
  },
});
