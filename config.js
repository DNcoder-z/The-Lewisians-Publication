/* ==========================================================
   CONFIG — the only file you need to edit to go live.
   Follow README.md for how to obtain each value.
   ========================================================== */

const CONFIG = {

  /* 1. Google Calendar API key (Google Cloud Console → Credentials).
        Restrict it to HTTP referrers: your-site.vercel.app/* and localhost. */
  CALENDAR_API_KEY: "AIzaSyAsDDMMeuLHWeKcC04KJ6lw6qaEk54gi84",

  /* 2. The publication calendar's ID (Calendar settings → Integrate calendar).
        The calendar must be set to "Make available to public". */
  CALENDAR_ID: "c_a0830a69a39844d239f90aedfb7120e0b11cc8938a3e25241dc45d161aa94634@group.calendar.google.com",

  /* 3. Apps Script web app URL, ending in /exec
        (Apps Script → Deploy → New deployment → Web app). */
  SCRIPT_URL: "https://script.google.com/macros/s/AKfycbz11gfHLoeP4-wQ8AykFSIxnsung0Sq6XWflEd7lFz-Ju8xcXtGLIwsyTyvVzNOfOnW/exec",

  /* How many upcoming events to show. */
  MAX_EVENTS: 12,

  /* Timezone used to format dates. */
  TIMEZONE: "Asia/Manila"
};

/* Returns false while a value is still a placeholder, so the pages can
   fall back to sample content instead of breaking during development. */
CONFIG.isSet = function (key) {
  const v = CONFIG[key];
  return typeof v === "string" && v.length > 0 && !v.startsWith("PASTE_");
};
