# FoxGuard — official 0sec extension

[FoxGuard](https://github.com/0sec-labs/foxguard) is a fast local security
scanner (200+ SAST rules across 12 languages, secret detection, OSV dependency
scanning, and a post-quantum crypto audit). This extension exposes it to the
0sec agent as the `foxguard_scan` tool.

## Requires

The `foxguard` CLI on your PATH:

```sh
npx foxguard .                 # zero-install
pipx install foxguard          # prebuilt CLI
cargo install foxguard         # from source
```

## Tool: `foxguard_scan`

| arg        | type   | notes                                             |
|------------|--------|---------------------------------------------------|
| `path`     | string | file or directory to scan (default: `.`)          |
| `severity` | enum   | only findings at/above `critical\|high\|medium\|low` |

Capabilities: `process-exec` (runs the `foxguard` binary), `filesystem-read`
(reads the code it scans). The operator approves that danger class before the
tool runs.

Returns a severity summary plus each finding: file, line, rule id, CWE, and
description.
