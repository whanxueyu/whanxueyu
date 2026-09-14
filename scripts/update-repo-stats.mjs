import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const owner = process.env.PROFILE_OWNER || "whanxueyu";
const outputFile = process.env.OUTPUT_FILE || "images/repo-stars.svg";
const includeForks = process.env.INCLUDE_FORKS === "true";
const githubApi = process.env.GITHUB_API_URL || "https://api.github.com";
const token = process.env.GITHUB_TOKEN || "";

const headers = {
  Accept: "application/vnd.github+json",
  "User-Agent": "whanxueyu-profile-stats",
  "X-GitHub-Api-Version": "2022-11-28",
};

if (token) {
  headers.Authorization = `Bearer ${token}`;
}

async function getJson(url) {
  const response = await fetch(url, { headers });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`GitHub API request failed: ${response.status} ${message}`);
  }

  return response.json();
}

async function getRepos() {
  const repos = [];

  for (let page = 1; ; page += 1) {
    const url = `${githubApi}/users/${owner}/repos?per_page=100&page=${page}&sort=updated`;
    const data = await getJson(url);
    repos.push(...data);

    if (data.length < 100) {
      break;
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

function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(value);
}

function pluralize(value, word) {
  return `${formatNumber(value)} ${word}${value === 1 ? "" : "s"}`;
}

function truncate(value, maxLength) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 1)}...`;
}

function getLanguageSummary(repos) {
  const counts = new Map();

  for (const repo of repos) {
    if (!repo.language) {
      continue;
    }

    counts.set(repo.language, (counts.get(repo.language) || 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 3)
    .map(([language]) => language)
    .join(" / ") || "Mixed";
}

function renderTopRepoRows(repos) {
  const maxStars = Math.max(1, ...repos.map((repo) => repo.stargazers_count));

  if (repos.length === 0) {
    return `
      <text x="66" y="214" class="row-name">No public repositories yet</text>
      <rect x="390" y="200" width="350" height="10" rx="5" class="bar-bg"/>
    `;
  }

  return repos
    .map((repo, index) => {
      const y = 288 + index * 26;
      const barWidth = repo.stargazers_count
        ? Math.max(6, Math.round((repo.stargazers_count / maxStars) * 350))
        : 0;
      const name = escapeXml(truncate(repo.name, 24));

      return `
        <text x="66" y="${y}" class="row-name">${index + 1}. ${name}</text>
        <rect x="390" y="${y - 11}" width="350" height="10" rx="5" class="bar-bg"/>
        <rect x="390" y="${y - 11}" width="${barWidth}" height="10" rx="5" class="bar-fill"/>
        <text x="762" y="${y}" class="row-count">${pluralize(repo.stargazers_count, "star")}</text>
        <text x="890" y="${y}" class="row-count">${pluralize(repo.forks_count, "fork")}</text>
      `;
    })
    .join("");
}

function renderSvg({ repos, measuredRepos }) {
  const totalStars = measuredRepos.reduce((total, repo) => total + repo.stargazers_count, 0);
  const totalForks = measuredRepos.reduce((total, repo) => total + repo.forks_count, 0);
  const topRepos = [...measuredRepos]
    .sort((a, b) => b.stargazers_count - a.stargazers_count || b.forks_count - a.forks_count || a.name.localeCompare(b.name))
    .slice(0, 5);
  const languages = getLanguageSummary(measuredRepos);
  const scopeLabel = includeForks ? "All public repositories" : "Original public repositories";

  return `\
<svg width="1200" height="430" viewBox="0 0 1200 430" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="title desc">
  <title id="title">Repository stars overview for ${escapeXml(owner)}</title>
  <desc id="desc">${escapeXml(scopeLabel)} generated from GitHub public repository data.</desc>
  <defs>
    <linearGradient id="card" x1="48" y1="34" x2="1152" y2="326" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#0F172A"/>
      <stop offset="0.55" stop-color="#172554"/>
      <stop offset="1" stop-color="#111827"/>
    </linearGradient>
    <linearGradient id="line" x1="0" y1="0" x2="350" y2="0" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#5EEAD4"/>
      <stop offset="0.52" stop-color="#FACC15"/>
      <stop offset="1" stop-color="#FB7185"/>
    </linearGradient>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="18" stdDeviation="18" flood-color="#020617" flood-opacity="0.26"/>
    </filter>
    <style>
      .label { fill: #94A3B8; font: 600 15px Arial, sans-serif; letter-spacing: 0; }
      .title { fill: #F8FAFC; font: 800 32px Arial, sans-serif; letter-spacing: 0; }
      .value { fill: #F8FAFC; font: 800 38px Arial, sans-serif; letter-spacing: 0; }
      .subtle { fill: #CBD5E1; font: 500 16px Arial, sans-serif; letter-spacing: 0; }
      .row-name { fill: #E2E8F0; font: 700 17px Arial, sans-serif; letter-spacing: 0; }
      .row-count { fill: #CBD5E1; font: 600 15px Arial, sans-serif; letter-spacing: 0; }
      .bar-bg { fill: #1E293B; }
      .bar-fill { fill: url(#line); }
      .pill { fill: #0B1220; stroke: #334155; }
    </style>
  </defs>

  <rect x="0" y="0" width="1200" height="430" rx="18" fill="#020617"/>
  <g filter="url(#shadow)">
    <rect x="48" y="34" width="1104" height="362" rx="18" fill="url(#card)" stroke="#334155"/>
  </g>

  <text x="66" y="86" class="title">Repository Star Overview</text>
  <text x="66" y="116" class="subtle">${escapeXml(scopeLabel)} | Source: GitHub API | ${formatNumber(repos.length)} public repos visible</text>

  <g transform="translate(66 142)">
    <rect width="210" height="82" rx="12" class="pill"/>
    <text x="22" y="31" class="label">Total Stars</text>
    <text x="22" y="68" class="value">${formatNumber(totalStars)}</text>
  </g>
  <g transform="translate(296 142)">
    <rect width="210" height="82" rx="12" class="pill"/>
    <text x="22" y="31" class="label">Total Forks</text>
    <text x="22" y="68" class="value">${formatNumber(totalForks)}</text>
  </g>
  <g transform="translate(526 142)">
    <rect width="210" height="82" rx="12" class="pill"/>
    <text x="22" y="31" class="label">Measured Repos</text>
    <text x="22" y="68" class="value">${formatNumber(measuredRepos.length)}</text>
  </g>
  <g transform="translate(756 142)">
    <rect width="330" height="82" rx="12" class="pill"/>
    <text x="22" y="31" class="label">Main Languages</text>
    <text x="22" y="64" class="subtle">${escapeXml(languages)}</text>
  </g>

  <text x="66" y="256" class="label">Top Starred Repositories</text>
  ${renderTopRepoRows(topRepos)}
</svg>
`;
}

const repos = await getRepos();
const measuredRepos = includeForks ? repos : repos.filter((repo) => !repo.fork);
const svg = renderSvg({ repos, measuredRepos });

await mkdir(dirname(outputFile), { recursive: true });
await writeFile(outputFile, svg, "utf8");

const totalStars = measuredRepos.reduce((total, repo) => total + repo.stargazers_count, 0);
const totalForks = measuredRepos.reduce((total, repo) => total + repo.forks_count, 0);

console.log(`Updated ${outputFile}: ${measuredRepos.length} repos, ${totalStars} stars, ${totalForks} forks.`);
