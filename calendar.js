/* ==========================================================
   GOOGLE CALENDAR API — Upcoming events
   Reads the publication's public calendar and renders the
   next CONFIG.MAX_EVENTS entries, grouped by day.
   ========================================================== */

(function () {
  "use strict";

  const TZ = CONFIG.TIMEZONE || "Asia/Manila";
  const container = document.getElementById("events");
  const statusEl = document.getElementById("cal-status");

  /* Sample events used only while CONFIG is still unconfigured,
     so the page is never blank during development or a demo. */
  const SAMPLE = [
    {
      summary: "Intramurals coverage",
      location: "The Lewis College grounds",
      description: "Photo and writing team on site for the opening ceremony and the first bracket.",
      start: { dateTime: nextDate(5, 8, 0) },
      end: { dateTime: nextDate(5, 12, 0) }
    },
    {
      summary: "Editorial meeting",
      location: "Publication Office",
      description: "Story pitches and layout review for the next issue.",
      start: { dateTime: nextDate(8, 14, 0) },
      end: { dateTime: nextDate(8, 16, 0) }
    },
    {
      summary: "Deadline: Volume 12 Issue 3 submissions",
      location: "Online",
      description: "Final call for articles, photo essays and artwork.",
      start: { date: nextDateOnly(14) }
    },
    {
      summary: "Photojournalism workshop",
      location: "AVR, Higher Education Building",
      description: "Open to all Lewisian students. Bring any camera, including a phone.",
      start: { dateTime: nextDate(19, 9, 0) },
      end: { dateTime: nextDate(19, 11, 30) }
    }
  ];

  function nextDate(daysAhead, h, m) {
    const d = new Date();
    d.setDate(d.getDate() + daysAhead);
    d.setHours(h, m, 0, 0);
    return d.toISOString();
  }

  function nextDateOnly(daysAhead) {
    const d = new Date();
    d.setDate(d.getDate() + daysAhead);
    return d.toISOString().slice(0, 10);
  }

  /* ---------- helpers ---------- */

  function startOf(ev) {
    const raw = (ev.start && (ev.start.dateTime || ev.start.date)) || null;
    if (!raw) return null;
    return ev.start.dateTime ? new Date(raw) : new Date(raw + "T00:00:00");
  }

  function isAllDay(ev) {
    return !!(ev.start && ev.start.date && !ev.start.dateTime);
  }

  function timeLabel(ev) {
    if (isAllDay(ev)) return "All day";
    const opts = { hour: "numeric", minute: "2-digit", timeZone: TZ };
    const s = new Date(ev.start.dateTime).toLocaleTimeString("en-PH", opts);
    if (ev.end && ev.end.dateTime) {
      const e = new Date(ev.end.dateTime).toLocaleTimeString("en-PH", opts);
      return s + " – " + e;
    }
    return s;
  }

  function isToday(d) {
    const now = new Date();
    return d.getFullYear() === now.getFullYear() &&
           d.getMonth() === now.getMonth() &&
           d.getDate() === now.getDate();
  }

  function el(tag, className, text) {
    const n = document.createElement(tag);
    if (className) n.className = className;
    if (text !== undefined) n.textContent = text;
    return n;
  }

  /* ---------- rendering ---------- */

  function render(events) {
    container.innerHTML = "";

    if (!events.length) {
      container.appendChild(el("p", "empty",
        "Nothing is scheduled right now. Check back after the editorial board meets."));
      return;
    }

    events.forEach(function (ev) {
      const start = startOf(ev);
      if (!start) return;

      const row = el("article", "event");

      const dateBlock = el("div", "event-date");
      dateBlock.appendChild(el("span", "event-month",
        start.toLocaleDateString("en-PH", { month: "short", timeZone: TZ })));
      dateBlock.appendChild(el("span", "event-day",
        start.toLocaleDateString("en-PH", { day: "numeric", timeZone: TZ })));
      dateBlock.appendChild(el("span", "event-year",
        start.toLocaleDateString("en-PH", { year: "numeric", timeZone: TZ })));

      const body = el("div");

      const name = el("h4", "event-name", ev.summary || "Untitled event");
      if (isToday(start)) name.appendChild(el("span", "event-today", "Today"));
      body.appendChild(name);

      const meta = el("p", "event-meta");
      meta.appendChild(el("span", null,
        start.toLocaleDateString("en-PH", { weekday: "long", timeZone: TZ })));
      meta.appendChild(el("span", null, timeLabel(ev)));
      if (ev.location) meta.appendChild(el("span", null, ev.location));
      body.appendChild(meta);

      if (ev.description) {
        const clean = ev.description.replace(/<[^>]*>/g, "").trim();
        if (clean) body.appendChild(el("p", "event-desc", clean));
      }

      row.appendChild(dateBlock);
      row.appendChild(body);
      container.appendChild(row);
    });
  }

  function showNotice(title, detail) {
    const box = el("div", "notice");
    box.appendChild(el("p", null, title));
    if (detail) box.appendChild(el("p", null, detail));
    container.parentNode.insertBefore(box, container);
  }

  /* ---------- fetch ---------- */

  function load() {
    if (!CONFIG.isSet("CALENDAR_API_KEY") || !CONFIG.isSet("CALENDAR_ID")) {
      statusEl.textContent = "Sample schedule";
      render(SAMPLE);
      showNotice(
        "These are sample events.",
        "Add your Calendar API key and calendar ID in js/config.js to show the real schedule."
      );
      return;
    }

    const url = "https://www.googleapis.com/calendar/v3/calendars/" +
      encodeURIComponent(CONFIG.CALENDAR_ID) + "/events" +
      "?key=" + encodeURIComponent(CONFIG.CALENDAR_API_KEY) +
      "&timeMin=" + encodeURIComponent(new Date().toISOString()) +
      "&singleEvents=true&orderBy=startTime" +
      "&maxResults=" + (CONFIG.MAX_EVENTS || 12);

    fetch(url)
      .then(function (res) {
        return res.json().then(function (data) {
          if (!res.ok) {
            const msg = (data.error && data.error.message) || ("HTTP " + res.status);
            throw new Error(msg);
          }
          return data;
        });
      })
      .then(function (data) {
        const items = data.items || [];
        statusEl.textContent = items.length
          ? items.length + (items.length === 1 ? " event" : " events") + " scheduled"
          : "Nothing scheduled";
        render(items);
      })
      .catch(function (err) {
        console.error("Calendar request failed:", err);
        statusEl.textContent = "Sample schedule";
        render(SAMPLE);
        showNotice(
          "The calendar could not be reached, so a sample schedule is shown.",
          "Check that the calendar is public, the API key allows this domain, and the Calendar API is enabled. (" + err.message + ")"
        );
      });
  }

  document.addEventListener("DOMContentLoaded", load);
})();
