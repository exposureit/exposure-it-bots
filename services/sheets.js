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
  const id = process.env.GOOGLE_SHEET_ID;
  if (!id) throw new Error('GOOGLE_SHEET_ID not configured');
  return id;
}

const WAITLIST_HEADERS = [
  'ID', 'Agent Name', 'Agent Phone', 'Agent Email', 'Service Type', 'Area',
  'Date Preference', 'Date Range Start', 'Date Range End', 'Notes',
  'Added By', 'Date Added', 'Status', 'Notifications Sent', 'Last Notified',
];

const CLAIM_LOG_HEADERS = [
  'Claim ID', 'Waitlist ID', 'Agent Name', 'Cancelled Shoot Date',
  'Cancelled Shoot Time', 'Service Type', 'Area', 'Claimed At', 'Booked in Spiro',
];

// Column widths for Active Waitlist (A-O)
const WAITLIST_COL_WIDTHS = [
  80,   // A: ID
  160,  // B: Agent Name
  130,  // C: Agent Phone
  220,  // D: Agent Email
  120,  // E: Service Type
  110,  // F: Area
  160,  // G: Date Preference
  130,  // H: Date Range Start
  130,  // I: Date Range End
  220,  // J: Notes
  110,  // K: Added By
  180,  // L: Date Added
  100,  // M: Status
  140,  // N: Notifications Sent
  180,  // O: Last Notified
];

// Column widths for Claim Log (A-I)
const CLAIM_COL_WIDTHS = [
  90,   // A: Claim ID
  100,  // B: Waitlist ID
  160,  // C: Agent Name
  160,  // D: Cancelled Shoot Date
  150,  // E: Cancelled Shoot Time
  120,  // F: Service Type
  110,  // G: Area
  180,  // H: Claimed At
  130,  // I: Booked in Spiro
];

// Brand colors
const COLORS = {
  headerBg: { red: 0.145, green: 0.145, blue: 0.145 },       // dark charcoal
  headerText: { red: 1, green: 1, blue: 1 },                   // white
  activeGreen: { red: 0.85, green: 0.95, blue: 0.85 },         // light green
  claimedBlue: { red: 0.85, green: 0.91, blue: 0.98 },         // light blue
  expiredRed: { red: 0.98, green: 0.87, blue: 0.87 },          // light red
  altRow: { red: 0.96, green: 0.96, blue: 0.96 },              // subtle grey stripe
  white: { red: 1, green: 1, blue: 1 },
};

// Auto-provision tabs and headers on first startup
async function ensureSheetSetup() {
  if (sheetReady) return;

  const sheets = await getSheets();
  const spreadsheetId = getSheetId();
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
  const existingTabs = spreadsheet.data.sheets.map((s) => s.properties.title);

  const addRequests = [];
  if (!existingTabs.includes('Active Waitlist')) {
    addRequests.push({ addSheet: { properties: { title: 'Active Waitlist' } } });
  }
  if (!existingTabs.includes('Claim Log')) {
    addRequests.push({ addSheet: { properties: { title: 'Claim Log' } } });
  }

  if (addRequests.length > 0) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: addRequests },
    });
    console.log('Created missing sheet tabs:', addRequests.map((r) => r.addSheet.properties.title).join(', '));
  }

  // Write headers if row 1 is empty
  const waitlistHeader = await sheets.spreadsheets.values.get({
    spreadsheetId, range: 'Active Waitlist!A1:O1',
  });
  if (!waitlistHeader.data.values || waitlistHeader.data.values.length === 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId, range: 'Active Waitlist!A1:O1',
      valueInputOption: 'RAW',
      requestBody: { values: [WAITLIST_HEADERS] },
    });
    console.log('Wrote Active Waitlist headers.');
  }

  const claimHeader = await sheets.spreadsheets.values.get({
    spreadsheetId, range: 'Claim Log!A1:I1',
  });
  if (!claimHeader.data.values || claimHeader.data.values.length === 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId, range: 'Claim Log!A1:I1',
      valueInputOption: 'RAW',
      requestBody: { values: [CLAIM_LOG_HEADERS] },
    });
    console.log('Wrote Claim Log headers.');
  }

  // Get sheet IDs for formatting
  const updated = await sheets.spreadsheets.get({ spreadsheetId });
  const sheetMap = {};
  for (const sheet of updated.data.sheets) {
    sheetMap[sheet.properties.title] = sheet.properties.sheetId;
  }

  const formatRequests = [];

  // --- Active Waitlist formatting ---
  const wlId = sheetMap['Active Waitlist'];
  if (wlId !== undefined) {
    // Header style: dark background, white bold text, centered
    formatRequests.push({
      repeatCell: {
        range: { sheetId: wlId, startRowIndex: 0, endRowIndex: 1 },
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
        properties: {
          sheetId: wlId,
          gridProperties: { frozenRowCount: 1 },
        },
        fields: 'gridProperties.frozenRowCount',
      },
    });

    // Column widths
    WAITLIST_COL_WIDTHS.forEach((width, i) => {
      formatRequests.push({
        updateDimensionProperties: {
          range: { sheetId: wlId, dimension: 'COLUMNS', startIndex: i, endIndex: i + 1 },
          properties: { pixelSize: width },
          fields: 'pixelSize',
        },
      });
    });

    // Data validation: Service Type dropdown (column E, rows 2-500)
    formatRequests.push({
      setDataValidation: {
        range: { sheetId: wlId, startRowIndex: 1, endRowIndex: 500, startColumnIndex: 4, endColumnIndex: 5 },
        rule: {
          condition: {
            type: 'ONE_OF_LIST',
            values: [
              { userEnteredValue: 'Photo' },
              { userEnteredValue: 'Video' },
              { userEnteredValue: 'Drone' },
              { userEnteredValue: '3D' },
              { userEnteredValue: 'Combo' },
              { userEnteredValue: 'Any' },
            ],
          },
          showCustomUi: true,
          strict: false,
        },
      },
    });

    // Data validation: Area dropdown (column F, rows 2-500)
    formatRequests.push({
      setDataValidation: {
        range: { sheetId: wlId, startRowIndex: 1, endRowIndex: 500, startColumnIndex: 5, endColumnIndex: 6 },
        rule: {
          condition: {
            type: 'ONE_OF_LIST',
            values: [
              { userEnteredValue: 'Pittsburgh' },
              { userEnteredValue: 'Erie' },
              { userEnteredValue: 'Either' },
            ],
          },
          showCustomUi: true,
          strict: false,
        },
      },
    });

    // Data validation: Date Preference dropdown (column G, rows 2-500)
    formatRequests.push({
      setDataValidation: {
        range: { sheetId: wlId, startRowIndex: 1, endRowIndex: 500, startColumnIndex: 6, endColumnIndex: 7 },
        rule: {
          condition: {
            type: 'ONE_OF_LIST',
            values: [
              { userEnteredValue: 'ASAP/Next Available' },
              { userEnteredValue: 'Specific Date Range' },
              { userEnteredValue: 'Flexible' },
            ],
          },
          showCustomUi: true,
          strict: false,
        },
      },
    });

    // Data validation: Status dropdown (column M, rows 2-500)
    formatRequests.push({
      setDataValidation: {
        range: { sheetId: wlId, startRowIndex: 1, endRowIndex: 500, startColumnIndex: 12, endColumnIndex: 13 },
        rule: {
          condition: {
            type: 'ONE_OF_LIST',
            values: [
              { userEnteredValue: 'Active' },
              { userEnteredValue: 'Claimed' },
              { userEnteredValue: 'Expired' },
              { userEnteredValue: 'Removed' },
            ],
          },
          showCustomUi: true,
          strict: false,
        },
      },
    });

    // Conditional formatting: "Active" rows → green
    formatRequests.push({
      addConditionalFormatRule: {
        rule: {
          ranges: [{ sheetId: wlId, startRowIndex: 1, endRowIndex: 500 }],
          booleanRule: {
            condition: {
              type: 'CUSTOM_FORMULA',
              values: [{ userEnteredValue: '=$M2="Active"' }],
            },
            format: { backgroundColor: COLORS.activeGreen },
          },
        },
        index: 0,
      },
    });

    // Conditional formatting: "Claimed" rows → blue
    formatRequests.push({
      addConditionalFormatRule: {
        rule: {
          ranges: [{ sheetId: wlId, startRowIndex: 1, endRowIndex: 500 }],
          booleanRule: {
            condition: {
              type: 'CUSTOM_FORMULA',
              values: [{ userEnteredValue: '=$M2="Claimed"' }],
            },
            format: { backgroundColor: COLORS.claimedBlue },
          },
        },
        index: 1,
      },
    });

    // Conditional formatting: "Expired" or "Removed" rows → red
    formatRequests.push({
      addConditionalFormatRule: {
        rule: {
          ranges: [{ sheetId: wlId, startRowIndex: 1, endRowIndex: 500 }],
          booleanRule: {
            condition: {
              type: 'CUSTOM_FORMULA',
              values: [{ userEnteredValue: '=OR($M2="Expired",$M2="Removed")' }],
            },
            format: { backgroundColor: COLORS.expiredRed },
          },
        },
        index: 2,
      },
    });

    // Center-align ID, Status, Notifications Sent columns
    [0, 12, 13].forEach((col) => {
      formatRequests.push({
        repeatCell: {
          range: { sheetId: wlId, startRowIndex: 1, endRowIndex: 500, startColumnIndex: col, endColumnIndex: col + 1 },
          cell: {
            userEnteredFormat: { horizontalAlignment: 'CENTER' },
          },
          fields: 'userEnteredFormat.horizontalAlignment',
        },
      });
    });
  }

  // --- Claim Log formatting ---
  const clId = sheetMap['Claim Log'];
  if (clId !== undefined) {
    // Header style
    formatRequests.push({
      repeatCell: {
        range: { sheetId: clId, startRowIndex: 0, endRowIndex: 1 },
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
        properties: {
          sheetId: clId,
          gridProperties: { frozenRowCount: 1 },
        },
        fields: 'gridProperties.frozenRowCount',
      },
    });

    // Column widths
    CLAIM_COL_WIDTHS.forEach((width, i) => {
      formatRequests.push({
        updateDimensionProperties: {
          range: { sheetId: clId, dimension: 'COLUMNS', startIndex: i, endIndex: i + 1 },
          properties: { pixelSize: width },
          fields: 'pixelSize',
        },
      });
    });

    // Data validation: Booked in Spiro dropdown (column I, rows 2-500)
    formatRequests.push({
      setDataValidation: {
        range: { sheetId: clId, startRowIndex: 1, endRowIndex: 500, startColumnIndex: 8, endColumnIndex: 9 },
        rule: {
          condition: {
            type: 'ONE_OF_LIST',
            values: [
              { userEnteredValue: 'Yes' },
              { userEnteredValue: 'No' },
            ],
          },
          showCustomUi: true,
          strict: true,
        },
      },
    });

    // Conditional formatting: "Yes" in Booked in Spiro → green row
    formatRequests.push({
      addConditionalFormatRule: {
        rule: {
          ranges: [{ sheetId: clId, startRowIndex: 1, endRowIndex: 500 }],
          booleanRule: {
            condition: {
              type: 'CUSTOM_FORMULA',
              values: [{ userEnteredValue: '=$I2="Yes"' }],
            },
            format: { backgroundColor: COLORS.activeGreen },
          },
        },
        index: 0,
      },
    });

    // Conditional formatting: "No" in Booked in Spiro → light red row
    formatRequests.push({
      addConditionalFormatRule: {
        rule: {
          ranges: [{ sheetId: clId, startRowIndex: 1, endRowIndex: 500 }],
          booleanRule: {
            condition: {
              type: 'CUSTOM_FORMULA',
              values: [{ userEnteredValue: '=$I2="No"' }],
            },
            format: { backgroundColor: COLORS.expiredRed },
          },
        },
        index: 1,
      },
    });

    // Center-align ID columns and Booked in Spiro
    [0, 1, 8].forEach((col) => {
      formatRequests.push({
        repeatCell: {
          range: { sheetId: clId, startRowIndex: 1, endRowIndex: 500, startColumnIndex: col, endColumnIndex: col + 1 },
          cell: {
            userEnteredFormat: { horizontalAlignment: 'CENTER' },
          },
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
  console.log('Google Sheet verified and ready.');
}

// Generate next waitlist ID based on existing rows
async function getNextWaitlistId(sheets, spreadsheetId) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'Active Waitlist!A:A',
  });
  const rows = res.data.values || [];
  // Skip header row, find max ID
  let maxNum = 0;
  for (let i = 1; i < rows.length; i++) {
    const match = (rows[i][0] || '').match(/^WL-(\d+)$/);
    if (match) {
      maxNum = Math.max(maxNum, parseInt(match[1], 10));
    }
  }
  return `WL-${String(maxNum + 1).padStart(3, '0')}`;
}

async function addWaitlistEntry(entry) {
  const sheets = await getSheets();
  const spreadsheetId = getSheetId();
  const id = await getNextWaitlistId(sheets, spreadsheetId);

  const row = [
    id,                                   // A: ID
    entry.agentName,                      // B: Agent Name
    entry.agentPhone,                     // C: Agent Phone
    entry.agentEmail,                     // D: Agent Email
    entry.serviceType,                    // E: Service Type
    entry.area,                           // F: Area
    entry.datePreference,                 // G: Date Preference
    entry.dateRangeStart || '',           // H: Date Range Start
    entry.dateRangeEnd || '',             // I: Date Range End
    entry.notes || '',                    // J: Notes
    entry.addedBy || 'Carley',            // K: Added By
    new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }), // L: Date Added
    'Active',                             // M: Status
    0,                                    // N: Notifications Sent
    '',                                   // O: Last Notified
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: 'Active Waitlist!A:O',
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
    range: 'Active Waitlist!A:O',
  });

  const rows = res.data.values || [];
  if (rows.length <= 1) return []; // Only header or empty

  return rows.slice(1).map((row) => ({
    id: row[0] || '',
    agentName: row[1] || '',
    agentPhone: row[2] || '',
    agentEmail: row[3] || '',
    serviceType: row[4] || '',
    area: row[5] || '',
    datePreference: row[6] || '',
    dateRangeStart: row[7] || '',
    dateRangeEnd: row[8] || '',
    notes: row[9] || '',
    addedBy: row[10] || '',
    dateAdded: row[11] || '',
    status: row[12] || '',
    notificationsSent: parseInt(row[13] || '0', 10),
    lastNotified: row[14] || '',
  }));
}

async function updateEntryStatus(waitlistId, status) {
  const sheets = await getSheets();
  const spreadsheetId = getSheetId();

  // Find the row number for this waitlist ID
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'Active Waitlist!A:A',
  });

  const rows = res.data.values || [];
  let rowIndex = -1;
  for (let i = 0; i < rows.length; i++) {
    if (rows[i][0] === waitlistId) {
      rowIndex = i + 1; // 1-based for Sheets API
      break;
    }
  }

  if (rowIndex === -1) throw new Error(`Waitlist entry ${waitlistId} not found`);

  // Update Status column (M = column 13)
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `Active Waitlist!M${rowIndex}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[status]] },
  });
}

async function updateNotificationInfo(waitlistId) {
  const sheets = await getSheets();
  const spreadsheetId = getSheetId();

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'Active Waitlist!A:O',
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

  const currentCount = parseInt(rows[rowIndex - 1][13] || '0', 10);
  const now = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `Active Waitlist!N${rowIndex}:O${rowIndex}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[currentCount + 1, now]] },
  });
}

async function addClaimLogEntry(claim) {
  const sheets = await getSheets();
  const spreadsheetId = getSheetId();

  // Generate claim ID
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'Claim Log!A:A',
  });
  const rows = res.data.values || [];
  const claimNum = Math.max(0, rows.length - 1) + 1;
  const claimId = `CL-${String(claimNum).padStart(3, '0')}`;

  const row = [
    claimId,                              // A: Claim ID
    claim.waitlistId,                     // B: Waitlist ID
    claim.agentName,                      // C: Agent Name
    claim.cancelledDate,                  // D: Cancelled Shoot Date
    claim.cancelledTime,                  // E: Cancelled Shoot Time
    claim.serviceType,                    // F: Service Type
    claim.area,                           // G: Area
    new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }), // H: Claimed At
    'No',                                 // I: Booked in Spiro
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: 'Claim Log!A:I',
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [row] },
  });

  return claimId;
}

async function checkDuplicatePhone(phone) {
  const entries = await getActiveWaitlistEntries();
  return entries.find((e) => e.agentPhone === phone && e.status === 'Active') || null;
}

module.exports = {
  ensureSheetSetup,
  addWaitlistEntry,
  getActiveWaitlistEntries,
  updateEntryStatus,
  updateNotificationInfo,
  addClaimLogEntry,
  checkDuplicatePhone,
};
