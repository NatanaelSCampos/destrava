import fs from "node:fs";
import path from "node:path";
const origin = "https://frecuencias-a1-natanael.fly.dev";
const repo = "NatanaelSCampos/destrava";
const key = process.env.DESTRAVA_REPORT_BRIDGE_KEY;
const phase = process.argv[2];
if (!key || !["collect", "publish"].includes(phase))
  throw new Error("Report configuration unavailable");
async function bridge(body) {
  const r = await fetch(origin + "/api/reports/bridge", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-report-bridge-key": key },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30000),
  });
  if (!r.ok) throw new Error("Report bridge failed: " + r.status);
  return r.json();
}
const privateFile = ".tmp/report-claims.json";
if (phase === "collect") {
  const claimed = await bridge({ action: "claim" }),
    privateClaims = [];
  fs.mkdirSync(".tmp", { recursive: true });
  fs.mkdirSync("report-evidence", { recursive: true });
  for (const report of claimed.reports ?? []) {
    if (!/^[a-f0-9-]{36}$/i.test(report.id) || report.payload?.consent !== true)
      throw new Error("Invalid report claim");
    const dir = path.join("report-evidence", report.id);
    fs.mkdirSync(dir, { recursive: true });
    const { images, ...payload } = report.payload;
    fs.writeFileSync(
      path.join(dir, "report.json"),
      JSON.stringify({ ...payload, release: report.release, createdAt: report.createdAt }, null, 2),
    );
    for (const [index, image] of (images ?? []).entries())
      fs.writeFileSync(
        path.join(dir, "image-" + (index + 1) + ".jpg"),
        Buffer.from(image.data.slice(23), "base64"),
      );
    fs.copyFileSync("docs/operations/REPORTING_CONTEXT.md", path.join(dir, "PROJECT_CONTEXT.md"));
    privateClaims.push({ id: report.id, claim: report.claim, payload, release: report.release });
  }
  fs.writeFileSync(privateFile, JSON.stringify(privateClaims));
  if (process.env.GITHUB_OUTPUT)
    fs.appendFileSync(
      process.env.GITHUB_OUTPUT,
      "has_reports=" + (privateClaims.length > 0 ? "true" : "false") + "\n",
    );
  console.log(
    JSON.stringify({ claimed: privateClaims.length, privateClaimExcludedFromArtifact: true }),
  );
} else {
  const token = process.env.GITHUB_TOKEN,
    url = process.env.REPORT_ARTIFACT_URL;
  if (
    !token ||
    !url ||
    !/^https:\/\/github\.com\/NatanaelSCampos\/destrava\/actions\/runs\/[0-9]+\/artifacts\/[0-9]+$/.test(
      url,
    )
  )
    throw new Error("Uploaded report artifact missing");
  const headers = {
    Authorization: "Bearer " + token,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2026-03-10",
    "Content-Type": "application/json",
  };
  async function github(endpoint, body, method) {
    const r = await fetch("https://api.github.com/repos/" + repo + endpoint, {
      method: method ?? (body ? "POST" : "GET"),
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(30000),
    });
    if (!r.ok) throw new Error("GitHub operation failed: " + r.status);
    return r.json();
  }
  for (const report of JSON.parse(fs.readFileSync(privateFile, "utf8"))) {
    const marker = "<!-- destrava-report:" + report.id + " -->";
    let existing = null,
      complete = false;
    for (let page = 1; page <= 20; page++) {
      const list = await github(
        "/issues?state=all&sort=created&direction=desc&per_page=100&page=" + page,
      );
      existing = list.find(
        (issue) =>
          !issue.pull_request &&
          issue.user?.login === "github-actions[bot]" &&
          issue.user?.type === "Bot" &&
          issue.body?.startsWith(marker + "\n"),
      );
      if (existing || list.length < 100) {
        complete = true;
        break;
      }
    }
    if (!complete) throw new Error("Issue reconciliation incomplete");
    const fence = String.fromCharCode(96).repeat(3);
    const body =
      marker +
      "\n## O que aconteceu\n" +
      report.payload.description +
      "\n\n## Contexto\n" +
      fence +
      "json\n" +
      JSON.stringify(report.payload.context, null, 2) +
      "\n" +
      fence +
      "\nVersão: " +
      report.release +
      "\n\n[Imagens e contexto do projeto](" +
      url +
      ") — artifact report-evidence, retenção de 7 dias.\n\nReporte enviado com consentimento de publicação. Não inicia uma sessão de IA automaticamente.\n";
    const issue = existing
      ? await github("/issues/" + existing.number, { body }, "PATCH")
      : await github("/issues", {
          title: ("[Reporte] " + report.payload.title).slice(0, 180),
          body,
        });
    const ack = await bridge({ id: report.id, claim: report.claim, issue: issue.html_url });
    if (ack.acknowledged !== true) throw new Error("Report acknowledgement was not committed");
    console.log(
      JSON.stringify({ report: report.id, issue: issue.html_url, artifactUploaded: true }),
    );
  }
}
