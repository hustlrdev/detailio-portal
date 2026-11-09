export const money = (pence: number) => `£${(pence / 100).toFixed(2)}`;

export const when = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", {
    weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London",
  }).format(new Date(iso));

export const hoursLeft = (iso: string) => Math.max(0, Math.round((new Date(iso).getTime() - Date.now()) / 36e5));

export const slugify = (name: string) =>
  name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "detailer";

export const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const statusLabel: Record<string, string> = {
  draft: "Draft", pending_verification: "Pending verification", approved: "Approved", rejected: "Rejected", suspended: "Suspended",
};
