import * as Notifications from "expo-notifications";
import { Reminder } from "../types";

// Show alerts when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function requestNotificationPermissions(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === "granted") return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}

export async function scheduleReminderNotification(
  reminder: Reminder,
): Promise<void> {
  const remindAt = new Date(reminder.remind_at);
  if (remindAt <= new Date()) return;

  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: reminder.title,
        body: reminder.note_title
          ? `Ghi chú: ${reminder.note_title}`
          : "MemoAI nhắc nhở",
        sound: true,
        data: { reminderId: reminder.id },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: remindAt,
      },
    });
  } catch (e) {
    console.warn("[Notifications] schedule failed:", e);
  }
}

export async function cancelReminderNotification(
  reminderId: number,
): Promise<void> {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const n of scheduled) {
      if (Number(n.content.data?.reminderId) === reminderId) {
        await Notifications.cancelScheduledNotificationAsync(n.identifier);
        return;
      }
    }
  } catch (e) {
    console.warn("[Notifications] cancel failed:", e);
  }
}

// Schedules only reminders that aren't already scheduled — safe to call on app open
export async function syncReminderNotifications(
  reminders: Reminder[],
): Promise<void> {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const scheduledIds = new Set(
      scheduled
        .map((n) => Number(n.content.data?.reminderId))
        .filter(Boolean),
    );
    const now = new Date();
    for (const r of reminders) {
      if (
        !r.is_done &&
        new Date(r.remind_at) > now &&
        !scheduledIds.has(r.id)
      ) {
        await scheduleReminderNotification(r);
      }
    }
  } catch (e) {
    console.warn("[Notifications] sync failed:", e);
  }
}
