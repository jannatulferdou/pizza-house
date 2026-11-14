// One-time codemod: put presentation text behind the locale subscription without changing DOM structure.
import ts from "typescript";
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { resolve, relative, dirname } from "node:path";
const files = [];
function walk(dir) { for (const item of readdirSync(dir, { withFileTypes: true })) { const path = resolve(dir, item.name); if (item.isDirectory()) walk(path); else if (path.endsWith(".tsx") && !path.endsWith("PizzaScene.tsx")) files.push(path); } }
walk("src/modules"); walk("src/components");
for (const file of files) {
  const original = readFileSync(file, "utf8");
  if (original.includes('import { T }')) {
    writeFileSync(file, original.replace(/<T>(\{"(?:[^"\\]|\\.)*"\})<\/T>/g, "<T space>$1</T>"));
    continue;
  }
  const source = ts.createSourceFile(file, original, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let count = 0;
  const wrap = (expr) => ts.factory.createJsxElement(ts.factory.createJsxOpeningElement(ts.factory.createIdentifier("T"), undefined, ts.factory.createJsxAttributes([])), [ts.factory.createJsxExpression(undefined, expr)], ts.factory.createJsxClosingElement(ts.factory.createIdentifier("T")));
  const result = ts.transform(source, [context => {
    const visitor = node => {
      if (ts.isJsxText(node)) {
        const text = node.getText(source).replace(/\s+/g, " ").trim();
        if (text && /[a-zA-Z]/.test(text)) { count++; return wrap(ts.factory.createStringLiteral(text)); }
      }
      if (ts.isJsxExpression(node) && node.expression && node.parent && (ts.isJsxElement(node.parent) || ts.isJsxFragment(node.parent))) {
        const expr = ts.visitNode(node.expression, visitor);
        count++; return wrap(expr);
      }
      return ts.visitEachChild(node, visitor, context);
    };
    return root => ts.visitNode(root, visitor);
  }]);
  if (count) {
    let path = relative(dirname(file), resolve("src/app/Locale")).replaceAll("\\", "/"); if (!path.startsWith(".")) path = "./" + path;
    writeFileSync(file, `import { T } from ${JSON.stringify(path)};\n` + ts.createPrinter().printFile(result.transformed[0]));
  }
  result.dispose();
}
console.log(`Localized ${files.length} UI files.`);
