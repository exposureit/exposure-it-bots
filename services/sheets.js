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

// --- Tab 1: Active Waitlist (A:S) ---
const WAITLIST_HEADERS = [
  'ID', 'Agent Name', 'Agent Phone', 'Agent Email', 'Listing Address',
  'Square Footage', 'Service Type', 'Base Duration', 'Adjusted Duration',
  'Timing', 'Date Range Start', 'Date Range End', 'Notes', 'Added By',
  'Source', 'Date Added', 'Status', 'Notifications Sent', 'Last Notified',
];

// --- Tab 2: Cancellation Log (A:L) ---
const CANCELLATION_LOG_HEADERS = [
  'Event ID', 'Shoot Date', 'Shoot Time', 'Duration (min)', 'Cancelled By',
  'Received At', 'Status', 'Filled By', 'Agents Notified', 'Agents Skipped',
  'Claimed By', 'Claimed At',
];

// --- Tab 3: Claim Log (A:K) ---
const CLAIM_LOG_HEADERS = [
  'Claim ID', 'Waitlist ID', 'Event ID', 'Agent Name', 'Agent Phone',
  'Service', 'Duration', 'Listing Address', 'Sq Ft', 'Claimed At',
  'Booked in Spiro',
];

// Column widths for Active Waitlist (A-S)
const WAITLIST_COL_WIDTHS = [
  80, 160, 130, 220, 250, 100, 160, 100, 110,
  140, 120, 120, 200, 100, 100, 180, 100, 120, 180,
];

// Column widths for Cancellation Log (A-L)
const CANCEL_COL_WIDTHS = [
  90, 120, 110, 100, 160, 180, 130, 160, 110, 110, 160, 180,
];

// Column widths for Claim Log (A-K)
const CLAIM_COL_WIDTHS = [
  90, 100, 100, 160, 130, 160, 80, 250, 80, 180, 130,
];

const COLORS = {
  headerBg: { red: 0.145, green: 0.145, blue: 0.145 },
  headerText: { red: 1, green: 1, blue: 1 },
  activeGreen: { red: 0.85, green: 0.95, blue: 0.85 },
  claimedBlue: { red: 0.85, green: 0.91, blue: 0.98 },
  expiredRed: { red: 0.98, green: 0.87, blue: 0.87 },
  removedGray: { red: 0.93, green: 0.93, blue: 0.93 },
  openYellow: { red: 1, green: 0.97, blue: 0.85 },
  filledPurple: { red: 0.93, green: 0.88, blue: 0.98 },
};

const TAB_NAMES = ['Active Waitlist', 'Cancellation Log', 'Claim Log'];

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
    { tab: 'Active Waitlist', headers: WAITLIST_HEADERS, range: 'A1:S1' },
    { tab: 'Cancellation Log', headers: CANCELLATION_LOG_HEADERS, range: 'A1:L1' },
    { tab: 'Claim Log', headers: CLAIM_LOG_HEADERS, range: 'A1:K1' },
  ];

  for (const cfg of headerConfigs) {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId, range: `${cfg.tab}!${cfg.range}`,
    });
    if (!res.data.values || res.data.values.length === 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId, range: `${cfg.tab}!${cfg.range}`,
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

  // Apply header formatting + freeze + column widths to all tabs
  const tabConfigs = [
    { name: 'Active Waitlist', widths: WAITLIST_COL_WIDTHS },
    { name: 'Cancellation Log', widths: CANCEL_COL_WIDTHS },
    { name: 'Claim Log', widths: CLAIM_COL_WIDTHS },
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

  // --- Active Waitlist data validation & conditional formatting ---
  const wlId = sheetMap['Active Waitlist'];
  if (wlId !== undefined) {
    // Timing dropdown (col J = index 9)
    formatRequests.push({
      setDataValidation: {
        range: { sheetId: wlId, startRowIndex: 1, endRowIndex: 500, startColumnIndex: 9, endColumnIndex: 10 },
        rule: {
          condition: {
            type: 'ONE_OF_LIST',
            values: [
              { userEnteredValue: 'Next Available' },
              { userEnteredValue: 'Specific Dates' },
            ],
          },
          showCustomUi: true, strict: false,
        },
      },
    });

    // Status dropdown (col Q = index 16)
    formatRequests.push({
      setDataValidation: {
        range: { sheetId: wlId, startRowIndex: 1, endRowIndex: 500, startColumnIndex: 16, endColumnIndex: 17 },
        rule: {
          condition: {
            type: 'ONE_OF_LIST',
            values: [
              { userEnteredValue: 'Active' },
              { userEnteredValue: 'Claimed' },
              { userEnteredValue: 'Removed (Self)' },
              { userEnteredValue: 'Expired' },
            ],
          },
          showCustomUi: true, strict: false,
        },
      },
    });

    // Source dropdown (col O = index 14)
    formatRequests.push({
      setDataValidation: {
        range: { sheetId: wlId, startRowIndex: 1, endRowIndex: 500, startColumnIndex: 14, endColumnIndex: 15 },
        rule: {
          condition: {
            type: 'ONE_OF_LIST',
            values: [
              { userEnteredValue: 'Website' },
              { userEnteredValue: 'Linktree' },
              { userEnteredValue: 'Spiro' },
              { userEnteredValue: 'Instagram' },
              { userEnteredValue: 'Carley' },
            ],
          },
          showCustomUi: true, strict: false,
        },
      },
    });

    // Conditional formatting: Active -> green
    formatRequests.push({
      addConditionalFormatRule: {
        rule: {
          ranges: [{ sheetId: wlId, startRowIndex: 1, endRowIndex: 500 }],
          booleanRule: {
            condition: { type: 'CUSTOM_FORMULA', values: [{ userEnteredValue: '=$Q2="Active"' }] },
            format: { backgroundColor: COLORS.activeGreen },
          },
        },
        index: 0,
      },
    });

    // Claimed -> blue
    formatRequests.push({
      addConditionalFormatRule: {
        rule: {
          ranges: [{ sheetId: wlId, startRowIndex: 1, endRowIndex: 500 }],
          booleanRule: {
            condition: { type: 'CUSTOM_FORMULA', values: [{ userEnteredValue: '=$Q2="Claimed"' }] },
            format: { backgroundColor: COLORS.claimedBlue },
          },
        },
        index: 1,
      },
    });

    // Removed/Expired -> red
    formatRequests.push({
      addConditionalFormatRule: {
        rule: {
          ranges: [{ sheetId: wlId, startRowIndex: 1, endRowIndex: 500 }],
          booleanRule: {
            condition: { type: 'CUSTOM_FORMULA', values: [{ userEnteredValue: '=OR($Q2="Removed (Self)",$Q2="Expired")' }] },
            format: { backgroundColor: COLORS.expiredRed },
          },
        },
        index: 2,
      },
    });

    // Center-align ID, Status, Notifications Sent, Sq Ft, Base/Adj Duration
    [0, 5, 7, 8, 16, 17].forEach((col) => {
      formatRequests.push({
        repeatCell: {
          range: { sheetId: wlId, startRowIndex: 1, endRowIndex: 500, startColumnIndex: col, endColumnIndex: col + 1 },
          cell: { userEnteredFormat: { horizontalAlignment: 'CENTER' } },
          fields: 'userEnteredFormat.horizontalAlignment',
        },
      });
    });
  }

  // --- Cancellation Log data validation & conditional formatting ---
  const clId = sheetMap['Cancellation Log'];
  if (clId !== undefined) {
    // Status dropdown (col G = index 6)
    formatRequests.push({
      setDataValidation: {
        range: { sheetId: clId, startRowIndex: 1, endRowIndex: 500, startColumnIndex: 6, endColumnIndex: 7 },
        rule: {
          condition: {
            type: 'ONE_OF_LIST',
            values: [
              { userEnteredValue: 'Open' },
              { userEnteredValue: 'Claimed' },
              { userEnteredValue: 'Filled Externally' },
              { userEnteredValue: 'Expired' },
            ],
          },
          showCustomUi: true, strict: false,
        },
      },
    });

    // Open -> yellow
    formatRequests.push({
      addConditionalFormatRule: {
        rule: {
          ranges: [{ sheetId: clId, startRowIndex: 1, endRowIndex: 500 }],
          booleanRule: {
            condition: { type: 'CUSTOM_FORMULA', values: [{ userEnteredValue: '=$G2="Open"' }] },
            format: { backgroundColor: COLORS.openYellow },
          },
        },
        index: 0,
      },
    });

    // Claimed -> green
    formatRequests.push({
      addConditionalFormatRule: {
        rule: {
          ranges: [{ sheetId: clId, startRowIndex: 1, endRowIndex: 500 }],
          booleanRule: {
            condition: { type: 'CUSTOM_FORMULA', values: [{ userEnteredValue: '=$G2="Claimed"' }] },
            format: { backgroundColor: COLORS.activeGreen },
          },
        },
        index: 1,
      },
    });

    // Filled Externally -> purple
    formatRequests.push({
      addConditionalFormatRule: {
        rule: {
          ranges: [{ sheetId: clId, startRowIndex: 1, endRowIndex: 500 }],
          booleanRule: {
            condition: { type: 'CUSTOM_FORMULA', values: [{ userEnteredValue: '=$G2="Filled Externally"' }] },
            format: { backgroundColor: COLORS.filledPurple },
          },
        },
        index: 2,
      },
    });

    // Expired -> red
    formatRequests.push({
      addConditionalFormatRule: {
        rule: {
          ranges: [{ sheetId: clId, startRowIndex: 1, endRowIndex: 500 }],
          booleanRule: {
            condition: { type: 'CUSTOM_FORMULA', values: [{ userEnteredValue: '=$G2="Expired"' }] },
            format: { backgroundColor: COLORS.expiredRed },
          },
        },
        index: 3,
      },
    });

    // Center-align columns
    [0, 3, 6, 8, 9].forEach((col) => {
      formatRequests.push({
        repeatCell: {
          range: { sheetId: clId, startRowIndex: 1, endRowIndex: 500, startColumnIndex: col, endColumnIndex: col + 1 },
          cell: { userEnteredFormat: { horizontalAlignment: 'CENTER' } },
          fields: 'userEnteredFormat.horizontalAlignment',
        },
      });
    });
  }

  // --- Claim Log data validation & conditional formatting ---
  const cmId = sheetMap['Claim Log'];
  if (cmId !== undefined) {
    // Booked in Spiro dropdown (col K = index 10)
    formatRequests.push({
      setDataValidation: {
        range: { sheetId: cmId, startRowIndex: 1, endRowIndex: 500, startColumnIndex: 10, endColumnIndex: 11 },
        rule: {
          condition: {
            type: 'ONE_OF_LIST',
            values: [
              { userEnteredValue: 'Yes' },
              { userEnteredValue: 'No' },
            ],
          },
          showCustomUi: true, strict: true,
        },
      },
    });

    // Booked=Yes -> green
    formatRequests.push({
      addConditionalFormatRule: {
        rule: {
          ranges: [{ sheetId: cmId, startRowIndex: 1, endRowIndex: 500 }],
          booleanRule: {
            condition: { type: 'CUSTOM_FORMULA', values: [{ userEnteredValue: '=$K2="Yes"' }] },
            format: { backgroundColor: COLORS.activeGreen },
          },
        },
        index: 0,
      },
    });

    // Booked=No -> red
    formatRequests.push({
      addConditionalFormatRule: {
        rule: {
          ranges: [{ sheetId: cmId, startRowIndex: 1, endRowIndex: 500 }],
          booleanRule: {
            condition: { type: 'CUSTOM_FORMULA', values: [{ userEnteredValue: '=$K2="No"' }] },
            format: { backgroundColor: COLORS.expiredRed },
          },
        },
        index: 1,
      },
    });

    // Center-align IDs and Booked
    [0, 1, 2, 6, 8, 10].forEach((col) => {
      formatRequests.push({
        repeatCell: {
          range: { sheetId: cmId, startRowIndex: 1, endRowIndex: 500, startColumnIndex: col, endColumnIndex: col + 1 },
          cell: { userEnteredFormat: { horizontalAlignment: 'CENTER' } },
          fields: 'userEnteredFormat.horizontalAlignment',
        },
      });
    });
  }

  if (formatRequests.length > 0) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: formatRequests },
    });
  }

  sheetReady = true;
  console.log('Google Sheet verified and ready (3 tabs).');
}

// ============================================================
// Active Waitlist CRUD
// ============================================================

function now() {
  return new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });
}

async function getNextId(sheets, spreadsheetId, tab, prefix, col) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${tab}!${col}:${col}`,
  });
  const rows = res.data.values || [];
  let maxNum = 0;
  for (let i = 1; i < rows.length; i++) {
    const match = (rows[i][0] || '').match(new RegExp(`^${prefix}-(\\d+)$`));
    if (match) maxNum = Math.max(maxNum, parseInt(match[1], 10));
  }
  return `${prefix}-${String(maxNum + 1).padStart(3, '0')}`;
}

async function addWaitlistEntry(entry) {
  const sheets = await getSheets();
  const spreadsheetId = getSheetId();
  const id = await getNextId(sheets, spreadsheetId, 'Active Waitlist', 'WL', 'A');

  const row = [
    id,                                    // A: ID
    entry.agentName,                       // B: Agent Name
    entry.agentPhone,                      // C: Agent Phone
    entry.agentEmail,                      // D: Agent Email
    entry.listingAddress || '',            // E: Listing Address
    entry.squareFootage || '',             // F: Square Footage
    entry.serviceType,                     // G: Service Type
    entry.baseDuration || '',              // H: Base Duration
    entry.adjustedDuration || '',          // I: Adjusted Duration
    entry.timing || 'Next Available',      // J: Timing
    entry.dateRangeStart || '',            // K: Date Range Start
    entry.dateRangeEnd || '',              // L: Date Range End
    entry.notes || '',                     // M: Notes
    entry.addedBy || 'Self-Signup',        // N: Added By
    entry.source || 'Website',            // O: Source
    now(),                                 // P: Date Added
    'Active',                              // Q: Status
    0,                                     // R: Notifications Sent
    '',                                    // S: Last Notified
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: 'Active Waitlist!A:S',
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [row] },
  });

  return { id, ...entry };
}

async function getActiveWaitlistEntries() {
  const sheets = await getSheets();
  const spreadsheetId = getSheetId();

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'Active Waitlist!A:S',
  });

  const rows = res.data.values || [];
  if (rows.length <= 1) return [];

  return rows.slice(1).map((row) => ({
    id: row[0] || '',
    agentName: row[1] || '',
    agentPhone: row[2] || '',
    agentEmail: row[3] || '',
    listingAddress: row[4] || '',
    squareFootage: parseInt(row[5] || '0', 10) || 0,
    serviceType: row[6] || '',
    baseDuration: parseInt(row[7] || '0', 10) || 0,
    adjustedDuration: parseInt(row[8] || '0', 10) || 0,
    timing: row[9] || '',
    dateRangeStart: row[10] || '',
    dateRangeEnd: row[11] || '',
    notes: row[12] || '',
    addedBy: row[13] || '',
    source: row[14] || '',
    dateAdded: row[15] || '',
    status: row[16] || '',
    notificationsSent: parseInt(row[17] || '0', 10),
    lastNotified: row[18] || '',
  }));
}

async function getEntryById(waitlistId) {
  const entries = await getActiveWaitlistEntries();
  return entries.find((e) => e.id === waitlistId) || null;
}

async function updateEntryStatus(waitlistId, status) {
  const sheets = await getSheets();
  const spreadsheetId = getSheetId();

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'Active Waitlist!A:A',
  });

  const rows = res.data.values || [];
  let rowIndex = -1;
  for (let i = 0; i < rows.length; i++) {
    if (rows[i][0] === waitlistId) {
      rowIndex = i + 1;
      break;
    }
  }

  if (rowIndex === -1) throw new Error(`Waitlist entry ${waitlistId} not found`);

  // Status is column Q (index 17 -> col 17)
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `Active Waitlist!Q${rowIndex}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[status]] },
  });
}

async function updateNotificationInfo(waitlistId) {
  const sheets = await getSheets();
  const spreadsheetId = getSheetId();

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'Active Waitlist!A:S',
  });

  const rows = res.data.values || [];
  let rowIndex = -1;
  for (let i = 0; i < rows.length; i++) {
    if (rows[i][0] === waitlistId) {
      rowIndex = i + 1;
      break;
    }
  }

  if (rowIndex === -1) return;

  const currentCount = parseInt(rows[rowIndex - 1][17] || '0', 10);

  // R:S = Notifications Sent + Last Notified
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `Active Waitlist!R${rowIndex}:S${rowIndex}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[currentCount + 1, now()]] },
  });
}

async function checkDuplicateEntry(phone, listingAddress) {
  const entries = await getActiveWaitlistEntries();
  return entries.find(
    (e) => e.agentPhone === phone && e.listingAddress === listingAddress && e.status === 'Active'
  ) || null;
}

// ============================================================
// Cancellation Log CRUD
// ============================================================

async function addCancellationLogEntry(event) {
  const sheets = await getSheets();
  const spreadsheetId = getSheetId();
  const eventId = await getNextId(sheets, spreadsheetId, 'Cancellation Log', 'EV', 'A');

  const row = [
    eventId,                              // A: Event ID
    event.shootDate || '',                // B: Shoot Date
    event.shootTime || '',                // C: Shoot Time
    event.duration || '',                 // D: Duration (min)
    event.cancelledBy || '',              // E: Cancelled By
    now(),                                // F: Received At
    'Open',                               // G: Status
    '',                                   // H: Filled By
    event.agentsNotified || 0,            // I: Agents Notified
    event.agentsSkipped || 0,             // J: Agents Skipped
    '',                                   // K: Claimed By
    '',                                   // L: Claimed At
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: 'Cancellation Log!A:L',
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [row] },
  });

  return eventId;
}

async function updateCancellationStatus(eventId, status, filledBy) {
  const sheets = await getSheets();
  const spreadsheetId = getSheetId();

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'Cancellation Log!A:A',
  });

  const rows = res.data.values || [];
  let rowIndex = -1;
  for (let i = 0; i < rows.length; i++) {
    if (rows[i][0] === eventId) {
      rowIndex = i + 1;
      break;
    }
  }

  if (rowIndex === -1) return;

  // Update G:H (Status + Filled By)
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `Cancellation Log!G${rowIndex}:H${rowIndex}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[status, filledBy || '']] },
  });

  // If claimed, also update K:L (Claimed By + Claimed At)
  if (status === 'Claimed' && filledBy) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `Cancellation Log!K${rowIndex}:L${rowIndex}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[filledBy, now()]] },
    });
  }
}

async function updateCancellationCounts(eventId, notified, skipped) {
  const sheets = await getSheets();
  const spreadsheetId = getSheetId();

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'Cancellation Log!A:A',
  });

  const rows = res.data.values || [];
  let rowIndex = -1;
  for (let i = 0; i < rows.length; i++) {
    if (rows[i][0] === eventId) {
      rowIndex = i + 1;
      break;
    }
  }

  if (rowIndex === -1) return;

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `Cancellation Log!I${rowIndex}:J${rowIndex}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[notified, skipped]] },
  });
}

async function getOpenCancellations() {
  const sheets = await getSheets();
  const spreadsheetId = getSheetId();

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'Cancellation Log!A:L',
  });

  const rows = res.data.values || [];
  if (rows.length <= 1) return [];

  return rows.slice(1)
    .map((row) => ({
      eventId: row[0] || '',
      shootDate: row[1] || '',
      shootTime: row[2] || '',
      duration: parseInt(row[3] || '0', 10),
      cancelledBy: row[4] || '',
      receivedAt: row[5] || '',
      status: row[6] || '',
      filledBy: row[7] || '',
      agentsNotified: parseInt(row[8] || '0', 10),
      agentsSkipped: parseInt(row[9] || '0', 10),
      claimedBy: row[10] || '',
      claimedAt: row[11] || '',
    }))
    .filter((e) => e.status === 'Open');
}

// ============================================================
// Claim Log CRUD
// ============================================================

async function addClaimLogEntry(claim) {
  const sheets = await getSheets();
  const spreadsheetId = getSheetId();
  const claimId = await getNextId(sheets, spreadsheetId, 'Claim Log', 'CL', 'A');

  const row = [
    claimId,                              // A: Claim ID
    claim.waitlistId,                     // B: Waitlist ID
    claim.eventId || '',                  // C: Event ID
    claim.agentName,                      // D: Agent Name
    claim.agentPhone || '',               // E: Agent Phone
    claim.service || '',                  // F: Service
    claim.duration || '',                 // G: Duration
    claim.listingAddress || '',           // H: Listing Address
    claim.sqFt || '',                     // I: Sq Ft
    now(),                                // J: Claimed At
    'No',                                 // K: Booked in Spiro
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: 'Claim Log!A:K',
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [row] },
  });

  return claimId;
}

module.exports = {
  ensureSheetSetup,
  addWaitlistEntry,
  getActiveWaitlistEntries,
  getEntryById,
  updateEntryStatus,
  updateNotificationInfo,
  checkDuplicateEntry,
  addCancellationLogEntry,
  updateCancellationStatus,
  updateCancellationCounts,
  getOpenCancellations,
  addClaimLogEntry,
};
