# Foxguard

Run the [Foxguard scanner](https://github.com/0sec-labs/foxguard) from the 0sec
agent or CLI. The extension calls the installed `foxguard` executable and returns
its findings. It does not install or bundle the scanner.

## Get started

Install Foxguard using its [installation instructions](https://github.com/0sec-labs/foxguard#install).
Confirm the executable is on `PATH`, then install and enable the extension:

```sh
foxguard --version
0sec plugin install foxguard.scanner
0sec plugin enable foxguard.scanner
0sec plugin run foxguard.scanner foxguard_scan --yes path=/absolute/path/to/project severity=high
```

Review the code before enabling it. Only scan files you have permission to assess.
The plugin process starts in its installation directory, so `path` must be absolute.
Version 0.13.2 removes the old default of `.`, which could scan that directory
instead of the intended project. Upgrade approval may be required by 0sec.

## Arguments

| Argument | Required | Meaning |
| --- | --- | --- |
| `path` | Yes | Absolute path to a file or directory. |
| `severity` | No | Minimum severity: `low`, `medium`, `high`, or `critical`. Without it, Foxguard uses its configured default. |

The tool runs `foxguard --format json [--severity VALUE] -- PATH` without a shell.
Rules and coverage depend on the installed Foxguard version and configuration.
This command does not explicitly enable the separate `--sca` dependency check.
External engines or settings in scanner configuration can cause additional process,
file, or network activity; inspect that configuration before running.

## Results and failures

A successful result is JSON with the scanner version, finding counts, finding
locations, rule IDs, CWEs, and descriptions. It omits code snippets. Exit code 1
from Foxguard means findings were reported; it is not a failed tool call.

The extension reports a failed call for scanner errors, missing executables,
invalid reports, scans longer than 25 seconds, or scanner output over 8 MiB.
Large reports retain complete finding records up to a 90,000-character result
budget and report `omittedFindings`. Counts include those omitted records.
No findings means this scan returned none, not that the software is secure.

Declared capabilities are `process-exec` and `filesystem-read`. They tell the host
what approval to request; they are not operating-system restrictions. A loaded
plugin runs under your user account.
