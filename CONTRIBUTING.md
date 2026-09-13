# Contributing an extension to the Hackstore

Every extension is reviewed in the open. Before you open a PR:

## Manifest

- [ ] `0sec hackstore validate ./your-extension` passes.
- [ ] `id` is namespaced to you (`yourname.extension`), lowercase.
- [ ] `version` is semver (`1.0.0`).
- [ ] Every tool `name` matches `^[a-z][a-z0-9_]*$` and does not shadow a
      built-in tool name.
- [ ] Every tool declares a **non-empty** `capabilities` list. There is no way
      to declare "no capabilities" — an empty list is rejected on purpose.

## Capabilities — declare exactly what your tool does

Each capability maps to a real danger the console gates for. Declaring one is
how the operator's approval prompts, scope gates, and yolo hard-denies fire on
your tool the same way they do for a built-in. Under-declaring is a security
bug and a review blocker.

| Capability          | Your tool…                                   | Triggers |
|---------------------|----------------------------------------------|----------|
| `compute`           | pure in-process computation                  | least-privileged |
| `model-call`        | calls a model                                | model budget |
| `filesystem-read`   | reads the local filesystem                   | local-scope gate |
| `filesystem-write`  | writes/patches the local filesystem          | local-scope gate (never read-only) |
| `network`           | any egress (HTTP/DNS/socket)                  | scope approval |
| `process-exec`      | spawns processes / runs commands             | scope approval (implies network) |
| `findings-write`    | mutates the findings store                   | state mutation (never read-only) |

## Source

- [ ] `source.kind` is `"inline"` and `source.files` contains your tool's code.
- [ ] No install/postinstall scripts — install writes bytes and runs nothing.
- [ ] The code does only what your declared capabilities allow.

## PR

- [ ] One extension per PR.
- [ ] Add your entry to `index.json` (keep it valid JSON — CI checks the schema).
- [ ] Describe what the tools do and why the declared capabilities are right.
