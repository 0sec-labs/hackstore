# Hackstore

The community extension store for [0sec](https://0.security) — the open,
extensible cybersecurity harness.

A Hackstore extension adds **tools** to the 0sec agent: a recon helper, a niche
scanner wrapper, a custom reporting tool, a theme. Extensions are declared by a
**manifest** and distributed through this repo's `index.json`. The 0sec CLI
fetches this index (over https), shows the extensions in its in-app store
(`/hackstore`), and installs the ones an operator chooses.

**Trust model, in one line:** installing writes files and runs *nothing*;
enabling records one operator approval; an extension's tools run only at scan
time, only once enabled. See the full model in
[the author guide](https://github.com/0sec-labs/0sec/blob/main/docs/HACKSTORE.md).

## Use the store

It's on by default — open `/hackstore` in the 0sec TUI, or:

```
0sec plugin search
0sec plugin install <id>
0sec plugin enable <id>
```

Point somewhere else (or disable it) with `0SEC_REGISTRY_URL` / `--registry`.

## Publish an extension

1. **Build it.** `0sec hackstore init my-extension` scaffolds a manifest, an
   example tool, and a README.
2. **Validate it.** `0sec hackstore validate ./my-extension` runs the real
   manifest validator (the same one the CLI enforces on install).
3. **Submit it.** Fork this repo, add one entry to [`index.json`](./index.json),
   and open a pull request. Each entry is:

   ```json
   {
     "id": "you.my-extension",
     "version": "1.0.0",
     "manifest": { "...": "your PluginManifest" },
     "source": { "kind": "inline", "files": { "tool.mjs": "…" } }
   }
   ```

   Every entry is reviewed in the open before it merges. The
   [manifest schema](./hackstore-manifest.schema.json) is enforced in CI and by
   your editor's JSON language server.

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the submission checklist and the
capability rules (what each declared capability lets a tool do, and which
approval it triggers).
