/**
 * i18n-check — lists every user-visible English string in src/app that has no
 * Hindi/Marathi translation yet in src/app/lib/locales/auto/{hi,mr}.json.
 *
 * Run after adding or changing screens:
 *   npm i -g typescript@5 && TS_PATH=$(npm root -g)/typescript node scripts/i18n-check.cjs
 * Then add the reported strings (with translations) to both JSON files.
 * Brand names, bank/card names and codes can be left untranslated.
 */
let ts;
try { ts = require(process.env.TS_PATH || "typescript"); if (!ts.createSourceFile) throw 0; } catch { console.error("Needs the TypeScript 5 compiler API. Run: TS_PATH=$(npm root -g)/typescript node scripts/i18n-check.cjs  (after: npm i -g typescript@5)"); process.exit(1); }
const fs = require("fs"), path = require("path");
const root = path.join(__dirname, "..", "src", "app");
const files = [];
(function walk(d) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); const st = fs.statSync(p);
  if (st.isDirectory()) { if (["locales", "admin", "ui", "figma"].includes(f)) continue; walk(p); }
  else if (/\.(tsx?|ts)$/.test(f) && !f.endsWith(".d.ts") && !/(PrivacyPolicy|TermsConditions|Landing|Auth|aiPrompts|newsService|merchantDictionary|merchantNormalize|voiceLangs|taxEngine|demo|figma|seed|verify|crypto|fieldCrypto|googleAuth|googleDrive|webauthn|offlineQueue|nativeStorage|localCache|localDb|durableStore|api|track|ocr|aiPrivacy)\.tsx?$/.test(f)) files.push(p); } })(root);
const exact = new Map(), templates = new Map();
const skipAttr = new Set(["className", "style", "key", "id", "type", "href", "src", "inputMode", "role", "accept", "capture", "name", "value", "d", "viewBox", "fill", "stroke", "strokeLinecap", "strokeLinejoin", "dataKey", "stopColor", "to", "path", "variant", "size", "mode", "autoComplete", "rel", "target", "method", "align", "side", "orientation", "x1","x2","y1","y2","offset","layout","animationDuration","stackId"]);
const looksText = (s) => {
  s = s.trim();
  if (s.length < 2 || s.length > 400) return false;
  if (!/[A-Za-z]{2}/.test(s)) return false;
  if (/^[a-z0-9_.:/#@-]+$/.test(s) && !/\s/.test(s) && !/^[A-Z]/.test(s)) return false; // keys, ids, classes
  if (/^(https?:|\/|#|data:|\.\/|\.\.\/)/.test(s)) return false;
  if (/\b(flex|grid|px-|py-|text-(xs|sm|lg)|bg-|rounded|border|items-center|justify-|gap-|w-full|h-full|size-\d)\b/.test(s)) return false;
  if (/^[A-Z_]+$/.test(s) && s.length > 3 && s.includes("_")) return false;
  if (/^(GET|POST|DELETE|PUT|application\/json|utf-8)$/i.test(s)) return false;
  if (/^[\w-]+\.(png|svg|jpg|js|ts|tsx|json|wav|mp3|css|gz)$/.test(s)) return false;
  if (/^[a-z]+[A-Z][A-Za-z]+$/.test(s)) return false; // camelCase identifiers
  if (/console|import\(|=>|\(\)|\{\}|;$/.test(s)) return false;
  return true;
};
const add = (s, file) => { const t = s.replace(/\s+/g, " ").trim(); if (looksText(t)) { if (!exact.has(t)) exact.set(t, new Set()); exact.get(t).add(path.relative(root, file)); } };
for (const file of files) {
  const src = ts.createSourceFile(file, fs.readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const visit = (n) => {
    if (ts.isImportDeclaration(n) || ts.isExportDeclaration(n)) return;
    if (ts.isCallExpression(n)) {
      const callee = n.expression.getText(src);
      if (/^(console\.|require|import|localStorage|sessionStorage|document\.|window\.|new RegExp|RegExp|.*\.test|.*\.match|.*\.replace|.*\.split|.*\.startsWith|.*\.endsWith|.*\.includes|.*\.getItem|.*\.setItem|.*\.removeItem|.*addEventListener|.*removeEventListener|.*dispatchEvent|api\.|navigate|go|t|useState|saveToCache|loadFromCache|localList|localUpsert|.*querySelector|.*getElementById|setParameters|createElement)$/.test(callee)) {
        // still descend into callbacks but skip literal args
        n.arguments.forEach((a) => { if (!ts.isStringLiteral(a) && !ts.isNoSubstitutionTemplateLiteral(a)) visit(a); });
        visit(n.expression); return;
      }
    }
    if (ts.isJsxAttribute(n)) { const nm = n.name.getText(src); if (skipAttr.has(nm) || /^on[A-Z]|^aria-(hidden|checked|expanded|controls|live)|^data-/.test(nm)) return; }
    if (ts.isPropertyAssignment(n)) { const nm = n.name.getText(src).replace(/["']/g, ""); if (/^(id|key|icon|color|tint|bg|border|path|screen|kind|type|className|cls|dot|code|script|tone|severity|status|source|category|value|href|ring|amountColor|sign|gradientFrom|gradientTo|fill|stroke|dataKey|mode|rx|cat|unit|currency|locale|channelId|sound)$/.test(nm) && (ts.isStringLiteral(n.initializer) || ts.isNoSubstitutionTemplateLiteral(n.initializer))) return; }
    if (ts.isJsxText(n)) add(n.getText(src), file);
    else if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) {
      const p = n.parent;
      if (p && (ts.isElementAccessExpression(p) || ts.isLiteralTypeNode(p) || ts.isCaseClause(p) || ts.isBinaryExpression(p) && /===|!==|==|!=/.test(p.operatorToken.getText(src)))) {} else add(n.text, file);
    } else if (ts.isTemplateExpression(n)) {
      let pat = n.head.text; let i = 0;
      for (const sp of n.templateSpans) { pat += `{${i++}}` + sp.literal.text; }
      const t = pat.replace(/\s+/g, " ").trim();
      if (looksText(t.replace(/\{\d\}/g, "")) && /[A-Za-z]{3}/.test(t.replace(/\{\d\}/g, ""))) { if (!templates.has(t)) templates.set(t, new Set()); templates.get(t).add(path.relative(root, file)); }
    }
    ts.forEachChild(n, visit);
  };
  visit(src);
}
const bad = (t) => (/(failed|error|failure)[^a-z]*:?\s*$/i.test(t) && /:\s*$/.test(t)) || /\b(dark|hover|md|lg):|-\d{3}\b/.test(t) || /^[A-Z]{2,4}$/.test(t) || /^[\d\s₹%.,:+\-()\/x×]+$/.test(t);
const dicts = ["hi", "mr"].map((c) => JSON.parse(fs.readFileSync(path.join(root, "lib", "locales", "auto", `${c}.json`), "utf8")));
let missing = 0;
for (const [str, where] of exact) {
  if (bad(str)) continue;
  const miss = ["hi", "mr"].filter((c, i) => !(str in dicts[i].exact));
  if (miss.length) { missing++; console.log(`MISSING [${miss.join(",")}] ${JSON.stringify(str)}  ← ${[...where][0]}`); }
}
for (const [tpl, where] of templates) {
  const miss = ["hi", "mr"].filter((c, i) => !dicts[i].templates.some((x) => x[0] === tpl));
  if (miss.length) { missing++; console.log(`MISSING TEMPLATE [${miss.join(",")}] ${JSON.stringify(tpl)}  ← ${[...where][0]}`); }
}
console.log(`\n${exact.size} strings, ${templates.size} patterns scanned · ${missing} without translation (brand names are expected here).`);
