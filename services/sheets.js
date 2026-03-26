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

function now() {
  return new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });
}

// ============================================================
// Tab Definitions
// ============================================================

const TABS = {
  waitlist: {
    name: 'Waitlist',
    headers: [
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
    ],
    colWidths: [160, 260, 130, 200, 100, 260, 160, 260, 150, 130],
  },
  orders: {
    name: 'Order Log',
    headers: [
      'Order ID',
      'Client Name',
      'Service Package',
      'Duration (min)',
      'Shoot Date',
      'Shoot Time',
      'Location',
      'Photographer',
      'Status',
      'Received At',
      'Notes',
    ],
    colWidths: [100, 160, 200, 100, 120, 110, 260, 140, 120, 180, 260],
  },
  cancellations: {
    name: 'Cancellation Log',
    headers: [
      'Order ID',
      'Client Name',
      'Service Package',
      'Duration (min)',
      'Original Date',
      'Original Time',
      'Location',
      'Cancelled At',
      'Waitlist Matches',
      'Notified Carley',
      'Notes',
    ],
    colWidths: [100, 160, 200, 100, 120, 110, 260, 180, 120, 110, 260],
  },
  reschedules: {
    name: 'Reschedule Log',
    headers: [
      'Order ID',
      'Client Name',
      'Service Package',
      'Duration (min)',
      'Original Date',
      'Original Time',
      'New Date',
      'New Time',
      'Location',
      'Rescheduled At',
      'Waitlist Matches',
      'Notified Carley',
      'Notes',
    ],
    colWidths: [100, 160, 200, 100, 120, 110, 120, 110, 260, 180, 120, 110, 260],
  },
};

const TAB_NAMES = [
  TABS.waitlist.name,
  TABS.orders.name,
  TABS.cancellations.name,
  TABS.reschedules.name,
];

const COLORS = {
  headerBg: { red: 0.145, green: 0.145, blue: 0.145 },
  headerText: { red: 1, green: 1, blue: 1 },
  onWaitlist: { red: 0.85, green: 0.95, blue: 0.85 },
  rescheduled: { red: 0.85, green: 0.91, blue: 0.98 },
  nothingAvailable: { red: 0.93, green: 0.93, blue: 0.93 },
  completed: { red: 0.85, green: 0.91, blue: 0.98 },
  cancelled: { red: 0.98, green: 0.87, blue: 0.87 },
  yesGreen: { red: 0.85, green: 0.95, blue: 0.85 },
};

// ============================================================
// Sheet Setup (auto-provision on startup)
// ============================================================

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
  for (const tabDef of Object.values(TABS)) {
    const lastCol = String.fromCharCode(64 + tabDef.headers.length);
    const range = `${tabDef.name}!A1:${lastCol}1`;

    const res = await sheets.spreadsheets.values.get({ spreadsheetId, range });
    if (!res.data.values || res.data.values.length === 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range,
        valueInputOption: 'RAW',
        requestBody: { values: [tabDef.headers] },
      });
      console.log(`Wrote ${tabDef.name} headers.`);
    }
  }

  // Get sheet IDs for formatting
  const updated = await sheets.spreadsheets.get({ spreadsheetId });
  const sheetMap = {};
  for (const sheet of updated.data.sheets) {
    sheetMap[sheet.properties.title] = sheet.properties.sheetId;
  }

  const formatRequests = [];

  // Apply header formatting + freeze + column widths to all tabs
  for (const tabDef of Object.values(TABS)) {
    const sid = sheetMap[tabDef.name];
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

    // Freeze header row
    formatRequests.push({
      updateSheetProperties: {
        properties: { sheetId: sid, gridProperties: { frozenRowCount: 1 } },
        fields: 'gridProperties.frozenRowCount',
      },
    });

    // Column widths
    tabDef.colWidths.forEach((width, i) => {
      formatRequests.push({
        updateDimensionProperties: {
          range: { sheetId: sid, dimension: 'COLUMNS', startIndex: i, endIndex: i + 1 },
          properties: { pixelSize: width },
          fields: 'pixelSize',
        },
      });
    });
  }

  // ---- Waitlist tab: Status dropdown + conditional formatting ----
  const wlId = sheetMap[TABS.waitlist.name];
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

    // Nothing Available -> gray
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

  // ---- Order Log: Status dropdown + conditional formatting ----
  const olId = sheetMap[TABS.orders.name];
  if (olId !== undefined) {
    // Status dropdown (col I = index 8)
    formatRequests.push({
      setDataValidation: {
        range: { sheetId: olId, startRowIndex: 1, endRowIndex: 500, startColumnIndex: 8, endColumnIndex: 9 },
        rule: {
          condition: {
            type: 'ONE_OF_LIST',
            values: [
              { userEnteredValue: 'Scheduled' },
              { userEnteredValue: 'Completed' },
              { userEnteredValue: 'Cancelled' },
              { userEnteredValue: 'Rescheduled' },
            ],
          },
          showCustomUi: true,
          strict: false,
        },
      },
    });

    // Scheduled -> green
    formatRequests.push({
      addConditionalFormatRule: {
        rule: {
          ranges: [{ sheetId: olId, startRowIndex: 1, endRowIndex: 500 }],
          booleanRule: {
            condition: { type: 'CUSTOM_FORMULA', values: [{ userEnteredValue: '=$I2="Scheduled"' }] },
            format: { backgroundColor: COLORS.onWaitlist },
          },
        },
        index: 0,
      },
    });

    // Completed -> blue
    formatRequests.push({
      addConditionalFormatRule: {
        rule: {
          ranges: [{ sheetId: olId, startRowIndex: 1, endRowIndex: 500 }],
          booleanRule: {
            condition: { type: 'CUSTOM_FORMULA', values: [{ userEnteredValue: '=$I2="Completed"' }] },
            format: { backgroundColor: COLORS.completed },
          },
        },
        index: 1,
      },
    });

    // Cancelled -> red
    formatRequests.push({
      addConditionalFormatRule: {
        rule: {
          ranges: [{ sheetId: olId, startRowIndex: 1, endRowIndex: 500 }],
          booleanRule: {
            condition: { type: 'CUSTOM_FORMULA', values: [{ userEnteredValue: '=$I2="Cancelled"' }] },
            format: { backgroundColor: COLORS.cancelled },
          },
        },
        index: 2,
      },
    });

    // Rescheduled -> blue
    formatRequests.push({
      addConditionalFormatRule: {
        rule: {
          ranges: [{ sheetId: olId, startRowIndex: 1, endRowIndex: 500 }],
          booleanRule: {
            condition: { type: 'CUSTOM_FORMULA', values: [{ userEnteredValue: '=$I2="Rescheduled"' }] },
            format: { backgroundColor: COLORS.rescheduled },
          },
        },
        index: 3,
      },
    });
  }

  // ---- Cancellation Log: "Notified Carley" conditional formatting ----
  const clId = sheetMap[TABS.cancellations.name];
  if (clId !== undefined) {
    // Notified Carley dropdown (col J = index 9)
    formatRequests.push({
      setDataValidation: {
        range: { sheetId: clId, startRowIndex: 1, endRowIndex: 500, startColumnIndex: 9, endColumnIndex: 10 },
        rule: {
          condition: {
            type: 'ONE_OF_LIST',
            values: [
              { userEnteredValue: 'Yes' },
              { userEnteredValue: 'No' },
            ],
          },
          showCustomUi: true,
          strict: false,
        },
      },
    });

    // Yes -> green row
    formatRequests.push({
      addConditionalFormatRule: {
        rule: {
          ranges: [{ sheetId: clId, startRowIndex: 1, endRowIndex: 500 }],
          booleanRule: {
            condition: { type: 'CUSTOM_FORMULA', values: [{ userEnteredValue: '=$J2="Yes"' }] },
            format: { backgroundColor: COLORS.yesGreen },
          },
        },
        index: 0,
      },
    });
  }

  // ---- Reschedule Log: "Notified Carley" conditional formatting ----
  const rlId = sheetMap[TABS.reschedules.name];
  if (rlId !== undefined) {
    // Notified Carley dropdown (col L = index 11)
    formatRequests.push({
      setDataValidation: {
        range: { sheetId: rlId, startRowIndex: 1, endRowIndex: 500, startColumnIndex: 11, endColumnIndex: 12 },
        rule: {
          condition: {
            type: 'ONE_OF_LIST',
            values: [
              { userEnteredValue: 'Yes' },
              { userEnteredValue: 'No' },
            ],
          },
          showCustomUi: true,
          strict: false,
        },
      },
    });

    // Yes -> green row
    formatRequests.push({
      addConditionalFormatRule: {
        rule: {
          ranges: [{ sheetId: rlId, startRowIndex: 1, endRowIndex: 500 }],
          booleanRule: {
            condition: { type: 'CUSTOM_FORMULA', values: [{ userEnteredValue: '=$L2="Yes"' }] },
            format: { backgroundColor: COLORS.yesGreen },
          },
        },
        index: 0,
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
  console.log(`Google Sheet verified and ready (${TAB_NAMES.length} tabs).`);
}

// ============================================================
// Waitlist (read-only — Carley manages entries manually)
// ============================================================

async function getWaitlistEntries() {
  const sheets = await getSheets();
  const spreadsheetId = getSheetId();

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${TABS.waitlist.name}!A:J`,
  });

  const rows = res.data.values || [];
  if (rows.length <= 1) return [];

  return rows.slice(1).map((row, i) => ({
    rowNumber: i + 2,
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
// Order Log
// ============================================================

async function addOrderLogEntry(order) {
  const sheets = await getSheets();
  const spreadsheetId = getSheetId();

  const row = [
    order.orderId || '',
    order.clientName || '',
    order.servicePackage || '',
    order.duration || '',
    order.shootDate || '',
    order.shootTime || '',
    order.location || '',
    order.photographer || '',
    'Scheduled',
    now(),
    order.notes || '',
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${TABS.orders.name}!A:K`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [row] },
  });
}

// ============================================================
// Cancellation Log
// ============================================================

async function addCancellationLogEntry(event) {
  const sheets = await getSheets();
  const spreadsheetId = getSheetId();

  const row = [
    event.orderId || '',
    event.clientName || '',
    event.servicePackage || '',
    event.duration || '',
    event.shootDate || '',
    event.shootTime || '',
    event.location || '',
    now(),
    event.matchesFound || 0,
    event.matchesFound > 0 ? 'Yes' : 'No',
    event.notes || '',
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${TABS.cancellations.name}!A:K`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [row] },
  });
}

// ============================================================
// Reschedule Log
// ============================================================

async function addRescheduleLogEntry(event) {
  const sheets = await getSheets();
  const spreadsheetId = getSheetId();

  const row = [
    event.orderId || '',
    event.clientName || '',
    event.servicePackage || '',
    event.duration || '',
    event.originalDate || '',
    event.originalTime || '',
    event.newDate || '',
    event.newTime || '',
    event.location || '',
    now(),
    event.matchesFound || 0,
    event.matchesFound > 0 ? 'Yes' : 'No',
    event.notes || '',
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${TABS.reschedules.name}!A:M`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [row] },
  });
}

module.exports = {
  ensureSheetSetup,
  getWaitlistEntries,
  getActiveWaitlistEntries,
  addOrderLogEntry,
  addCancellationLogEntry,
  addRescheduleLogEntry,
};
