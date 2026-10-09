// Lists user-visible English text that is NOT routed through t(): JSX text, text-bearing attributes
// (placeholder, title, aria-label, alt, label) and string arguments to showToast().
// Usage: node scripts/find-hardcoded-strings.mjs [file ...]     (default: every prototype screen)
// Exit code 1 when anything is found, so it can guard files that are meant to be fully translated.
import { Project, SyntaxKind } from "ts-morph";
import path from "node:path";

const ATTRS = new Set(["placeholder", "title", "aria-label", "alt", "label"]);
// Product / standard names that are not translated on purpose.
const BRAND = /^(NutriPalm|NutriPalm AI|Maps JavaScript API|Sentinel-2( NDVI)?|NDVI|WGS-84 \(EPSG:4326\)|VITE_GOOGLE_MAPS_API_KEY:|AIzaSy\.\.\.)$/;
const hasLetters = (s) => /[A-Za-z]{3,}/.test(s) && !BRAND.test(s.trim());
const DISPLAY_PROPS = new Set(["label", "title", "message", "description", "interpretation", "sublabel", "note", "text", "subtitle", "placeholder", "heading"]);

export function scan(files) {
  const project = new Project({ skipAddingFilesFromTsConfig: true });
  const out = [];
  for (const f of files) {
    const sf = project.addSourceFileAtPath(f);
    const add = (node, kind, text) => out.push({ file: path.relative(process.cwd(), f), line: node.getStartLineNumber(), kind, text: text.trim().replace(/\s+/g, " ").slice(0, process.env.FULL ? 1000 : 80) });
    sf.forEachDescendant((n) => {
      if (n.getKind() === SyntaxKind.JsxText) {
        const text = n.getText();
        if (hasLetters(text)) add(n, "text", text);
      } else if (n.getKind() === SyntaxKind.JsxExpression) {
        // {cond ? "text" : "text"} / {a && "text"}: literals reachable through conditionals only
        const walk = (e) => {
          if (!e) return;
          const k = e.getKind();
          if (k === SyntaxKind.StringLiteral || k === SyntaxKind.NoSubstitutionTemplateLiteral) {
            if (hasLetters(e.getLiteralText()) && !e.getLiteralText().includes("{") && /\s|^[A-Z]/.test(e.getLiteralText())) add(e, "cond", e.getLiteralText());
          } else if (k === SyntaxKind.ConditionalExpression) {
            walk(e.getWhenTrue());
            walk(e.getWhenFalse());
          } else if (k === SyntaxKind.ParenthesizedExpression) walk(e.getExpression());
          else if (k === SyntaxKind.BinaryExpression && ["&&", "||", "??"].includes(e.getOperatorToken().getText())) walk(e.getRight());
        };
        if (n.getParent().getKind() !== SyntaxKind.JsxAttribute) walk(n.getExpression()); // attribute values are not display text
      } else if (n.getKind() === SyntaxKind.JsxAttribute) {
        const name = n.getNameNode().getText();
        const init = n.getInitializer();
        if (ATTRS.has(name) && init && init.getKind() === SyntaxKind.StringLiteral && hasLetters(init.getLiteralText())) add(n, `attr:${name}`, init.getLiteralText());
      } else if (n.getKind() === SyntaxKind.PropertyAssignment && process.env.DEEP) {
        const name = n.getNameNode().getText();
        const init = n.getInitializer();
        if (DISPLAY_PROPS.has(name) && init && [SyntaxKind.StringLiteral, SyntaxKind.NoSubstitutionTemplateLiteral].includes(init.getKind()) && hasLetters(init.getLiteralText())) add(n, `prop:${name}`, init.getLiteralText());
      } else if (n.getKind() === SyntaxKind.CallExpression) {
        const callee = n.getExpression().getText();
        if (callee === "showToast" || callee === "notify" || /^set\w*(Error|Message)$/.test(callee)) {
          const a = n.getArguments()[0];
          if (a && [SyntaxKind.StringLiteral, SyntaxKind.NoSubstitutionTemplateLiteral, SyntaxKind.TemplateExpression].includes(a.getKind()) && hasLetters(a.getText().replace(/^["'`]|["'`]$/g, ""))) add(n, "toast", a.getText());
        }
      }
    });
  }
  return out;
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, "/")}` || process.argv[1]?.endsWith("find-hardcoded-strings.mjs")) {
  const args = process.argv.slice(2);
  const files = args.length
    ? args
    : [
        "src/components/PrototypeApp.tsx",
        "src/components/PrototypeAuth.tsx",
        ...[
          "DashboardScreen", "DashboardWeatherCard", "FarmerScreen", "FarmPlotScreen", "SoilReportScreen", "RecommendationScreen",
          "DigitalTwinScreen", "AnalyticsScreen", "SettingsScreen", "NotFoundScreen", "DiseaseScreen", "CropSuitabilityScreen",
          "WeatherAdvisoryScreen", "HistoryScreen", "GoogleMapBoundarySurveyor", "FarmPlotOverviewMap", "LeafletMapPicker", "LoadingSkeletons",
        ].map((n) => `src/components/prototype/${n}.tsx`),
        "src/components/phase2/shared.tsx",
        "src/components/phase2/RecommendationCard.tsx",
      ];
  const found = scan(files);
  const byFile = {};
  for (const r of found) (byFile[r.file] ??= []).push(r);
  for (const [file, rows] of Object.entries(byFile)) {
    console.log(`${String(rows.length).padStart(4)}  ${file}`);
    if (process.env.VERBOSE) rows.forEach((r) => console.log(`        L${r.line} ${r.kind}: ${r.text}`));
  }
  console.log(`TOTAL ${found.length} untranslated literal(s) in ${Object.keys(byFile).length} file(s)`);
  process.exit(found.length ? 1 : 0);
}
