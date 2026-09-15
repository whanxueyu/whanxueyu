import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const owner = process.env.PROFILE_OWNER || "whanxueyu";
const outputFile = process.env.OUTPUT_FILE || "images/repo-showcase.svg";
const githubApi = process.env.GITHUB_API_URL || "https://api.github.com";
const token = process.env.GITHUB_TOKEN || "";
const pinnedRepos = (process.env.PINNED_REPOS || "demo-collection,cyberpunk-ui,axy-cesium")
  .split(",")
  .map((name) => name.trim())
  .filter(Boolean);

const headers = {
  Accept: "application/vnd.github+json",
  "User-Agent": "whanxueyu-profile-stats",
  "X-GitHub-Api-Version": "2022-11-28",
};

if (token) {
  headers.Authorization = `Bearer ${token}`;
}

const LANGUAGE_COLORS = {
  JavaScript: "#F1E05A",
  TypeScript: "#3178C6",
  Vue: "#41B883",
  CSS: "#563D7C",
  HTML: "#E34C26",
  Shell: "#89E051",
  Python: "#3572A5",
  Go: "#00ADD8",
  Java: "#B07219",
  Rust: "#DEA584",
  "C++": "#F34B7D",
  C: "#555555",
  PHP: "#4F5D95",
};

const ROW_ACCENTS = ["#5EEAD4", "#FACC15", "#FB7185"];

const HEIGHT = 770;
const ROW_START = 226;
const ROW_HEIGHT = 156;
const ROW_GAP = 14;

async function getJson(url) {
  const response = await fetch(url, { headers });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`GitHub API request failed: ${response.status} ${message}`);
  }

  return response.json();
}

async function getPinnedRepos() {
  const repos = [];

  for (const name of pinnedRepos) {
    try {
      repos.push(await getJson(`${githubApi}/repos/${owner}/${name}`));
    } catch (error) {
      console.warn(`Skipping ${owner}/${name}: ${error.message}`);
    }
  }

  return repos;
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function formatCount(value) {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function truncate(value, maxLength) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 1)}…`;
}

function relativeUpdate(iso) {
  if (!iso) {
    return "never updated";
  }

  const days = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));

  if (days < 1) {
    return "updated today";
  }
  if (days < 30) {
    return `updated ${days}d ago`;
  }
  if (days < 365) {
    return `updated ${Math.floor(days / 30)}mo ago`;
  }

  return `updated ${(days / 365).toFixed(1)}y ago`;
}

/**
 * A 0-100 repo score blended from GitHub metrics:
 *   stars (50%) · forks (20%) · watchers (10%) · push recency (20%).
 * Each count metric is log-scaled so one outlier cannot dominate.
 */
function computeScore(repo) {
  const logPart = (value, cap) => Math.log10(value + 1) / Math.log10(cap + 1);

  const stars = logPart(repo.stargazers_count, 300);
  const forks = logPart(repo.forks_count, 100);
  const watchers = logPart(repo.watchers_count || 0, 60);
  const ageDays = repo.pushed_at
    ? Math.max(0, (Date.now() - new Date(repo.pushed_at).getTime()) / 86_400_000)
    : Number.POSITIVE_INFINITY;
  const activity =
    ageDays <= 30 ? 1 : ageDays <= 90 ? 0.85 : ageDays <= 180 ? 0.6 : ageDays <= 365 ? 0.35 : 0.15;

  const score = Math.round(100 * (0.5 * stars + 0.2 * forks + 0.1 * watchers + 0.2 * activity));

  return Math.min(100, Math.max(1, score));
}

function ratingStars(score) {
  const value = score / 20;
  const full = Math.floor(value);
  const remainder = value - full;
  const roundUp = remainder >= 0.75;

  return {
    fullCount: Math.min(5, full + (roundUp ? 1 : 0)),
    halfCount: roundUp || remainder < 0.25 ? 0 : 1,
  };
}

function renderRatingStars(score, y) {
  const { fullCount, halfCount } = ratingStars(score);
  const gap = 30;
  let svg = "";

  for (let i = 0; i < 5; i += 1) {
    const transform = `translate(${1119 - i * gap} ${y})`;

    if (i < fullCount) {
      svg += `<use href="#star" transform="${transform}" fill="url(#starFill)"/>`;
    } else if (i === fullCount && halfCount) {
      svg += `<use href="#star" transform="${transform}" fill="#141E30" stroke="#475569" stroke-width="1.4"/>`;
      svg += `<g transform="${transform}" clip-path="url(#halfClip)"><use href="#star" fill="url(#starFill)"/></g>`;
    } else {
      svg += `<use href="#star" transform="${transform}" fill="#141E30" stroke="#475569" stroke-width="1.4"/>`;
    }
  }

  return svg;
}

function renderRepoRow(repo, index, rowY) {
  const accent = ROW_ACCENTS[index % ROW_ACCENTS.length];
  const score = computeScore(repo);
  const name = escapeXml(repo.name);
  const description = escapeXml(truncate(repo.description || "A project by whanxueyu.", 55));
  const language = repo.language || "Other";
  const languageColor = LANGUAGE_COLORS[language] || "#8B949E";
  const updated = relativeUpdate(repo.pushed_at);

  return `
    <rect x="56" y="${rowY}" width="1088" height="${ROW_HEIGHT}" rx="14" fill="#0D1526" stroke="#1F2C44"/>
    <rect x="76" y="${rowY + 56}" width="3" height="44" rx="1.5" fill="${accent}"/>
    <text x="92" y="${rowY + 84}" text-anchor="middle" font-family="Consolas, Menlo, monospace" font-size="15" font-weight="700" fill="${accent}">0${index + 1}</text>

    <text x="122" y="${rowY + 50}" font-family="Segoe UI, Arial, sans-serif" font-size="22" font-weight="800" fill="#F1F5F9">${name}</text>
    <text x="122" y="${rowY + 82}" font-family="Segoe UI, Arial, sans-serif" font-size="15.5" fill="#94A3B8">${description}</text>

    <circle cx="124" cy="${rowY + 112.5}" r="5" fill="${languageColor}"/>
    <text x="136" y="${rowY + 117}" font-family="Segoe UI, Arial, sans-serif" font-size="14" font-weight="600" fill="#CBD5E1">${escapeXml(language)}</text>
    <text x="232" y="${rowY + 117}" font-family="Segoe UI, Arial, sans-serif" font-size="14" fill="#334155">·</text>
    <use href="#star" transform="translate(256 ${rowY + 112.5}) scale(0.6)" fill="#FACC15"/>
    <text x="276" y="${rowY + 117}" font-family="Segoe UI, Arial, sans-serif" font-size="14" fill="#CBD5E1">${formatCount(repo.stargazers_count)}</text>
    <text x="318" y="${rowY + 117}" font-family="Segoe UI, Arial, sans-serif" font-size="14" fill="#334155">·</text>
    <g transform="translate(340 ${rowY + 112.5})" fill="none" stroke="#94A3B8" stroke-width="1.6">
      <circle cx="-5" cy="-6" r="2.6"/>
      <circle cx="-5" cy="7" r="2.6"/>
      <circle cx="6.5" cy="-4" r="2.6"/>
      <path d="M-5 -3.4 V 4.4 M-5 0.5 C -1.5 0.5 3 -0.5 3.9 -2.9" stroke-linecap="round"/>
    </g>
    <text x="360" y="${rowY + 117}" font-family="Segoe UI, Arial, sans-serif" font-size="14" fill="#CBD5E1">${formatCount(repo.forks_count)}</text>
    <text x="404" y="${rowY + 117}" font-family="Segoe UI, Arial, sans-serif" font-size="14" fill="#334155">·</text>
    <text x="424" y="${rowY + 117}" font-family="Segoe UI, Arial, sans-serif" font-size="14" fill="#64748B">${escapeXml(updated)}</text>

    <text x="1130" y="${rowY + 50}" text-anchor="end" font-family="Consolas, Menlo, monospace" font-size="10.5" font-weight="700" letter-spacing="2" fill="#64748B">REPO SCORE</text>
    ${renderRatingStars(score, rowY + 78)}
    <text x="1130" y="${rowY + 122}" text-anchor="end" font-family="Segoe UI, Arial, sans-serif">
      <tspan font-size="30" font-weight="800" fill="#F8FAFC">${score}</tspan><tspan font-size="14" font-weight="600" fill="#64748B">/100</tspan>
    </text>
  `;
}

function renderSvg(repos) {
  const totalStars = repos.reduce((total, repo) => total + repo.stargazers_count, 0);
  const totalForks = repos.reduce((total, repo) => total + repo.forks_count, 0);
  const scores = repos.map(computeScore);
  const avgScore = scores.length
    ? Math.round(scores.reduce((total, score) => total + score, 0) / scores.length)
    : 0;
  const generated = new Date().toISOString().slice(0, 10);
  const names = escapeXml(repos.map((repo) => repo.name).join(", "));
  const rows = repos
    .map((repo, index) => renderRepoRow(repo, index, ROW_START + index * (ROW_HEIGHT + ROW_GAP)))
    .join("");

  return `\
<svg width="1200" height="${HEIGHT}" viewBox="0 0 1200 ${HEIGHT}" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="title desc">
  <title id="title">Repository showcase for ${escapeXml(owner)}</title>
  <desc id="desc">Stars, forks and a locally computed score for ${names}. Only these pinned repositories are counted.</desc>
  <defs>
    <linearGradient id="panel" x1="56" y1="24" x2="1144" y2="746" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#0B1220"/>
      <stop offset="0.6" stop-color="#0E1830"/>
      <stop offset="1" stop-color="#0A1120"/>
    </linearGradient>
    <linearGradient id="accent" x1="56" y1="0" x2="1144" y2="0" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#5EEAD4"/>
      <stop offset="0.48" stop-color="#FACC15"/>
      <stop offset="1" stop-color="#FB7185"/>
    </linearGradient>
    <linearGradient id="starFill" x1="0" y1="-11" x2="0" y2="11" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#FDE68A"/>
      <stop offset="1" stop-color="#F59E0B"/>
    </linearGradient>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="16" stdDeviation="16" flood-color="#020617" flood-opacity="0.3"/>
    </filter>
    <g id="star">
      <path d="M0,-10.5 L2.47,-3.40 L9.99,-3.24 L3.99,1.30 L6.17,8.49 L0,4.20 L-6.17,8.49 L-3.99,1.30 L-9.99,-3.24 L-2.47,-3.40 Z"/>
    </g>
    <clipPath id="halfClip"><rect x="-11" y="-12" width="11" height="24"/></clipPath>
    <style>
      .title { fill: #F8FAFC; font: 800 26px "Segoe UI", Arial, sans-serif; }
      .sub { fill: #64748B; font: 600 13px Consolas, Menlo, monospace; }
      .pill-label { fill: #64748B; font: 700 12px "Segoe UI", Arial, sans-serif; letter-spacing: 2px; }
      .pill-value { fill: #F1F5F9; font: 800 28px "Segoe UI", Arial, sans-serif; }
      .footer { fill: #475569; font: 600 12px Consolas, Menlo, monospace; }
    </style>
  </defs>

  <rect x="0" y="0" width="1200" height="${HEIGHT}" rx="20" fill="#020617"/>
  <g filter="url(#shadow)">
    <rect x="56" y="24" width="1088" height="726" rx="18" fill="url(#panel)" stroke="#2A3A52"/>
  </g>
  <rect x="20" y="0" width="1160" height="3" rx="1.5" fill="url(#accent)" opacity="0.85"/>

  <text x="84" y="72" class="title">Featured Repositories</text>
  <text x="1130" y="68" text-anchor="end" class="sub">3 pinned repos · score = stars · forks · watchers · activity</text>

  <g transform="translate(84 104)">
    <rect width="324" height="86" rx="14" fill="#0E1830" stroke="#233049"/>
    <text x="22" y="32" class="pill-label">TOTAL STARS</text>
    <text x="22" y="66" class="pill-value">${formatCount(totalStars)}</text>
    <use href="#star" transform="translate(290 44) scale(0.9)" fill="url(#starFill)"/>
  </g>
  <g transform="translate(428 104)">
    <rect width="324" height="86" rx="14" fill="#0E1830" stroke="#233049"/>
    <text x="22" y="32" class="pill-label">TOTAL FORKS</text>
    <text x="22" y="66" class="pill-value">${formatCount(totalForks)}</text>
    <g transform="translate(292 44)" fill="none" stroke="#94A3B8" stroke-width="1.8">
      <circle cx="-5" cy="-6" r="2.8"/>
      <circle cx="-5" cy="7" r="2.8"/>
      <circle cx="6.5" cy="-4" r="2.8"/>
      <path d="M-5 -3.2 V 4.2 M-5 0.5 C -1.5 0.5 3 -0.6 3.8 -2.8" stroke-linecap="round"/>
    </g>
  </g>
  <g transform="translate(772 104)">
    <rect width="324" height="86" rx="14" fill="#0E1830" stroke="#233049"/>
    <text x="22" y="32" class="pill-label">AVG SCORE</text>
    <text x="22" y="66" class="pill-value">${avgScore}<tspan font-size="14" font-weight="600" fill="#64748B">/100</tspan></text>
    <use href="#star" transform="translate(290 44) scale(0.9)" fill="none" stroke="#64748B" stroke-width="1.6"/>
  </g>

  <line x1="84" y1="210" x2="1116" y2="210" stroke="#1E293B"/>

  ${rows}

  <text x="600" y="748" text-anchor="middle" class="footer">generated ${generated} · scripts/update-repo-stats.mjs · GitHub Actions daily</text>
</svg>
`;
}

const repos = await getPinnedRepos();
const svg = renderSvg(repos);

await mkdir(dirname(outputFile), { recursive: true });
await writeFile(outputFile, svg, "utf8");

const totalStars = repos.reduce((total, repo) => total + repo.stargazers_count, 0);
const totalForks = repos.reduce((total, repo) => total + repo.forks_count, 0);

console.log(
  `Updated ${outputFile}: ${repos.length} pinned repos, ${totalStars} stars, ${totalForks} forks.`
);
