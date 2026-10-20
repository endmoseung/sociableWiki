---
type: reference
title: "Electron Capture-Tool Pitfalls — Symptom, Cause, Fix"
description: "Building a macOS screen-capture app in Electron fails at a handful of predictable boundaries — custom protocols, packaging, focus timing, OS permissions, and page-returned data — and each has a known fix."
tags: [electron, macos, screen-capture, security, debugging]
date: 2026-08-13
source: original
relates: [dev-process/trace-cause-before-fixing]
---

# Electron Capture-Tool Pitfalls — Symptom, Cause, Fix

This is the battle log from building a desktop capture app in Electron on macOS (built on Electron 33, mid-2026). Every row below cost a real debugging round. I wrote it as symptom → cause → fix so that the next session — mine or an agent's — can apply the fix without re-deriving it.

The common thread: almost none of these bugs live in my own logic. They live at a **boundary** — between renderer and main process, between dev build and packaged app, between my window and the OS focus system, between my code and an untrusted web page. When a capture tool misbehaves, check the boundary first.

## Serving local images to a sandboxed renderer

| Symptom | Cause | Fix |
|---|---|---|
| A `file://` `<img>` is blocked in the renderer | Sandboxed renderers treat `file://` loads as opaque-origin fetches | Register a privileged custom protocol (`protocol.registerSchemesAsPrivileged` + `protocol.handle`). Never reach for `webSecurity: false` |
| Custom-scheme images 403 or break **only for some paths** | A "standard" scheme parses the first path segment as the URL host and lowercases it. `myapp-shot:///Volumes/Shots/a.png` gets host `volumes`, which breaks any case-sensitive path check | Never encode an absolute path into the scheme URL. Send only a filename (`myapp-shot://shot/<encodeURIComponent(name)>`); the main process joins it under a fixed root and checks containment (no `/`, no `..`, and the resolved path starts with `root + sep`) |
| The bug above passes e2e | Test fixtures live under all-lowercase temp paths, so host-lowercasing is invisible | If a path check is case-sensitive, add a fixture under a capitalized path, or assert once against the real corpus |

## Process and packaging

| Symptom | Cause | Fix |
|---|---|---|
| The preload script never loads | Since Electron 20, sandboxed renderers only load CommonJS preloads | Author the preload as `.cts` so it emits `.cjs`; keep ESM everywhere else |
| The packaged app can't run helper Node scripts | An app launched from Finder has no `node` on `PATH` | Spawn your own binary with `ELECTRON_RUN_AS_NODE=1` |
| The app keeps running old code after edits | `npm run build` updates `dist/`, but the packaged `.app` bundles its own copy | Re-run the packager (for example `electron-builder --dir`) before relaunching the `.app` |
| A DMG check still reports a launch failure after removing `com.apple.quarantine` | Gatekeeper can cache the denial for that exact app path after the script deliberately launches the quarantined copy once | For the post-quarantine launch check, copy the app out of the DMG to a fresh path, clear quarantine on that copy, and launch it there. Don't reuse a path Gatekeeper already denied |

## Capture UX — the moments that break trust

| Symptom | Cause | Fix |
|---|---|---|
| The capture contains your own app, or "frontmost app" metadata names your app | Your window is frontmost when capture starts | Hide all your own windows, wait about 300 ms for macOS to hand focus over, read the frontmost app, then capture; restore your windows afterwards |
| The first capture is just the wallpaper | macOS Screen Recording permission isn't granted to the process that invoked the capture | Detect it and tell the user. The permission is tied to app identity, so a dev shell and the packaged `.app` need separate grants |
| An agent driving QA through a computer-use tool can't drag in `screencapture -i`, and reading app state cancels the selection overlay | The macOS selection layer isn't a normal accessibility application, while the computer-use tool needs an already-inspected app as its target | Inspect a harmless foreground app **before** starting capture. Start `screencapture -i`, read no app state, then send one coordinate drag to that already-inspected target. This sequence produced a real full-resolution capture from the packaged app |
| A leaked-process audit flags unrelated sessions | The app spawns a CLI child process, and a machine-wide `pgrep <cli>` also matches every other session of that CLI on the machine | Match the app-owned command signature and the packaged executable path, then separately assert that the test user-data directory is gone. Never kill processes you didn't start |
| Users never find an always-on-top helper bar | A detached strip at the top of the screen is outside the eye line | Glue it to the parent window: `frame: false`, reposition on the parent's `move` / `resize`, and give it a loud call-to-action style |
| `osascript tell application "X"` launches X | AppleScript `tell` starts apps that aren't running | Only query the browser whose name matches the current frontmost app |
| A small dialog clips its buttons | `BrowserWindow` height includes the title bar | Set `useContentSize: true` |
| An `<input list>` (datalist) dropdown won't scroll | A Chromium datalist limitation on macOS | Use a native `<select>` for known values with a free-text input beside it |

## Full-page capture without bundling Playwright

`webContents.debugger.attach("1.3")` followed by `Page.captureScreenshot({ format: "png", captureBeyondViewport: true })` returns a screenshot of the full scroll height of a `BrowserWindow` (base64, convert to a `Buffer`). If attaching fails, fall back to `webContents.capturePage()`, which only covers the viewport — and **tell the user** about the downgrade. A silent viewport shot gets mistaken for a full-page one. The result width is `viewportWidth × devicePixelRatio`, so never assert exact pixel widths in tests.

## Trust boundary: `executeJavaScript` runs in the page's world

Whatever `webContents.executeJavaScript(script)` returns from an arbitrary page is **attacker-controlled**. The page can override `Array.prototype` or `String.prototype`, so any caps or truncation inside your injected script are void. Sanitize on the main-process side, every time:

- Force arrays: if `Array.isArray(v)` fails, use `[]`.
- Re-cut strings: `String(v)`, strip newlines, cap the length. Stripping newlines also blocks fake markdown headings injected into whatever you write out.
- Clamp numbers: a huge `level` turns `"  ".repeat(level)` into a crash.

It is the same discipline as validating an HTTP request body — the page is the client, and the client lies.

## Keeping a data-viewer window fresh

A window that loads its list once at startup looks broken the first time another window writes data ("I saved it but it's not there"). Two cheap channels fix it: the main process sends an IPC event after every successful write, and the renderer also refreshes on window `focus`, which covers external edits and `git pull`s.

## When this list is the wrong guide

These rows are specific to macOS and to the Electron generation I built on. Windows and Linux have different focus, permission, and quarantine models, and Electron's protocol and sandbox defaults have shifted between major versions. Treat the *causes* as the durable part — scheme host normalization, identity-scoped OS permissions, untrusted page return values — and re-verify the exact API calls against your Electron version.
