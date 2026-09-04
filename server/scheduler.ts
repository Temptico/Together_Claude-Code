import * as storage from "./storage.js";
import { notifyUser } from "./push.js";
import {
  dailyReminderNotification,
  anniversaryNotification,
  anniversaryUpcomingNotification,
  streakFreezeNotification,
  dateReminder3dNotification,
  dateReminderTodayNotification,
} from "./notificationText.js";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function daysUntilAnniversary(anniversaryDate: string, now: Date): number {
  const anniv = new Date(anniversaryDate);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let next = new Date(now.getFullYear(), anniv.getMonth(), anniv.getDate());
  if (next.getTime() < today.getTime()) next = new Date(now.getFullYear() + 1, anniv.getMonth(), anniv.getDate());
  return Math.round((next.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

// Plain calendar-day difference (ignores time of day), unlike
// daysUntilAnniversary which wraps to next year — a planned date is a single
// fixed point in time, not a yearly-recurring one.
function daysUntilDate(target: Date, now: Date): number {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const targetDay = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  return Math.round((targetDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

async function tick() {
  const now = new Date();
  const date = storage.todayStr();
  const hhmm = `${pad(now.getHours())}:${pad(now.getMinutes())}`;

  const users = await storage.getAllUsers();

  for (const user of users) {
    if (!user.notificationsEnabled) continue;

    try {
      // Daily "don't forget to check in" reminder, at the user's chosen (or random) time.
      const reminderTime = storage.deriveReminderTime(user, date);
      if (reminderTime === hhmm) {
        const alreadySent = await storage.wasReminderSent(user.id, date, "daily");
        if (!alreadySent) {
          // Nudges specifically toward the mood check-in, not "any activity" —
          // answering a question or finishing a challenge no longer silences
          // this reminder, since the point is to catch a missed mood.
          const mood = await storage.getMoodForDate(user.id, date);
          if (!mood) {
            await notifyUser(user.id, (lang) => ({
              title: "Together",
              body: dailyReminderNotification(lang),
              tag: "daily-reminder",
            }));
          }
          await storage.markReminderSent(user.id, date, "daily");
        }
      }

      // Anniversary notification, checked once a day at 09:00.
      if (hhmm === "09:00" && user.anniversaryDate) {
        const alreadySent = await storage.wasReminderSent(user.id, date, "anniversary");
        if (!alreadySent) {
          const anniv = new Date(user.anniversaryDate);
          if (anniv.getMonth() === now.getMonth() && anniv.getDate() === now.getDate()) {
            const years = now.getFullYear() - anniv.getFullYear();
            await notifyUser(user.id, (lang) => ({
              title: "Together",
              body: anniversaryNotification(lang, years),
              tag: "anniversary",
            }));
          }
          await storage.markReminderSent(user.id, date, "anniversary");
        }
      }

      // Advance anniversary heads-up, 30 and 14 days out — also checked once
      // a day at 09:00.
      if (hhmm === "09:00" && user.anniversaryDate) {
        const daysUntil = daysUntilAnniversary(user.anniversaryDate, now);
        for (const milestone of [30, 14] as const) {
          if (daysUntil !== milestone) continue;
          const type = `anniversary_${milestone}d`;
          const alreadySent = await storage.wasReminderSent(user.id, date, type);
          if (!alreadySent) {
            await notifyUser(user.id, (lang) => ({
              title: "Together",
              body: anniversaryUpcomingNotification(lang, milestone),
              tag: type,
            }));
            await storage.markReminderSent(user.id, date, type);
          }
        }
      }

      // Planned-date reminders, 3 days before and on the day — checked once a
      // day at 09:00. getPlannedDates returns the whole couple's dates (both
      // partners' rows), so each partner naturally gets their own reminder in
      // their own language when this loop reaches their user record.
      if (hhmm === "09:00") {
        const planned = await storage.getPlannedDates(user);
        for (const pd of planned) {
          if (pd.completed) continue;
          const daysUntil = daysUntilDate(new Date(pd.scheduledAt), now);
          if (daysUntil !== 3 && daysUntil !== 0) continue;
          const type = daysUntil === 3 ? `date_reminder_3d_${pd.id}` : `date_reminder_today_${pd.id}`;
          const alreadySent = await storage.wasReminderSent(user.id, date, type);
          if (alreadySent) continue;
          const idea = await storage.getDateIdeaById(pd.ideaId, user.language);
          await notifyUser(user.id, (lang) => ({
            title: "Together",
            body:
              daysUntil === 3
                ? dateReminder3dNotification(lang, idea?.title || "")
                : dateReminderTodayNotification(lang, idea?.title || ""),
            tag: type,
          }));
          await storage.markReminderSent(user.id, date, type);
        }
      }

      // Streak-freeze warning in the evening, if there's an active streak at risk.
      if (hhmm === "20:00") {
        const alreadySent = await storage.wasReminderSent(user.id, date, "streak_freeze");
        if (!alreadySent) {
          const activeToday = await storage.hasActivityToday(user.id, date);
          if (!activeToday) {
            const streak = await storage.calculateStreak(user.id);
            if (streak > 0) {
              await notifyUser(user.id, (lang) => ({
                title: "Together",
                body: streakFreezeNotification(lang, streak),
                tag: "streak-freeze",
              }));
            }
          }
          await storage.markReminderSent(user.id, date, "streak_freeze");
        }
      }
    } catch (err) {
      console.warn("[scheduler] tick failed for user", user.id, err);
    }
  }
}

export function startScheduler() {
  setInterval(() => {
    tick().catch((err) => console.warn("[scheduler] tick error:", err));
  }, 60_000);
  console.log("[scheduler] Reminder scheduler started (checks every minute)");
}
