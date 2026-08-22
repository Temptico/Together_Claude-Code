import * as storage from "./storage.js";
import { notifyUser } from "./push.js";

function pad(n: number) {
  return String(n).padStart(2, "0");
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
          const activeToday = await storage.hasActivityToday(user.id, date);
          if (!activeToday) {
            await notifyUser(user.id, {
              title: "Together",
              body: "Ne pozabi na današnje razpoloženje, vprašanje ali izziv! 💗",
              tag: "daily-reminder",
            });
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
            await notifyUser(user.id, {
              title: "Together",
              body: years > 0 ? `Danes je vajina ${years}. obletnica! 💕` : "Danes je vajina obletnica! 💕",
              tag: "anniversary",
            });
          }
          await storage.markReminderSent(user.id, date, "anniversary");
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
              await notifyUser(user.id, {
                title: "Together",
                body: `🔥 Tvoj niz ${streak} dni bo prekinjen, če danes ne opravita vsaj ene aktivnosti!`,
                tag: "streak-freeze",
              });
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
