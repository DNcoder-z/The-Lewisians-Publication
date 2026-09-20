/* ==========================================================
   COVERAGE REQUEST FORM
   Validates in the browser, then posts to the Apps Script
   web app, which writes to Sheets, builds a PDF and emails it.
   ========================================================== */

(function () {
  "use strict";

  const form = document.getElementById("coverage-form");
  if (!form) return;

  const statusEl = document.getElementById("form-status");
  const button = document.getElementById("submit-btn");

  const REQUIRED = {
    name: "Enter the name we should address the confirmation to.",
    email: "Enter an email address so we can send the confirmation.",
    event: "Tell us what the event is called.",
    date: "Choose the date of the event.",
    location: "Tell us where it will be held."
  };

  function setError(field, message) {
    const input = form.elements[field];
    const slot = form.querySelector('[data-err="' + field + '"]');
    if (input) input.classList.toggle("invalid", !!message);
    if (slot) slot.textContent = message || "";
  }

  function clearErrors() {
    Object.keys(REQUIRED).forEach(function (f) { setError(f, ""); });
  }

  function validEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
  }

  function validate(values) {
    let firstBad = null;

    Object.keys(REQUIRED).forEach(function (field) {
      if (!values[field]) {
        setError(field, REQUIRED[field]);
        if (!firstBad) firstBad = field;
      }
    });

    if (values.email && !validEmail(values.email)) {
      setError("email", "That email address does not look complete.");
      if (!firstBad) firstBad = "email";
    }

    if (values.date) {
      const chosen = new Date(values.date + "T23:59:59");
      if (chosen < new Date()) {
        setError("date", "Pick a date that has not passed yet.");
        if (!firstBad) firstBad = "date";
      }
    }

    return firstBad;
  }

  function collect() {
    const data = {};
    Array.prototype.forEach.call(form.elements, function (input) {
      if (input.name) data[input.name] = (input.value || "").trim();
    });
    return data;
  }

  function say(message, kind) {
    statusEl.textContent = message;
    statusEl.className = "status" + (kind ? " " + kind : "");
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    clearErrors();
    say("");

    const values = collect();
    const bad = validate(values);

    if (bad) {
      say("Some details still need fixing.", "bad");
      const input = form.elements[bad];
      if (input) input.focus();
      return;
    }

    if (!CONFIG.isSet("SCRIPT_URL")) {
      say("The form is not connected yet. Add your Apps Script URL in js/config.js.", "bad");
      return;
    }

    values.submittedAt = new Date().toISOString();
    values.source = "events.html";

    button.disabled = true;
    say("Sending your request…");

    /* Sent as text/plain so the browser does not fire a CORS preflight,
       which Apps Script web apps do not answer. */
    fetch(CONFIG.SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(values)
    })
      .then(function (res) { return res.json(); })
      .then(function (result) {
        if (result && result.status === "success") {
          form.reset();
          say("Request logged as " + result.id +
              ". A confirmation PDF is on its way to " + values.email + ".", "ok");
        } else {
          throw new Error((result && result.message) || "The server rejected the request.");
        }
      })
      .catch(function (err) {
        console.error("Submission failed:", err);
        say("The request could not be sent. Check your connection, or email the publication office directly.", "bad");
      })
      .finally(function () {
        button.disabled = false;
      });
  });

  /* Clear a field's error as soon as the person starts fixing it. */
  Object.keys(REQUIRED).forEach(function (field) {
    const input = form.elements[field];
    if (input) input.addEventListener("input", function () { setError(field, ""); });
  });
})();
