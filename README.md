# Hackstore

Add tools to [0sec](https://github.com/0sec-labs/0sec). Share the tools you build.

An extension gives the 0sec agent a tool it can call during a scan. Use one to
run a scanner, test a custom framework, or work with your own hardware.
This repository holds the extension source and the registry the CLI reads.

## Use an extension

Install [0sec](https://github.com/0sec-labs/0sec#get-started) and check the commands
available in your version:

```sh
0sec --version
0sec plugin --help
0sec plugin browse
0sec plugin install foxguard.scanner
0sec plugin info foxguard.scanner
0sec plugin enable foxguard.scanner
```

These instructions follow source, not necessarily the latest binary. The tested
0sec 0.16.3 binary fails in `plugin run` while reading built-in tool definitions.
Use a harness build containing the `plugin run` registry fix. Foxguard 0.13.2 also
requires the updated registry entry; source changes here do not update the live
registry until published.

Review the source before enabling an extension. Installation only writes files.
Enabled extensions execute code under your user account when loaded. Capability
declarations inform approval prompts; they do not sandbox the code.

The [Foxguard extension](extensions/foxguard/) requires the `foxguard` executable
on `PATH`. Run it on an absolute path you have permission to scan:

```sh
0sec plugin run foxguard.scanner foxguard_scan --yes path=/absolute/path/to/project
```

You can also browse the registry with `/hackstore` in the 0sec console.
To disable an extension for the current project:

```sh
0sec plugin disable foxguard.scanner
```

## Build an extension

Start with the [author guide](https://github.com/0sec-labs/0sec/blob/main/docs/HACKSTORE.md)
for the runtime protocol and local testing. Authoring commands follow the harness
source; older installed releases may not include `0sec hackstore`.

```sh
0sec hackstore init my-extension
0sec hackstore validate ./my-extension
```

An installable extension needs a manifest and a self-contained `plugin.js`.
Manifest validation does not execute the plugin or establish that its code is safe.
See [CONTRIBUTING.md](CONTRIBUTING.md) to package, test, and submit an extension.

## Repository

- [`extensions/`](extensions/): extension source and instructions.
- [`index.json`](index.json): generated registry consumed by 0sec.
- [`hackstore-manifest.schema.json`](hackstore-manifest.schema.json): editor and build-time manifest checks. The harness validator is authoritative at install time.

To rebuild and check the registry, use Node.js 22 or newer:

```sh
npm ci
npm run build
npm run check
npm test
```

These are local checks. This repository has no CI workflow enforcing them yet.
