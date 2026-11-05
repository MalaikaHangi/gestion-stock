export function splitStatements(sql) {
  const result = [];
  let current = "",
    quote = null,
    lineComment = false,
    blockComment = false;
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i],
      next = sql[i + 1];
    if (lineComment) {
      if (ch === "\n") {
        lineComment = false;
        current += "\n";
      }
      continue;
    }
    if (blockComment) {
      if (ch === "*" && next === "/") {
        blockComment = false;
        i++;
        current += " ";
      }
      continue;
    }
    if (quote) {
      current += ch;
      if (ch === "\\" && quote !== "`" && next) {
        current += next;
        i++;
      } else if (ch === quote) {
        if (next === quote) {
          current += next;
          i++;
        } else quote = null;
      }
      continue;
    }
    if (ch === "-" && next === "-" && /\s/.test(sql[i + 2] || "")) {
      lineComment = true;
      i++;
      continue;
    }
    if (ch === "#") {
      lineComment = true;
      continue;
    }
    if (ch === "/" && next === "*") {
      blockComment = true;
      i++;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === "`") {
      quote = ch;
      current += ch;
      continue;
    }
    if (ch === ";") {
      if (current.trim()) result.push(current.trim());
      current = "";
    } else current += ch;
  }
  if (quote || blockComment) throw Error("Instruction SQL non terminée");
  if (current.trim()) result.push(current.trim());
  return result;
}
