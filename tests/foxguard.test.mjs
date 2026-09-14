import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";

const source = new URL("../extensions/foxguard/", import.meta.url);
const manifest = JSON.parse(await readFile(new URL("manifest.json", source), "utf8"));
const plugin = await readFile(new URL("plugin.js", source), "utf8");
const finding = { file: "app.py", line: 3, severity: "high", rule_id: "example.rule", cwe: "CWE-78", description: "Unsafe command" };

async function launch(t, scanner) {
  const root = await mkdtemp(join(tmpdir(), "hackstore-test-"));
  const bin = join(root, "bin");
  await mkdir(bin);
  // Match the installer's two-file layout, not the author's source tree.
  await writeFile(join(root, "plugin.json"), JSON.stringify(manifest));
  await writeFile(join(root, "plugin.js"), plugin);
  if (scanner) await writeFile(join(bin, "foxguard"), `#!${process.execPath}\n${scanner}`, { mode: 0o700 });
  const child = spawn(process.execPath, [join(root, "plugin.js")], {
    cwd: root, env: { PATH: bin }, stdio: ["pipe", "pipe", "pipe"],
  });
  const closed = new Promise((resolve) => child.once("close", resolve));
  t.after(async () => { child.kill(); await closed; await rm(root, { recursive: true, force: true }); });
  const frames = createInterface({ input: child.stdout })[Symbol.asyncIterator]();
  const next = async () => {
    const frame = await frames.next();
    assert.equal(frame.done, false, "plugin exited before its response");
    return JSON.parse(frame.value);
  };
  const handshake = await next();
  assert.equal(handshake.kind, "handshake");
  assert.equal(handshake.pluginId, manifest.id);
  const call = async (args, tool = "foxguard_scan") => {
    child.stdin.write(JSON.stringify({ v: 1, kind: "call_tool", id: "call-1", tool, args }) + "\n");
    return next();
  };
  return { call };
}

test("installed plugin accepts scanner exit 1 and returns findings", { timeout: 5000 }, async (t) => {
  const { call } = await launch(t, `console.log(JSON.stringify({scanner:{version:"test"},findings:[${JSON.stringify(finding)}]})); process.exitCode=1;`);
  const result = await call({ path: "/authorized/app" });
  assert.equal(result.ok, true);
  assert.equal(result.truncated, false);
  const report = JSON.parse(result.content);
  assert.equal(report.counts.high, 1);
  assert.equal(report.findings[0].rule, "example.rule");
  assert.equal(report.omittedFindings, 0);
});

test("scanner failure cannot be reported as a clean scan", { timeout: 5000 }, async (t) => {
  const { call } = await launch(t, 'console.log(JSON.stringify({findings:[]})); process.exitCode=2;');
  const result = await call({ path: "/authorized/app" });
  assert.equal(result.ok, false);
  assert.match(result.content, /exit 2/);
});

test("missing or malformed findings are failures", { timeout: 5000 }, async (t) => {
  const { call } = await launch(t, 'console.log("{}");');
  const result = await call({ path: "/authorized/app" });
  assert.equal(result.ok, false);
  assert.match(result.content, /findings array/);
});

test("rejects ambiguous paths and unknown tools before scanner execution", { timeout: 5000 }, async (t) => {
  const { call } = await launch(t);
  assert.match((await call({ path: "." })).content, /absolute/);
  assert.match((await call({ path: "/authorized/app", severity: "urgent" })).content, /severity/);
  assert.equal((await call({ path: "/authorized/app" }, "other_tool")).ok, false);
  assert.match((await call({ path: "/authorized/app" })).content, /not on PATH/);
});

test("large results preserve valid JSON and report omitted findings", { timeout: 5000 }, async (t) => {
  const { call } = await launch(t, `console.log(JSON.stringify({findings:Array.from({length:2000},()=>(${JSON.stringify(finding)}))})); process.exitCode=1;`);
  const result = await call({ path: "/authorized/app" });
  assert.equal(result.ok, true);
  assert.equal(result.truncated, true);
  const report = JSON.parse(result.content);
  assert.equal(report.totalFindings, 2000);
  assert.equal(report.counts.high, 2000);
  assert.equal(report.findings.length + report.omittedFindings, 2000);
  assert.ok(result.content.length <= 90000);
});

test("unbounded scanner output fails rather than presenting partial findings", { timeout: 5000 }, async (t) => {
  const { call } = await launch(t, 'process.stdout.write("x".repeat(9*1024*1024));');
  const result = await call({ path: "/authorized/app" });
  assert.equal(result.ok, false);
  assert.match(result.content, /exceeded 8 MiB/);
});
