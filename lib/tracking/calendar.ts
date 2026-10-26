import { Platform } from "react-native";
import type { Reminder } from "./api";
function escape(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}
export function reminderCalendar(name: string, rows: Reminder[]) {
  const events = rows
    .filter((r) => r.enabled)
    .map((r, i) => {
      const date = new Date(r.next_at)
        .toISOString()
        .replace(/[-:]/g, "")
        .replace(/\.\d{3}/, "");
      return [
        "BEGIN:VEVENT",
        `UID:unmask-${Date.now()}-${i}@unmask`,
        `DTSTAMP:${date}`,
        `DTSTART:${date}`,
        `SUMMARY:${escape(r.kind === "log" ? `Update your experience: ${name}` : `Your routine: ${name}`)}`,
        `DESCRIPTION:${escape("Your pace. Continue when it suits you. Disable this calendar event if you pause the product.")}`,
        `RRULE:FREQ=${r.cadence === "weekly" ? "WEEKLY" : "DAILY"}`,
        "BEGIN:VALARM",
        "TRIGGER:PT0M",
        "ACTION:DISPLAY",
        "DESCRIPTION:Your optional Unmask reminder",
        "END:VALARM",
        "END:VEVENT",
      ].join("\r\n");
    });
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Unmask//Product reminders//EN",
    ...events,
    "END:VCALENDAR",
  ].join("\r\n");
}
export function exportReminders(name: string, rows: Reminder[]) {
  if (Platform.OS !== "web" || typeof document === "undefined")
    throw new Error(
      "Calendar export is available in the web app. In-app reminders remain available.",
    );
  const url = URL.createObjectURL(
    new Blob([reminderCalendar(name, rows)], {
      type: "text/calendar;charset=utf-8",
    }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = "unmask-reminders.ics";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
