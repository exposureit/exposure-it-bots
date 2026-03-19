import { google } from "googleapis";

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets.readonly"];
const CACHE_TTL = 60_000; // 60 seconds

const USE_DEMO = !process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY;

const DEMO_AGENTS: string[][] = [
  ["Agent Email", "Agent Name", "Agent Phone", "Agent ID (Spiro)", "Total Points", "Current Tier", "Total Shoots", "Points Redeemed", "Available Balance", "Referral Code", "Member Since", "Portal Link"],
  ["ava@realtyhub.com", "Ava Martinez", "(407) 555-1234", "SP-10421", "1820", "Insider", "12", "750", "1070", "EI-AVA620", "Jan 2024", ""],
  ["demo@exposureit.com", "Jordan Blake", "(321) 555-9876", "SP-20587", "3450", "Pro", "18", "2000", "1450", "EI-JBL310", "Sep 2023", ""],
];

const DEMO_ORDERS: string[][] = [
  ["Agent Email", "Agent Name", "Agent Phone", "Agent ID", "Order ID", "Services Ordered", "Invoice Amount", "Points This Order", "Credit Used", "Status", "Date Ordered", "Date Paid", "Referral Order?", "Notes"],
  ["demo@exposureit.com", "Jordan Blake", "(321) 555-9876", "SP-20587", "EI-4821", "Pro Photo Package + Drone", "$429.00", "429", "$0", "Paid", "3/12/2026", "3/14/2026", "No", ""],
  ["demo@exposureit.com", "Jordan Blake", "(321) 555-9876", "SP-20587", "EI-4650", "Zillow 3D Tour + Floor Plan", "$249.99", "250", "$0", "Paid", "2/18/2026", "2/20/2026", "No", ""],
  ["demo@exposureit.com", "Jordan Blake", "(321) 555-9876", "SP-20587", "EI-4512", "Pro Photo Package", "$279.99", "280", "$0", "Paid", "1/22/2026", "1/24/2026", "No", ""],
  ["demo@exposureit.com", "Jordan Blake", "(321) 555-9876", "SP-20587", "EI-4300", "Referral Bonus — Ava Martinez", "$0", "500", "$0", "Paid", "1/10/2026", "1/10/2026", "Yes", "Referral bonus"],
  ["demo@exposureit.com", "Jordan Blake", "(321) 555-9876", "SP-20587", "EI-4201", "Pro Photo Package + Twilight", "$389.00", "389", "$50", "Paid", "12/15/2025", "12/18/2025", "No", ""],
  ["demo@exposureit.com", "Jordan Blake", "(321) 555-9876", "SP-20587", "EI-4099", "Google Review Bonus", "$0", "200", "$0", "Paid", "12/1/2025", "12/1/2025", "No", "One-time bonus"],
  ["demo@exposureit.com", "Jordan Blake", "(321) 555-9876", "SP-20587", "EI-3955", "Drone + Video Walkthrough", "$549.00", "549", "$0", "Paid", "11/8/2025", "11/12/2025", "No", ""],
  ["demo@exposureit.com", "Jordan Blake", "(321) 555-9876", "SP-20587", "EI-5010", "Pro Photo Package + Drone", "$429.00", "429", "$0", "Pending", "3/18/2026", "", "No", "Awaiting payment"],
  ["ava@realtyhub.com", "Ava Martinez", "(407) 555-1234", "SP-10421", "EI-4820", "Pro Photo Package", "$279.99", "280", "$0", "Paid", "3/10/2026", "3/12/2026", "No", ""],
  ["ava@realtyhub.com", "Ava Martinez", "(407) 555-1234", "SP-10421", "EI-4610", "Pro Photo Package + Drone", "$429.00", "429", "$0", "Paid", "2/14/2026", "2/16/2026", "No", ""],
  ["ava@realtyhub.com", "Ava Martinez", "(407) 555-1234", "SP-10421", "EI-4400", "Zillow 3D Tour", "$124.99", "125", "$0", "Paid", "1/28/2026", "1/30/2026", "No", ""],
];

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
  if (USE_DEMO) {
    return { agentSummary: DEMO_AGENTS, orderLog: DEMO_ORDERS };
  }

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
