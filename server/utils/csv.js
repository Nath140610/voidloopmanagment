const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");
const CONNECTION_WORKBOOK = path.join(DATA_DIR, "connection_workbook.csv");

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function csvEscape(value) {
  if (value === null || value === undefined) {
    return "";
  }

  const stringValue = String(value);
  const escaped = stringValue.replace(/"/g, "\"\"");
  return `"${escaped}"`;
}

function rowsToCsv(headers, rows) {
  const headerLine = headers.map(csvEscape).join(",");
  const body = rows
    .map((row) => headers.map((header) => csvEscape(row[header])).join(","))
    .join("\n");

  return `${headerLine}\n${body}`;
}

function appendConnectionWorkbook({ pseudo, ipAddress, connectedAt }) {
  ensureDataDir();
  const dateObject = new Date(connectedAt || Date.now());
  const date = dateObject.toLocaleDateString("fr-FR");
  const time = dateObject.toLocaleTimeString("fr-FR");

  if (!fs.existsSync(CONNECTION_WORKBOOK)) {
    fs.writeFileSync(CONNECTION_WORKBOOK, "pseudo,date,heure,ip\n", "utf8");
  }

  const line = `${csvEscape(pseudo)},${csvEscape(date)},${csvEscape(time)},${csvEscape(ipAddress)}\n`;
  fs.appendFileSync(CONNECTION_WORKBOOK, line, "utf8");
}

module.exports = {
  rowsToCsv,
  appendConnectionWorkbook,
  DATA_DIR,
  CONNECTION_WORKBOOK
};
