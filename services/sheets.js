const { google } = require('googleapis');

let sheetsClient = null;
let sheetReady = false;

function getAuth() {
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!key) throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY not configured');

  const credentials = JSON.parse(key);
  return new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
}

async function getSheets() {
  if (!sheetsClient) {
    const auth = getAuth();
    sheetsClient = google.sheets({ version: 'v4', auth });
  }
  return sheetsClient;
}

function getSheetId() {
  const id = process.env.GOOGLE_SHEETS_ID || process.env.GOOGLE_SHEET_ID;
  if (!id) throw new Error('GOOGLE_SHEETS_ID not configured');
  return id;
}

// --- Waitlist tab (matches Carley's current format) ---
const WAITLIST_HEADERS = [
  'Client Name',
  'Preferred Timing',
  'Wants Before Date',
  'Service Package',
  'Duration (min)',
  'Location',
  'Photographer Preference',
  'Notes',
  'Status',
  'Date Added',
];

const WAITLIST_COL_WIDTHS = [
  160, 250, 130, 200, 100, 250, 160, 250, 140, 130,
];

// --- Cancellation Log tab ---
const CANCELLATION_HEADERS = [
  'Date',
  'Time',
  'Duration (min)',
  'Cancelled By',
  'Received At',
  'Matches Found',
  'Notes',
];

const CANCELLATION_COL_WIDTHS = [
  120, 110, 100, 160, 180, 110, 250,
];

const COLORS = {
  headerBg: { red: 0.145, green: 0.145, blue: 0.145 },
  headerText: { red: 1, green: 1, blue: 1 },
  onWaitlist: { red: 0.85, green: 0.95, blue: 0.85 },
  rescheduled: { red: 0.85, green: 0.91, blue: 0.98 },
  nothingAvailable: { red: 0.98, green: 0.87, blue: 0.87 },
};

const TAB_NAMES = ['Waitlist', 'Cancellation Log'];

async function ensureSheetSetup() {
  if (sheetReady) return;

  const sheets = await getSheets();
  const spreadsheetId = getSheetId();
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
  const existingTabs = spreadsheet.data.sheets.map((s) => s.properties.title);

  // Create missing tabs
  const addRequests = [];
  for (const tab of TAB_NAMES) {
    if (!existingTabs.includes(tab)) {
      addRequests.push({ addSheet: { properties: { title: tab } } });
    }
  }

  if (addRequests.length > 0) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: addRequests },
    });
    console.log('Created tabs:', addRequests.map((r) => r.addSheet.properties.title).join(', '));
  }

  // Write headers if empty
  const headerConfigs = [
    { tab: 'Waitlist', headers: WAITLIST_HEADERS, range: `A1:${String.fromCharCode(64 + WAITLIST_HEADERS.length)}1` },
    { tab: 'Cancellation Log', headers: CANCELLATION_HEADERS, range: `A1:${String.fromCharCode(64 + CANCELLATION_HEADERS.length)}1` },
  ];

  for (const cfg of headerConfigs) {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${cfg.tab}!${cfg.range}`,
    });
    if (!res.data.values || res.data.values.length === 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${cfg.tab}!${cfg.range}`,
        valueInputOption: 'RAW',
        requestBody: { values: [cfg.headers] },
      });
      console.log(`Wrote ${cfg.tab} headers.`);
    }
  }

  // Get sheet IDs for formatting
  const updated = await sheets.spreadsheets.get({ spreadsheetId });
  const sheetMap = {};
  for (const sheet of updated.data.sheets) {
    sheetMap[sheet.properties.title] = sheet.properties.sheetId;
  }

  const formatRequests = [];

  // Apply header formatting + freeze + column widths to both tabs
  const tabConfigs = [
    { name: 'Waitlist', widths: WAITLIST_COL_WIDTHS },
    { name: 'Cancellation Log', widths: CANCELLATION_COL_WIDTHS },
  ];

  for (const cfg of tabConfigs) {
    const sid = sheetMap[cfg.name];
    if (sid === undefined) continue;

    // Header style
    formatRequests.push({
      repeatCell: {
        range: { sheetId: sid, startRowIndex: 0, endRowIndex: 1 },
        cell: {
          userEnteredFormat: {
            textFormat: { bold: true, fontSize: 10, foregroundColor: COLORS.headerText },
            backgroundColor: COLORS.headerBg,
            horizontalAlignment: 'CENTER',
            verticalAlignment: 'MIDDLE',
            wrapStrategy: 'WRAP',
            padding: { top: 4, bottom: 4, left: 6, right: 6 },
          },
        },
        fields: 'userEnteredFormat(textFormat,backgroundColor,horizontalAlignment,verticalAlignment,wrapStrategy,padding)',
      },
    });

    // Freeze header
    formatRequests.push({
      updateSheetProperties: {
        properties: { sheetId: sid, gridProperties: { frozenRowCount: 1 } },
        fields: 'gridProperties.frozenRowCount',
      },
    });

    // Column widths
    cfg.widths.forEach((width, i) => {
      formatRequests.push({
        updateDimensionProperties: {
          range: { sheetId: sid, dimension: 'COLUMNS', startIndex: i, endIndex: i + 1 },
          properties: { pixelSize: width },
          fields: 'pixelSize',
        },
      });
    });
  }

  // Waitlist tab: Status dropdown + conditional formatting
  const wlId = sheetMap['Waitlist'];
  if (wlId !== undefined) {
    // Status dropdown (col I = index 8)
    formatRequests.push({
      setDataValidation: {
        range: { sheetId: wlId, startRowIndex: 1, endRowIndex: 500, startColumnIndex: 8, endColumnIndex: 9 },
        rule: {
          condition: {
            type: 'ONE_OF_LIST',
            values: [
              { userEnteredValue: 'On Waitlist' },
              { userEnteredValue: 'Rescheduled' },
              { userEnteredValue: 'Nothing Available' },
            ],
          },
          showCustomUi: true,
          strict: false,
        },
      },
    });

    // On Waitlist -> green
    formatRequests.push({
      addConditionalFormatRule: {
        rule: {
          ranges: [{ sheetId: wlId, startRowIndex: 1, endRowIndex: 500 }],
          booleanRule: {
            condition: { type: 'CUSTOM_FORMULA', values: [{ userEnteredValue: '=$I2="On Waitlist"' }] },
            format: { backgroundColor: COLORS.onWaitlist },
          },
        },
        index: 0,
      },
    });

    // Rescheduled -> blue
    formatRequests.push({
      addConditionalFormatRule: {
        rule: {
          ranges: [{ sheetId: wlId, startRowIndex: 1, endRowIndex: 500 }],
          booleanRule: {
            condition: { type: 'CUSTOM_FORMULA', values: [{ userEnteredValue: '=$I2="Rescheduled"' }] },
            format: { backgroundColor: COLORS.rescheduled },
          },
        },
        index: 1,
      },
    });

    // Nothing Available -> red
    formatRequests.push({
      addConditionalFormatRule: {
        rule: {
          ranges: [{ sheetId: wlId, startRowIndex: 1, endRowIndex: 500 }],
          booleanRule: {
            condition: { type: 'CUSTOM_FORMULA', values: [{ userEnteredValue: '=$I2="Nothing Available"' }] },
            format: { backgroundColor: COLORS.nothingAvailable },
          },
        },
        index: 2,
      },
    });
  }

  if (formatRequests.length > 0) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: formatRequests },
    });
  }

  sheetReady = true;
  console.log('Google Sheet verified and ready (2 tabs).');
}

// ============================================================
// Read waitlist entries (Carley manages these manually)
// ============================================================

function now() {
  return new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });
}

async function getWaitlistEntries() {
  const sheets = await getSheets();
  const spreadsheetId = getSheetId();

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'Waitlist!A:J',
  });

  const rows = res.data.values || [];
  if (rows.length <= 1) return [];

  return rows.slice(1).map((row, i) => ({
    rowNumber: i + 2, // 1-indexed, skip header
    clientName: row[0] || '',
    preferredTiming: row[1] || '',
    wantsBeforeDate: row[2] || '',
    servicePackage: row[3] || '',
    duration: parseInt(row[4] || '0', 10) || 0,
    location: row[5] || '',
    photographerPreference: row[6] || '',
    notes: row[7] || '',
    status: row[8] || '',
    dateAdded: row[9] || '',
  }));
}

async function getActiveWaitlistEntries() {
  const entries = await getWaitlistEntries();
  return entries.filter((e) => e.status === 'On Waitlist');
}

// ============================================================
// Cancellation Log (for tracking)
// ============================================================

async function addCancellationLogEntry(event) {
  const sheets = await getSheets();
  const spreadsheetId = getSheetId();

  const row = [
    event.shootDate || '',
    event.shootTime || '',
    event.duration || '',
    event.cancelledBy || '',
    now(),
    event.matchesFound || 0,
    event.notes || '',
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: 'Cancellation Log!A:G',
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [row] },
  });
}

module.exports = {
  ensureSheetSetup,
  getWaitlistEntries,
  getActiveWaitlistEntries,
  addCancellationLogEntry,
};
