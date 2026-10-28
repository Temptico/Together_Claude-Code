import * as storage from "./storage.js";
import { notifyUser } from "./push.js";
import { Sentry } from "./sentry.js";
import { sendConnectReminderEmail, sendGamesAnnouncementEmail } from "./email.js";
import {
  dailyReminderNotification,
  anniversaryNotification,
  anniversaryUpcomingNotification,
  streakFreezeNotification,
  dateReminder3dNotification,
  dateReminderTodayNotification,
  connectReminderNotification,
  challengeUnfinishedNotification,
  partnerBirthdayNotification,
  ownBirthdayNotification,
} from "./notificationText.js";

const TICK_INTERVAL_MS = 15 * 60_000;

// Every reminder time in this app lands on the hour (see REMINDER_TIMES in
// Profile.tsx — random mode also derives an hour, never a minute). Checking
// every 60 seconds for an exact "09:00" match kept Neon's database compute
// permanently awake: it auto-suspends after a few minutes of no queries, but
// a query every single minute never gave it the chance. A reminder landing
// a few minutes into its target hour instead of exactly on it is
// imperceptible here, so this window (matched to the tick interval, so no
// hour can be skipped between ticks) trades that invisible precision for a
// large drop in database wake-ups.
function isTopOfHour(now: Date, targetHour: number): boolean {
  return now.getHours() === targetHour && now.getMinutes() < TICK_INTERVAL_MS / 60_000;
}

// Earliest and latest hour anything below can fire at: the reminder-time
// picker spans 08:00–22:00, and every fixed reminder (9, 10, 19, 20) sits
// inside that. Keep these in sync if either range ever widens.
const FIRST_REMINDER_HOUR = 8;
const LAST_REMINDER_HOUR = 22;

// Every reminder is gated by isTopOfHour, so a tick outside the top of an
// active hour can't send anything — skipping it before touching the
// database lets Neon stay suspended for 3 of every 4 ticks by day and all
// night, instead of waking 96 times a day to do nothing.
export function tickCanSendAnything(now: Date): boolean {
  const hour = now.getHours();
  return hour >= FIRST_REMINDER_HOUR && hour <= LAST_REMINDER_HOUR && now.getMinutes() < TICK_INTERVAL_MS / 60_000;
}

// Days until the next occurrence of a yearly date (anniversary, birthday).
function daysUntilNextYearly(yearlyDate: string, now: Date): number {
  const anniv = new Date(yearlyDate);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let next = new Date(now.getFullYear(), anniv.getMonth(), anniv.getDate());
  if (next.getTime() < today.getTime()) next = new Date(now.getFullYear() + 1, anniv.getMonth(), anniv.getDate());
  return Math.round((next.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

// Plain calendar-day difference (ignores time of day), unlike
// daysUntilNextYearly which wraps to next year — a planned date is a single
// fixed point in time, not a yearly-recurring one.
function daysUntilDate(target: Date, now: Date): number {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const targetDay = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  return Math.round((targetDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function daysSince(past: Date, now: Date): number {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const pastDay = new Date(past.getFullYear(), past.getMonth(), past.getDate());
  return Math.round((today.getTime() - pastDay.getTime()) / (1000 * 60 * 60 * 24));
}

export async function tick() {
  const now = new Date();
  if (!tickCanSendAnything(now)) return;
  const date = storage.todayStr();

  const users = await storage.getAllUsers();
  const usersById = new Map(users.map((u) => [u.id, u]));

  for (const user of users) {
    try {
      // Nudge to connect with a partner, 1 and 3 days after registering if
      // still unconnected — checked once a day at 10:00. Unlike the other
      // reminders below, this one always sends the email leg regardless of
      // the user's push-notification preference (we always have their email,
      // and a connect nudge is exactly the kind of one-off, high-intent
      // message that's fine outside the push opt-in), while push is still
      // gated by notificationsEnabled like everything else here.
      if (isTopOfHour(now, 10) && !user.partnerId) {
        const ageDays = daysSince(new Date(user.createdAt), now);
        for (const milestone of [1, 3] as const) {
          if (ageDays !== milestone) continue;
          const type = `connect_reminder_${milestone}d`;
          if (!(await storage.claimReminder(user.id, date, type))) continue;
          await sendConnectReminderEmail(user.email, user.name, user.connectCode, user.language).catch((err) =>
            console.warn("[scheduler] connect reminder email failed for user", user.id, err)
          );
          if (user.notificationsEnabled) {
            await notifyUser(user.id, (lang) => ({
              title: "Together",
              body: connectReminderNotification(lang),
              tag: type,
            }));
          }
        }
      }

      // Games-feature intro email, 14 days after registering — regardless
      // of partner/connection status (games work solo too). Sent
      // unconditionally like the connect reminder above, not gated by
      // notificationsEnabled (that flag controls push, not email).
      if (isTopOfHour(now, 10)) {
        const ageDays = daysSince(new Date(user.createdAt), now);
        if (ageDays === 14) {
          const type = "games_intro_14d";
          if (await storage.claimReminder(user.id, date, type)) {
            await sendGamesAnnouncementEmail(user.email, user.name, user.language).catch((err) =>
              console.warn("[scheduler] games intro email failed for user", user.id, err)
            );
          }
        }
      }

      if (!user.notificationsEnabled) continue;

      // Daily "don't forget to check in" reminder, at the user's chosen (or random) time.
      const reminderTime = storage.deriveReminderTime(user, date);
      const reminderHour = Number(reminderTime.split(":")[0]);
      if (isTopOfHour(now, reminderHour)) {
        if (await storage.claimReminder(user.id, date, "daily")) {
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
        }
      }

      // Anniversary notification, checked once a day at 09:00.
      if (isTopOfHour(now, 9) && user.anniversaryDate) {
        if (await storage.claimReminder(user.id, date, "anniversary")) {
          const anniv = new Date(user.anniversaryDate);
          if (anniv.getMonth() === now.getMonth() && anniv.getDate() === now.getDate()) {
            const years = now.getFullYear() - anniv.getFullYear();
            await notifyUser(user.id, (lang) => ({
              title: "Together",
              body: anniversaryNotification(lang, years),
              tag: "anniversary",
            }));
          }
        }
      }

      // Advance anniversary heads-up, 30 and 14 days out — also checked once
      // a day at 09:00.
      if (isTopOfHour(now, 9) && user.anniversaryDate) {
        const daysUntil = daysUntilNextYearly(user.anniversaryDate, now);
        for (const milestone of [30, 14] as const) {
          if (daysUntil !== milestone) continue;
          const type = `anniversary_${milestone}d`;
          if (await storage.claimReminder(user.id, date, type)) {
            await notifyUser(user.id, (lang) => ({
              title: "Together",
              body: anniversaryUpcomingNotification(lang, milestone),
              tag: type,
            }));
          }
        }
      }

      // Birthdays, checked once a day at 09:00: the partner gets a heads-up
      // 14 days out and on the day itself; the birthday person gets a
      // greeting on the day.
      if (isTopOfHour(now, 9)) {
        const partner = user.partnerId ? usersById.get(user.partnerId) : undefined;
        if (partner?.birthday) {
          const daysUntil = daysUntilNextYearly(partner.birthday, now);
          if (daysUntil === 14 || daysUntil === 0) {
            const type = `partner_birthday_${daysUntil}d`;
            if (await storage.claimReminder(user.id, date, type)) {
              await notifyUser(user.id, (lang) => ({
                title: "Together",
                body: partnerBirthdayNotification(lang, partner.name, daysUntil),
                tag: type,
              }));
            }
          }
        }
        if (user.birthday && daysUntilNextYearly(user.birthday, now) === 0) {
          if (await storage.claimReminder(user.id, date, "own_birthday")) {
            await notifyUser(user.id, (lang) => ({ title: "Together", body: ownBirthdayNotification(lang), tag: "own-birthday" }));
          }
        }
      }

      // Planned-date reminders, 3 days before and on the day — checked once a
      // day at 09:00. getPlannedDates returns the whole couple's dates (both
      // partners' rows), so each partner naturally gets their own reminder in
      // their own language when this loop reaches their user record.
      if (isTopOfHour(now, 9)) {
        const planned = await storage.getPlannedDatesWithoutPhotos(user);
        for (const pd of planned) {
          if (pd.completed) continue;
          const daysUntil = daysUntilDate(new Date(pd.scheduledAt), now);
          if (daysUntil !== 3 && daysUntil !== 0) continue;
          const type = daysUntil === 3 ? `date_reminder_3d_${pd.id}` : `date_reminder_today_${pd.id}`;
          if (!(await storage.claimReminder(user.id, date, type))) continue;
          const idea = await storage.getDateIdeaById(pd.ideaId, user.language);
          await notifyUser(user.id, (lang) => ({
            title: "Together",
            body:
              daysUntil === 3
                ? dateReminder3dNotification(lang, idea?.title || "")
                : dateReminderTodayNotification(lang, idea?.title || ""),
            tag: type,
          }));
        }
      }

      // Evening nudge for a challenge this user accepted today but hasn't
      // finished — keyed to today's date (not the challenge's own
      // assignment date) so it re-fires once per evening for as long as the
      // challenge stays open (it no longer auto-rotates to a new one).
      if (isTopOfHour(now, 19)) {
        if (await storage.claimReminder(user.id, date, "challenge_reminder")) {
          const openChallenge = await storage.resolveDailyChallenge(user, date);
          if (openChallenge) {
            const completion = await storage.getCompletionForDate(user.id, openChallenge.id, openChallenge.date);
            if (completion && !completion.completedAt) {
              await notifyUser(user.id, (lang) => ({
                title: "Together",
                body: challengeUnfinishedNotification(lang),
                tag: "challenge-reminder",
              }));
            }
          }
        }
      }

      // Streak-freeze warning in the evening, if there's an active streak at risk.
      if (isTopOfHour(now, 20)) {
        if (await storage.claimReminder(user.id, date, "streak_freeze")) {
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
        }
      }
    } catch (err) {
      console.warn("[scheduler] tick failed for user", user.id, err);
      Sentry.captureException(err, { tags: { area: "scheduler" }, extra: { userId: user.id } });
    }
  }
}

let timer: ReturnType<typeof setInterval> | undefined;

export function startScheduler() {
  const run = () => tick().catch((err) => console.warn("[scheduler] tick error:", err));
  // One tick shortly after boot: a restart or deploy a few minutes past the
  // hour would otherwise skip that hour's window entirely (claimReminder
  // keeps this from double-sending if the previous instance got there).
  setTimeout(run, 10_000);
  timer = setInterval(run, TICK_INTERVAL_MS);
  console.log(`[scheduler] Reminder scheduler started (checks every ${TICK_INTERVAL_MS / 60_000} minutes)`);
}

export function stopScheduler() {
  if (timer) clearInterval(timer);
}
