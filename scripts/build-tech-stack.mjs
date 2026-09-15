import { readFile, writeFile } from "node:fs/promises";

// Composes images/tech-stack.svg from the individual icon files in images/.
// Re-run after adding, removing or reordering entries below.

const ICONS = [
  { file: "images/vue.svg", label: "Vue" },
  { file: "images/JavaScript.svg", label: "JavaScript" },
  { file: "images/typescript.svg", label: "TypeScript" },
  { file: "images/nodejs.svg", label: "Node.js" },
  { file: "images/webgl.svg", label: "WebGL" },
  { file: "images/cesium.svg", label: "Cesium" },
  { file: "images/html5.svg", label: "HTML5" },
  { file: "images/css.svg", label: "CSS" },
  { file: "images/sass.svg", label: "Sass" },
  { file: "images/git.svg", label: "Git" },
  { file: "images/vscode.svg", label: "VS Code" },
  { file: "images/WebGIS.svg", label: "WebGIS" },
];

const COLS = 6;
const TILE_W = 160;
const TILE_H = 88;
const GAP = 14;
const X0 = 85;
const Y0 = 92;
const ICON_SCALE = 0.033;

function extractPaths(svgText) {
  const out = [];

  for (const match of svgText.matchAll(/<path\b([^>]*?)\/?>/g)) {
    const attrs = match[1];
    const d = attrs.match(/\bd="([^"]+)"/)?.[1];
    if (!d) {
      continue;
    }
    const fill = attrs.match(/\bfill="([^"]+)"/)?.[1] || "#94A3B8";
    out.push(`<path d="${d}" fill="${fill}"/>`);
  }

  return out.join("\n");
}

async function renderTile({ file, label }, index) {
  const paths = extractPaths(await readFile(file, "utf8"));
  const col = index % COLS;
  const row = Math.floor(index / COLS);
  const x = X0 + col * (TILE_W + GAP);
  const y = Y0 + row * (TILE_H + GAP);

  return `\
    <g transform="translate(${x} ${y})">
      <rect width="${TILE_W}" height="${TILE_H}" rx="12" fill="#0D1526" stroke="#1F2C44"/>
      <g transform="translate(${TILE_W / 2} ${30}) scale(${ICON_SCALE}) translate(-512 -512)">
${paths}
      </g>
      <text x="${TILE_W / 2}" y="${TILE_H - 18}" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="13.5" font-weight="600" fill="#CBD5E1">${label}</text>
    </g>`;
}

const tiles = [];
for (const [index, icon] of ICONS.entries()) {
  tiles.push(await renderTile(icon, index));
}

const CARD_Y = 24;
const TILE_BOTTOM = Y0 + Math.ceil(ICONS.length / COLS) * TILE_H + (Math.ceil(ICONS.length / COLS) - 1) * GAP;
const CARD_H = TILE_BOTTOM + 26 - CARD_Y;
const HEIGHT = CARD_Y + CARD_H + 18;

const svg = `\
<svg width="1200" height="${HEIGHT}" viewBox="0 0 1200 ${HEIGHT}" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="title desc">
  <title id="title">Tech stack</title>
  <desc id="desc">Tools and languages used by whanxueyu.</desc>
  <defs>
    <linearGradient id="panel" x1="56" y1="24" x2="1144" y2="${HEIGHT - 24}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#0B1220"/>
      <stop offset="0.6" stop-color="#0E1830"/>
      <stop offset="1" stop-color="#0A1120"/>
    </linearGradient>
    <linearGradient id="accent" x1="56" y1="0" x2="1144" y2="0" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#5EEAD4"/>
      <stop offset="0.48" stop-color="#FACC15"/>
      <stop offset="1" stop-color="#FB7185"/>
    </linearGradient>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="16" stdDeviation="16" flood-color="#020617" flood-opacity="0.3"/>
    </filter>
    <style>
      .title { fill: #F8FAFC; font: 800 26px "Segoe UI", Arial, sans-serif; }
      .sub { fill: #64748B; font: 600 13px Consolas, Menlo, monospace; }
    </style>
  </defs>

  <rect x="0" y="0" width="1200" height="${HEIGHT}" rx="20" fill="#020617"/>
  <g filter="url(#shadow)">
    <rect x="56" y="${CARD_Y}" width="1088" height="${CARD_H}" rx="18" fill="url(#panel)" stroke="#2A3A52"/>
  </g>
  <rect x="20" y="0" width="1160" height="3" rx="1.5" fill="url(#accent)" opacity="0.85"/>

  <text x="84" y="72" class="title">技术栈 · Tech Stack</text>
  <text x="1130" y="68" text-anchor="end" class="sub">tools I use daily</text>

${tiles.join("\n")}
</svg>
`;

await writeFile("images/tech-stack.svg", svg, "utf8");
console.log(`Wrote images/tech-stack.svg (${HEIGHT}px tall, ${ICONS.length} tiles).`);
