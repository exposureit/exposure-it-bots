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

  // Bold + freeze header rows
  const updated = await sheets.spreadsheets.get({ spreadsheetId });
  const formatRequests = [];
  for (const sheet of updated.data.sheets) {
    if (['Active Waitlist', 'Claim Log'].includes(sheet.properties.title)) {
      formatRequests.push({
        repeatCell: {
          range: { sheetId: sheet.properties.sheetId, startRowIndex: 0, endRowIndex: 1 },
          cell: {
            userEnteredFormat: {
              textFormat: { bold: true },
              backgroundColor: { red: 0.9, green: 0.9, blue: 0.9 },
            },
          },
          fields: 'userEnteredFormat(textFormat,backgroundColor)',
        },
      });
      formatRequests.push({
        updateSheetProperties: {
          properties: {
            sheetId: sheet.properties.sheetId,
            gridProperties: { frozenRowCount: 1 },
          },
          fields: 'gridProperties.frozenRowCount',
        },
      });
    }
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
