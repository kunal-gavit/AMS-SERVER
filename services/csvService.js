const escapeValue = (value) => {
  if (value === null || value === undefined) return "";
  const str = String(value).replace(/"/g, '""');
  if (str.includes(",") || str.includes("\n") || str.includes("\r") || str.includes('"')) {
    return `"${str}"`;
  }
  return str;
};

export const toCsv = (rows, headers) => {
  const headerLine = headers.map((header) => escapeValue(header.label)).join(",");
  const lines = rows.map((row) => headers.map((header) => escapeValue(row[header.key])).join(","));
  return [headerLine, ...lines].join("\n");
};
