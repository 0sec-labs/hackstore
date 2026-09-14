// Foxguard adapter for the 0sec v1 newline-delimited JSON protocol.
"use strict";
const { spawn } = require("node:child_process");
const { readFileSync } = require("node:fs");
const { isAbsolute, join } = require("node:path");
const readline = require("node:readline");

const manifest = JSON.parse(readFileSync(join(__dirname, "plugin.json"), "utf8"));
const MAX_OUTPUT_BYTES = 8 * 1024 * 1024;
const MAX_RESULT_CHARS = 90_000;
const SCAN_TIMEOUT_MS = 25_000;
const active = new Set();
const severities = ["low", "medium", "high", "critical"];

function send(frame) {
  process.stdout.write(JSON.stringify({ v: 1, ...frame }) + "\n");
}

function formatReport(data) {
  if (!data || !Array.isArray(data.findings)) {
    throw new Error("Foxguard returned JSON without a findings array.");
  }
  const counts = { critical: 0, high: 0, medium: 0, low: 0 };
  const findings = data.findings.map((finding) => {
    if (!finding || !severities.includes(finding.severity) ||
        typeof finding.file !== "string" || !Number.isInteger(finding.line) ||
        typeof finding.rule_id !== "string" || typeof finding.description !== "string") {
      throw new Error("Foxguard returned an invalid finding.");
    }
    counts[finding.severity]++;
    return {
      file: finding.file, line: finding.line, severity: finding.severity,
      rule: finding.rule_id, cwe: finding.cwe, description: finding.description,
    };
  });
  const result = {
    scannerVersion: data.scanner?.version ?? null,
    totalFindings: findings.length,
    counts,
    findings: [],
    omittedFindings: findings.length,
  };
  let size = JSON.stringify(result).length;
  for (const finding of findings) {
    const added = JSON.stringify(finding).length + 1;
    if (size + added > MAX_RESULT_CHARS) break;
    result.findings.push(finding);
    result.omittedFindings--;
    size += added;
  }
  return { content: JSON.stringify(result), truncated: result.omittedFindings > 0 };
}

async function runFoxguard(args) {
  if (!args || typeof args.path !== "string" || !isAbsolute(args.path) || args.path.includes("\0")) {
    throw new Error("path must be an absolute file or directory path you have permission to scan.");
  }
  if (args.severity !== undefined && !severities.includes(args.severity)) {
    throw new Error("severity must be low, medium, high, or critical.");
  }
  const argv = ["--format", "json"];
  if (args.severity !== undefined) argv.push("--severity", args.severity);
  argv.push("--", args.path);

  return new Promise((resolve, reject) => {
    const child = spawn("foxguard", argv, { stdio: ["ignore", "pipe", "pipe"], shell: false });
    active.add(child);
    let output = "";
    let bytes = 0;
    let stderr = "";
    let failure;
    const stop = (reason) => {
      failure ??= new Error(reason);
      child.kill("SIGKILL");
    };
    const timer = setTimeout(() => stop("Foxguard exceeded the 25-second scan limit. Scan a smaller path."), SCAN_TIMEOUT_MS);
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      bytes += Buffer.byteLength(chunk);
      if (bytes > MAX_OUTPUT_BYTES) stop("Foxguard output exceeded 8 MiB. Scan a smaller path or raise the severity threshold.");
      else if (!failure) output += chunk;
    });
    child.stderr.on("data", (chunk) => { stderr += chunk.slice(0, Math.max(0, 2000 - stderr.length)); });
    child.on("error", (error) => {
      failure = new Error(error.code === "ENOENT"
        ? "foxguard is not on PATH. Install the Foxguard CLI before running this extension."
        : `Could not launch Foxguard: ${error.message}`);
    });
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      active.delete(child);
      if (failure) return reject(failure);
      // Exit 1 means findings, while exit 2 or a signal means the scan failed.
      if (signal || (code !== 0 && code !== 1)) {
        return reject(new Error(`Foxguard failed (${signal ?? `exit ${code}`}): ${stderr.trim()}`));
      }
      try {
        resolve(formatReport(JSON.parse(output)));
      } catch (error) {
        reject(new Error(`Could not read Foxguard results: ${error.message}`));
      }
    });
  });
}

send({ kind: "handshake", pluginId: manifest.id, version: manifest.version, manifest });
const input = readline.createInterface({ input: process.stdin, terminal: false });
input.on("line", async (line) => {
  let message;
  try { message = JSON.parse(line); } catch { return; }
  if (!message || message.v !== 1 || typeof message.id !== "string") return;
  if (message.kind === "list_tools") {
    send({ kind: "list_tools", id: message.id, tools: manifest.tools });
  } else if (message.kind === "call_tool") {
    try {
      if (message.tool !== "foxguard_scan") throw new Error("Unknown tool.");
      const result = await runFoxguard(message.args);
      send({ kind: "tool_result", id: message.id, ok: true, ...result });
    } catch (error) {
      send({ kind: "tool_result", id: message.id, ok: false, content: error.message, truncated: false });
    }
  }
});
function shutdown() {
  for (const child of active) child.kill("SIGKILL");
}
input.on("close", shutdown);
process.on("SIGTERM", () => { shutdown(); process.exit(0); });
process.on("SIGINT", () => { shutdown(); process.exit(0); });
