/**
 * THE LEWISIANS — Coverage request backend
 *
 * Flow:
 *   events.html form  →  doPost()  →  Google Sheets (log)
 *                                  →  Google Docs (confirmation slip)
 *                                  →  PDF
 *                                  →  Gmail (to requester + to the office)
 *
 * Approved requests are pushed to Google Calendar by
 * publishApprovedRequests(), run from the custom menu — not automatically,
 * so nothing appears on the public calendar without editorial review.
 *
 * Setup: see README.md, section "Backend".
 */

/* ============ SETTINGS ============ */

const SETTINGS = {
  SHEET_NAME: 'Requests',
  OFFICE_EMAIL: 'lewisians@example.com',   // where the board is notified
  PUBLICATION: 'The Lewisians',
  SCHOOL: 'The Lewis College — Higher Education Department',
  CALENDAR_ID: 'PASTE_YOUR_CALENDAR_ID_HERE',
  TIMEZONE: 'Asia/Manila',
  ID_PREFIX: 'LW'
};

const HEADERS = [
  'ID', 'Submitted', 'Name', 'Email', 'Organization', 'Event',
  'Date', 'Time', 'Location', 'Coverage', 'Message', 'Status', 'Calendar event ID'
];

/* ============ WEB APP ENTRY POINTS ============ */

function doGet() {
  return json({ status: 'ok', service: 'Lewisians coverage requests' });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);

    const data = parseBody(e);
    const problem = validate(data);
    if (problem) return json({ status: 'error', message: problem });

    const sheet = getSheet();
    const id = nextId(sheet);

    sheet.appendRow([
      id,
      new Date(),
      data.name,
      data.email,
      data.organization || '',
      data.event,
      data.date,
      data.time || '',
      data.location,
      data.coverage || 'Not specified',
      data.message || '',
      'Pending',
      ''
    ]);

    const pdf = buildConfirmationPdf(id, data);
    emailRequester(id, data, pdf);
    notifyOffice(id, data);

    return json({ status: 'success', id: id, message: 'Request logged and confirmation sent.' });

  } catch (err) {
    console.error(err);
    return json({ status: 'error', message: String(err) });
  } finally {
    try { lock.releaseLock(); } catch (ignore) {}
  }
}

/* ============ INPUT ============ */

function parseBody(e) {
  if (e && e.postData && e.postData.contents) {
    try { return JSON.parse(e.postData.contents); }
    catch (err) { /* fall through to form-encoded */ }
  }
  return (e && e.parameter) ? e.parameter : {};
}

function validate(d) {
  if (!d.name) return 'A name is required.';
  if (!d.email) return 'An email address is required.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(d.email))) return 'That email address is not valid.';
  if (!d.event) return 'An event name is required.';
  if (!d.date) return 'An event date is required.';
  if (!d.location) return 'A location is required.';
  return null;
}

/* ============ SHEET ============ */

function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SETTINGS.SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(SETTINGS.SHEET_NAME);
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.getRange(1, 1, 1, HEADERS.length)
         .setFontWeight('bold')
         .setBackground('#121C2E')
         .setFontColor('#FFFFFF');
    sheet.setFrozenRows(1);
    sheet.setColumnWidth(1, 80);
    sheet.setColumnWidth(6, 220);
    sheet.setColumnWidth(11, 300);
  }
  return sheet;
}

function nextId(sheet) {
  const rows = sheet.getLastRow() - 1;          // minus header
  const n = Math.max(rows, 0) + 1;
  return SETTINGS.ID_PREFIX + Utilities.formatString('%03d', n);
}

/* ============ DOCUMENT → PDF ============ */

function buildConfirmationPdf(id, d) {
  const doc = DocumentApp.create('Coverage Request ' + id);
  const body = doc.getBody();
  body.setMarginTop(56).setMarginBottom(56).setMarginLeft(56).setMarginRight(56);

  const mark = body.appendParagraph(SETTINGS.PUBLICATION);
  mark.setHeading(DocumentApp.ParagraphHeading.TITLE);

  body.appendParagraph(SETTINGS.SCHOOL)
      .setForegroundColor('#5F6675');
  body.appendHorizontalRule();

  body.appendParagraph('Coverage request confirmation')
      .setHeading(DocumentApp.ParagraphHeading.HEADING1);

  body.appendParagraph(
    'This confirms that the publication has received the request below. ' +
    'The editorial board reviews every request and will contact you about assignment ' +
    'of writers or photographers. Keep this slip for reference.'
  );

  const rows = [
    ['Reference number', id],
    ['Status', 'Pending review'],
    ['Requested by', d.name],
    ['Email', d.email],
    ['Organization', d.organization || '—'],
    ['Event', d.event],
    ['Date', formatDate(d.date)],
    ['Time', d.time || 'Not specified'],
    ['Location', d.location],
    ['Coverage requested', d.coverage || 'Not specified'],
    ['Notes', d.message || '—'],
    ['Received', Utilities.formatDate(new Date(), SETTINGS.TIMEZONE, "MMMM d, yyyy 'at' h:mm a")]
  ];

  const table = body.appendTable(rows);
  table.setBorderWidth(0);
  for (let r = 0; r < rows.length; r++) {
    const label = table.getCell(r, 0);
    label.setWidth(150);
    label.getChild(0).asParagraph().editAsText().setBold(true).setForegroundColor('#121C2E');
  }

  body.appendParagraph('');
  body.appendParagraph(
    'Questions about this request may be sent to ' + SETTINGS.OFFICE_EMAIL + '.'
  ).setForegroundColor('#5F6675').setFontSize(9);

  doc.saveAndClose();

  const file = DriveApp.getFileById(doc.getId());
  const pdf = file.getAs('application/pdf').setName('Coverage-Request-' + id + '.pdf');

  file.setTrashed(true);   // keep Drive tidy; the PDF is already in memory
  return pdf;
}

function formatDate(value) {
  try {
    const d = new Date(value + 'T00:00:00');
    return Utilities.formatDate(d, SETTINGS.TIMEZONE, 'EEEE, MMMM d, yyyy');
  } catch (err) {
    return value;
  }
}

/* ============ EMAIL ============ */

function emailRequester(id, d, pdf) {
  const subject = SETTINGS.PUBLICATION + ' — coverage request ' + id + ' received';

  const html =
    '<div style="font-family:Helvetica,Arial,sans-serif;color:#2A3040;line-height:1.6">' +
      '<p style="font-size:22px;margin:0 0 4px;color:#121C2E"><strong>' + SETTINGS.PUBLICATION + '</strong></p>' +
      '<p style="margin:0 0 20px;color:#5F6675;font-size:13px">' + SETTINGS.SCHOOL + '</p>' +
      '<p>Hi ' + escapeHtml(d.name) + ',</p>' +
      '<p>We received your coverage request for <strong>' + escapeHtml(d.event) + '</strong> on ' +
        formatDate(d.date) + ' at ' + escapeHtml(d.location) + '.</p>' +
      '<p>Your reference number is <strong>' + id + '</strong>. ' +
        'The confirmation slip is attached as a PDF.</p>' +
      '<p>The editorial board reviews requests before scheduling them, so the event will ' +
        'appear on the public calendar only once it has been approved.</p>' +
      '<p style="color:#5F6675;font-size:13px;margin-top:24px">' +
        'Sent automatically by the Lewisians website. Reply to this email to reach the office.</p>' +
    '</div>';

  MailApp.sendEmail({
    to: d.email,
    subject: subject,
    htmlBody: html,
    attachments: [pdf],
    name: SETTINGS.PUBLICATION
  });
}

function notifyOffice(id, d) {
  if (!SETTINGS.OFFICE_EMAIL || SETTINGS.OFFICE_EMAIL.indexOf('example.com') > -1) return;

  MailApp.sendEmail({
    to: SETTINGS.OFFICE_EMAIL,
    subject: 'New coverage request ' + id + ' — ' + d.event,
    body:
      id + '\n\n' +
      'Event: ' + d.event + '\n' +
      'Date: ' + formatDate(d.date) + (d.time ? ' at ' + d.time : '') + '\n' +
      'Location: ' + d.location + '\n' +
      'Coverage: ' + (d.coverage || 'Not specified') + '\n\n' +
      'From: ' + d.name + ' (' + d.email + ')\n' +
      'Organization: ' + (d.organization || '—') + '\n\n' +
      'Notes: ' + (d.message || '—') + '\n\n' +
      'Set Status to "Approved" in the sheet, then run ' +
      'Lewisians → Publish approved requests to add it to the calendar.',
    name: SETTINGS.PUBLICATION
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

/* ============ CALENDAR (manual, after review) ============ */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Lewisians')
    .addItem('Publish approved requests to calendar', 'publishApprovedRequests')
    .addItem('Set up sheet', 'getSheet')
    .addToUi();
}

/**
 * Adds every row marked "Approved" (and not yet published) to the
 * publication calendar, then marks it "Published".
 */
function publishApprovedRequests() {
  if (SETTINGS.CALENDAR_ID.indexOf('PASTE_') === 0) {
    SpreadsheetApp.getUi().alert('Add your calendar ID to SETTINGS first.');
    return;
  }

  const sheet = getSheet();
  const last = sheet.getLastRow();
  if (last < 2) return;

  const values = sheet.getRange(2, 1, last - 1, HEADERS.length).getValues();
  const calendar = CalendarApp.getCalendarById(SETTINGS.CALENDAR_ID);
  let added = 0;

  values.forEach(function (row, i) {
    const status = String(row[11]).trim().toLowerCase();
    const alreadyOnCalendar = String(row[12]).trim();
    if (status !== 'approved' || alreadyOnCalendar) return;

    const title = row[5];
    const dateStr = row[6];
    const timeStr = String(row[7] || '').trim();
    const location = row[8];

    let event;
    if (timeStr) {
      const start = new Date(dateStr + 'T' + padTime(timeStr) + ':00');
      const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
      event = calendar.createEvent(title, start, end, {
        location: location,
        description: 'Coverage requested by ' + row[2] + ' (' + row[3] + ').'
      });
    } else {
      event = calendar.createAllDayEvent(title, new Date(dateStr + 'T00:00:00'), {
        location: location,
        description: 'Coverage requested by ' + row[2] + ' (' + row[3] + ').'
      });
    }

    sheet.getRange(i + 2, 12).setValue('Published');
    sheet.getRange(i + 2, 13).setValue(event.getId());
    added++;
  });

  SpreadsheetApp.getUi().alert(
    added ? added + ' event(s) added to the calendar.' : 'No approved requests are waiting.'
  );
}

function padTime(t) {
  const parts = String(t).split(':');
  const h = ('0' + (parts[0] || '0')).slice(-2);
  const m = ('0' + (parts[1] || '0')).slice(-2);
  return h + ':' + m;
}

/* ============ UTIL ============ */

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/* Run this once from the editor to grant permissions and see a test row. */
function testSubmission() {
  const result = doPost({
    postData: {
      contents: JSON.stringify({
        name: 'Test Student',
        email: Session.getActiveUser().getEmail(),
        organization: 'Higher Education Department',
        event: 'Test coverage request',
        date: Utilities.formatDate(new Date(Date.now() + 864e5 * 7), SETTINGS.TIMEZONE, 'yyyy-MM-dd'),
        time: '09:00',
        location: 'Publication Office',
        coverage: 'Writing and photography',
        message: 'Generated by testSubmission().'
      })
    }
  });
  console.log(result.getContent());
}
