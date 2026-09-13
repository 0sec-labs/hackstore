// FoxGuard — a Hackstore extension for 0sec.
//
// This is a registry plugin: 0sec spawns it as a hardened child process and
// speaks the newline-delimited JSON protocol (v1). The child handshakes with
// its manifest, answers `list_tools`, and on `call_tool` shells out to the
// `foxguard` CLI and returns the findings. `process-exec` + `filesystem-read`
// are declared in the manifest, so the operator approves that class of danger
// before this ever runs.
"use strict";
const { spawn } = require("node:child_process");
const readline = require("node:readline");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");

const V = 1;
const manifest = JSON.parse(readFileSync(join(__dirname, "manifest.json"), "utf8"));

function send(frame) {
  process.stdout.write(JSON.stringify(Object.assign({ v: V }, frame)) + "\n");
}

// Handshake immediately: the host kills a child that does not handshake in time.
send({ kind: "handshake", version: manifest.version, manifest });

function runFoxguard(args) {
  return new Promise((resolve, reject) => {
    const path = typeof args.path === "string" && args.path.trim() ? args.path : ".";
    const argv = ["--format", "json", path];
    let child;
    try {
      child = spawn("foxguard", argv, { stdio: ["ignore", "pipe", "pipe"] });
    } catch (err) {
      reject(new Error("could not launch foxguard: " + (err && err.message || err)));
      return;
    }
    let out = "", err = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (d) => { out += d; });
    child.stderr.on("data", (d) => { if (err.length < 4000) err += d; });
    child.on("error", (e) => {
      reject(new Error(
        e && e.code === "ENOENT"
          ? "foxguard is not installed or not on PATH. Install it with `npx foxguard`, `pipx install foxguard`, or https://foxguard.dev/install.sh"
          : "foxguard failed to run: " + (e && e.message || e)
      ));
    });
    // foxguard exits non-zero when it finds issues, so parse regardless of code.
    child.on("close", () => {
      let data;
      try { data = JSON.parse(out); }
      catch (e) {
        reject(new Error("could not parse foxguard JSON output: " + (e && e.message || e) +
          (err ? ("; stderr: " + err.slice(0, 500)) : "")));
        return;
      }
      const want = typeof args.severity === "string" ? args.severity : null;
      const order = { critical: 4, high: 3, medium: 2, low: 1 };
      let findings = Array.isArray(data.findings) ? data.findings : [];
      if (want && order[want]) findings = findings.filter((f) => (order[f.severity] || 0) >= order[want]);
      const counts = (data.finding_counts && data.finding_counts.by_severity) || {};
      const version = (data.scanner && data.scanner.version) || manifest.version;
      const summary = "FoxGuard " + version + ": " + findings.length + " finding(s)" +
        (want ? " at " + want + "+" : "") + " — " +
        (counts.critical || 0) + " critical, " + (counts.high || 0) + " high, " +
        (counts.medium || 0) + " medium, " + (counts.low || 0) + " low";
      const rows = findings.map((f) => ({
        file: f.file, line: f.line, severity: f.severity,
        rule: f.rule_id, cwe: f.cwe, description: f.description,
      }));
      resolve(JSON.stringify({ summary, findings: rows }, null, 2));
    });
  });
}

const rl = readline.createInterface({ input: process.stdin, terminal: false });
rl.on("line", async (line) => {
  const text = line.trim();
  if (!text) return;
  let msg;
  try { msg = JSON.parse(text); } catch { return; }
  if (!msg || typeof msg !== "object") return;
  if (msg.kind === "list_tools") {
    send({ kind: "list_tools", id: msg.id, tools: manifest.tools });
    return;
  }
  if (msg.kind === "call_tool") {
    const id = msg.id;
    if (msg.tool !== "foxguard_scan") {
      send({ kind: "tool_result", id, ok: false, content: "unknown tool: " + String(msg.tool) });
      return;
    }
    try {
      const content = await runFoxguard(msg.args || {});
      send({ kind: "tool_result", id, ok: true, content });
    } catch (e) {
      send({ kind: "tool_result", id, ok: false, content: String(e && e.message || e) });
    }
  }
});
