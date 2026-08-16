import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";

import { loadCanonicalManifest } from "../src/domain/canonical/manifest.ts";
import { validateReviewedHltvPlayerStats } from "../src/domain/external-data/reviewed-player-stats.ts";
import { cliArgs } from "./cli-args.ts";

const args = parseArgs({
  args: cliArgs(),
  options: {
    file: { type: "string" },
    manifest: { type: "string" },
    output: { type: "string" },
  },
  strict: true,
}).values;

const sourceFile = path.resolve(args.file ?? "data/reviewed-sources/hltv-player-stats-local.json");
const manifestFile = path.resolve(args.manifest ?? "data/canonical/2026-beta.json");
const outputFile = path.resolve(
  args.output ?? "data/reviewed-sources/hltv-player-stats-preview.html",
);

const bundle = validateReviewedHltvPlayerStats(JSON.parse(await readFile(sourceFile, "utf8")));
const manifest = await loadCanonicalManifest(manifestFile);
const players = new Map(
  manifest.teams.flatMap((team) =>
    team.players.map((player) => [
      player.hltvIdentity.externalId,
      { nickname: player.nickname, slug: player.slug, team: team.name },
    ]),
  ),
);

const rows = bundle.records
  .map((record) => {
    const player = players.get(record.externalId);
    return {
      adr: record.adr,
      career: record.career,
      firepower: record.firepower,
      majorsWon: record.majorsWon,
      maps: record.recent?.maps ?? null,
      mvpCount: record.mvpCount,
      nickname: player?.nickname ?? record.externalSlug,
      profileUrl: `https://www.hltv.org/player/${record.externalId}/${record.externalSlug}`,
      rating: record.recent?.rating ?? null,
      slug: player?.slug ?? record.externalSlug,
      team: player?.team ?? "—",
    };
  })
  .sort((left, right) => (right.rating ?? -1) - (left.rating ?? -1));

const escape = (value: string) =>
  value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

const missing = (value: string | number | null) =>
  value === null ? '<span class="missing">—</span>' : String(value);

const html = `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <title>HLTV 选手资料预览</title>
    <style>
      body { font: 15px/1.45 system-ui, sans-serif; margin: 24px; color: #111; }
      table { border-collapse: collapse; width: 100%; }
      th, td { border-bottom: 1px solid #ddd; padding: 8px 10px; text-align: left; }
      th { position: sticky; top: 0; background: #fff; }
      .num { text-align: right; font-variant-numeric: tabular-nums; }
      .missing { color: #888; }
    </style>
  </head>
  <body>
    <h1>HLTV 选手资料预览</h1>
    <p>周期 ${escape(bundle.periodStart)} → ${escape(bundle.periodEnd)}，采集 ${escape(bundle.capturedAt)}。生涯 Rating 与 ADR 仅在官方页实际暴露时填写。本地选手页：<code>/player/{slug}</code></p>
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>选手</th>
          <th>战队</th>
          <th class="num">Rating 3.0</th>
          <th class="num">Firepower</th>
          <th class="num">Maps</th>
          <th class="num">Major</th>
          <th class="num">MVP</th>
          <th class="num">ADR</th>
          <th class="num">Career</th>
          <th>HLTV</th>
        </tr>
      </thead>
      <tbody>
        ${rows
          .map((row, index) => {
            const rating =
              row.rating === null ? '<span class="missing">—</span>' : row.rating.toFixed(2);
            const career =
              row.career === null
                ? '<span class="missing">—</span>'
                : row.career.rating.toFixed(2);
            return `<tr>
          <td class="num">${index + 1}</td>
          <td><a href="http://localhost:3000/player/${encodeURIComponent(row.slug)}">${escape(row.nickname)}</a></td>
          <td>${escape(row.team)}</td>
          <td class="num">${rating}</td>
          <td class="num">${missing(row.firepower)}</td>
          <td class="num">${missing(row.maps)}</td>
          <td class="num">${missing(row.majorsWon)}</td>
          <td class="num">${missing(row.mvpCount)}</td>
          <td class="num">${missing(row.adr)}</td>
          <td class="num">${career}</td>
          <td><a href="${escape(row.profileUrl)}" target="_blank" rel="noreferrer">profile</a></td>
        </tr>`;
          })
          .join("\n")}
      </tbody>
    </table>
  </body>
</html>
`;

await writeFile(outputFile, html);
process.stdout.write(`${JSON.stringify({ file: outputFile, players: rows.length })}\n`);
