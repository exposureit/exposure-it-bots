import { google } from "googleapis";

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets.readonly"];
const CACHE_TTL = 60_000; // 60 seconds

let cachedData: {
  agentSummary: string[][] | null;
  orderLog: string[][] | null;
  timestamp: number;
} = {
  agentSummary: null,
  orderLog: null,
  timestamp: 0,
};

function getAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!;
  const key = process.env.GOOGLE_PRIVATE_KEY!.replace(/\\n/g, "\n");

  return new google.auth.JWT({
    email,
    key,
    scopes: SCOPES,
  });
}

async function fetchSheetData(): Promise<{
  agentSummary: string[][];
  orderLog: string[][];
}> {
  const now = Date.now();

  if (
    cachedData.agentSummary &&
    cachedData.orderLog &&
    now - cachedData.timestamp < CACHE_TTL
  ) {
    return {
      agentSummary: cachedData.agentSummary,
      orderLog: cachedData.orderLog,
    };
  }

  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });
  const spreadsheetId = process.env.GOOGLE_SHEET_ID!;

  const res = await sheets.spreadsheets.values.batchGet({
    spreadsheetId,
    ranges: ["Agent Summary", "Order Log"],
  });

  const valueRanges = res.data.valueRanges || [];
  const agentSummary = (valueRanges[0]?.values as string[][]) || [];
  const orderLog = (valueRanges[1]?.values as string[][]) || [];

  cachedData = { agentSummary, orderLog, timestamp: Date.now() };

  return { agentSummary, orderLog };
}

export async function getAgentByEmail(email: string) {
  const { agentSummary } = await fetchSheetData();

  // Skip header row (index 0), find matching row
  const row = agentSummary
    .slice(1)
    .find(
      (r) => r[0] && r[0].toLowerCase() === email.toLowerCase()
    );

  if (!row) return null;

  return {
    email: row[0] || "",
    name: row[1] || "",
    phone: row[2] || "",
    agentId: row[3] || "",
    totalPoints: Number(row[4]) || 0,
    currentTier: row[5] || "",
    totalShoots: Number(row[6]) || 0,
    pointsRedeemed: Number(row[7]) || 0,
    availableBalance: Number(row[8]) || 0,
    referralCode: row[9] || "",
    memberSince: row[10] || "",
    portalLink: row[11] || "",
  };
}

export async function getOrdersByEmail(email: string) {
  const { orderLog } = await fetchSheetData();

  // Skip header row (index 0), filter matching rows
  const rows = orderLog
    .slice(1)
    .filter(
      (r) => r[0] && r[0].toLowerCase() === email.toLowerCase()
    );

  const orders = rows.map((row) => ({
    email: row[0] || "",
    name: row[1] || "",
    phone: row[2] || "",
    agentId: row[3] || "",
    orderId: row[4] || "",
    servicesOrdered: row[5] || "",
    invoiceAmount: row[6] || "",
    pointsThisOrder: Number(row[7]) || 0,
    creditUsed: row[8] || "",
    status: row[9] || "",
    dateOrdered: row[10] || "",
    datePaid: row[11] || "",
    referralOrder: row[12] || "",
    notes: row[13] || "",
  }));

  // Sort by datePaid descending (newest first)
  orders.sort((a, b) => {
    if (!a.datePaid && !b.datePaid) return 0;
    if (!a.datePaid) return 1;
    if (!b.datePaid) return -1;
    return new Date(b.datePaid).getTime() - new Date(a.datePaid).getTime();
  });

  return orders;
}
