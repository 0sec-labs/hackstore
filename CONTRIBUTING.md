# Publish an extension

Submit one extension per pull request. Include its source, instructions, and the
rebuilt registry. Use Node.js 22 or newer for the repository commands.

## 1. Add the source

Fork this repository and create a directory under `extensions/`:

```text
extensions/your-extension/
  manifest.json
  plugin.js
  README.md
```

The manifest declares the tools. `plugin.js` is a self-contained Node.js program
that speaks the [0sec plugin protocol](https://github.com/0sec-labs/0sec/blob/main/docs/HACKSTORE.md#wire-protocol).
The README explains prerequisites, arguments, results, limits, and a working example.

The installer writes only `plugin.js` and the validated manifest as `plugin.json`.
Read the installed manifest from `plugin.json`, relative to `__dirname`. Additional
source files, dependencies, and install scripts are not copied or run. Bundle any
JavaScript dependencies into `plugin.js`; document external executables separately.

## 2. Declare what the code does

Use a namespaced ID such as `yourname.extension` and a version such as `0.1.0`.
Tool names must be lowercase letters, digits, and underscores, beginning with a
letter, at most 48 characters. They must not duplicate another tool in the
extension or shadow a built-in tool.

Declare every capability the tool uses:

| Capability | Behavior |
| --- | --- |
| `compute` | Computes a result. |
| `model-call` | Calls a model. |
| `network` | Makes network requests. |
| `filesystem-read` | Reads local files. |
| `filesystem-write` | Writes local files. |
| `process-exec` | Starts another process. |
| `findings-write` | Changes findings state. |

Every tool needs at least one capability. These declarations drive host-side
approval decisions. They do not restrict the child process's operating-system
permissions or grant access to host credentials and internal APIs. Reviewers must
check the implementation against the declarations, including external programs it
runs. See the author guide for the actual approval rules.

Treat arguments as untrusted input. Validate them in the plugin, pass subprocess
arguments without a shell, bound output, and report scanner errors as failures.
Keep protocol frames on stdout and diagnostics on stderr. Do not return secrets
or unnecessary source content to the model.

## 3. Validate and run it

```sh
npm ci
0sec hackstore validate ./extensions/your-extension
npm run build
npm run check
npm test
```

`npm run build` validates manifests against the JSON schema, checks duplicate IDs
and tool names, parses each `plugin.js` without executing it, and rebuilds
`index.json`. `npm run check` also verifies that the committed index matches the
source. Neither proves that a plugin works or is safe. The harness validator
performs additional checks at install time.

Follow the author guide's local testing steps to run your extension through 0sec.
Test a successful call and a real failure, including a missing prerequisite where
applicable. Test with the two-file installed layout, not just the source directory.
Use an isolated home and project so testing does not change your normal enablement.

## 4. Open a pull request

Include:

- The extension directory and regenerated `index.json`.
- The tested 0sec and dependency versions.
- The command you ran and its result.
- The reason for each capability and any known limits.

Do not hand-edit the inline JavaScript in `index.json`. Change the source and run
`npm run build`. Review does not provide a sandbox or a security certification.
This repository does not currently implement paid extensions or creator payouts.
