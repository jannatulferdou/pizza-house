import ts from "typescript";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
const dict = ts.createSourceFile("translations.ts", readFileSync("frontend/src/app/translations.ts", "utf8"), ts.ScriptTarget.Latest, true);
const known = new Set();
function keys(n) { if (ts.isPropertyAssignment(n) && ts.isStringLiteral(n.name)) known.add(n.name.text); ts.forEachChild(n, keys); }
keys(dict);
const missing = new Set();
function walk(dir) { for (const item of readdirSync(dir, { withFileTypes: true })) { const path = resolve(dir, item.name); if (item.isDirectory()) walk(path); else if (path.endsWith(".tsx")) {
  const source = ts.createSourceFile(path, readFileSync(path,"utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  function visit(n) { if (ts.isJsxElement(n) && n.openingElement.tagName.getText(source) === "T") for (const child of n.children) if (ts.isJsxExpression(child) && child.expression && ts.isStringLiteral(child.expression)) { const text = child.expression.text.trim(); if (/[a-zA-Z]/.test(text) && !known.has(text)) missing.add(text); } ts.forEachChild(n, visit); }
  visit(source);
} } }
walk("frontend/src/modules"); walk("frontend/src/components");
console.log(JSON.stringify([...missing].sort(), null, 2));
