/**
 * One-time setup script to create the "Active Waitlist" and "Claim Log" tabs
 * with the correct headers in your Google Sheet.
 *
 * Usage:
 *   1. Set GOOGLE_SERVICE_ACCOUNT_KEY and GOOGLE_SHEET_ID in your .env
 *   2. Share the spreadsheet with your service account email
 *   3. Run: node scripts/setup-sheet.js
 */

require('dotenv/config');
const { google } = require('googleapis');

const SHEET_ID = process.env.GOOGLE_SHEET_ID;

const WAITLIST_HEADERS = [
  'ID',
  'Agent Name',
  'Agent Phone',
  'Agent Email',
  'Service Type',
  'Area',
  'Date Preference',
  'Date Range Start',
  'Date Range End',
  'Notes',
  'Added By',
  'Date Added',
  'Status',
  'Notifications Sent',
  'Last Notified',
];

const CLAIM_LOG_HEADERS = [
  'Claim ID',
  'Waitlist ID',
  'Agent Name',
  'Cancelled Shoot Date',
  'Cancelled Shoot Time',
  'Service Type',
  'Area',
  'Claimed At',
  'Booked in Spiro',
];

async function main() {
  if (!SHEET_ID) {
    console.error('Error: GOOGLE_SHEET_ID is not set in .env');
    process.exit(1);
  }

  const key = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!key) {
    console.error('Error: GOOGLE_SERVICE_ACCOUNT_KEY is not set in .env');
    process.exit(1);
  }

  const credentials = JSON.parse(key);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth });

  // Get existing sheet info
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
  const existingSheets = spreadsheet.data.sheets.map((s) => s.properties.title);

  console.log('Existing tabs:', existingSheets.join(', '));

  const requests = [];

  // Create "Active Waitlist" tab if it doesn't exist
  if (!existingSheets.includes('Active Waitlist')) {
    requests.push({
      addSheet: { properties: { title: 'Active Waitlist' } },
    });
    console.log('Will create: Active Waitlist');
  } else {
    console.log('Already exists: Active Waitlist');
  }

  // Create "Claim Log" tab if it doesn't exist
  if (!existingSheets.includes('Claim Log')) {
    requests.push({
      addSheet: { properties: { title: 'Claim Log' } },
    });
    console.log('Will create: Claim Log');
  } else {
    console.log('Already exists: Claim Log');
  }

  // Execute tab creation
  if (requests.length > 0) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: { requests },
    });
    console.log('Tabs created.');
  }

  // Write headers to Active Waitlist
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: 'Active Waitlist!A1:O1',
    valueInputOption: 'RAW',
    requestBody: { values: [WAITLIST_HEADERS] },
  });
  console.log('Active Waitlist headers written.');

  // Write headers to Claim Log
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: 'Claim Log!A1:I1',
    valueInputOption: 'RAW',
    requestBody: { values: [CLAIM_LOG_HEADERS] },
  });
  console.log('Claim Log headers written.');

  // Bold the header rows
  const updatedSpreadsheet = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
  const formatRequests = [];

  for (const sheet of updatedSpreadsheet.data.sheets) {
    if (['Active Waitlist', 'Claim Log'].includes(sheet.properties.title)) {
      formatRequests.push({
        repeatCell: {
          range: {
            sheetId: sheet.properties.sheetId,
            startRowIndex: 0,
            endRowIndex: 1,
          },
          cell: {
            userEnteredFormat: {
              textFormat: { bold: true },
              backgroundColor: { red: 0.9, green: 0.9, blue: 0.9 },
            },
          },
          fields: 'userEnteredFormat(textFormat,backgroundColor)',
        },
      });

      // Freeze header row
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
      spreadsheetId: SHEET_ID,
      requestBody: { requests: formatRequests },
    });
    console.log('Headers formatted (bold, gray background, frozen).');
  }

  console.log('\nDone! Your spreadsheet is ready.');
}

main().catch((err) => {
  console.error('Setup failed:', err.message);
  process.exit(1);
});
