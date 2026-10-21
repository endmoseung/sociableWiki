---
type: principle
title: "An Agent's Orientation Step Is an Execution Step"
description: "Coding agents run background git commands to orient themselves before any trust prompt, and git honors the repo's own config, some of whose keys name programs to run — so 'reading the repo' is an unguarded exec path."
tags: [agent-security, git, trust-boundary, sandboxing, hooks]
date: 2026-10-10
source: "External-derived — the GitSpawn disclosure (Manifold Security) and follow-up write-ups; see Sources."
relates: [ai-native/sandboxing-enables-autonomy, ai-native/eval-sandbox-attack-surface, ai-native/gate-outbound-channel-not-tool-call, ai-native/configured-is-not-effective]
---

# An Agent's Orientation Step Is an Execution Step

Coding agents orient themselves by running `git status` and `git diff` in the background. They often do it at startup — **before** the workspace-trust dialog, and **outside** the per-tool approval gate and the Bash sandbox, because it's the harness doing reconnaissance, not the model calling a tool.

Git, meanwhile, honors the repository's own `.git/config`. Some keys in that file name a program that git will run, for example during an index refresh. Put those together and "read the repo to understand it" stops being a read. It's an exec path under the user's privileges that no permission rule sees. The trust dialog arrives *after* the first code execution, not before it.

## The incident that made it concrete

In September 2026 Manifold Security disclosed "GitSpawn": 8 findings across 7 CLI coding agents. The core case is a `.git/config` that sets `core.fsmonitor` to a shell command. When the agent runs its background `git status`, git refreshes the index, consults the fsmonitor hook, and runs the command. Git is behaving exactly as designed; the agents simply never stripped repository config before calling it.

There is a delivery prerequisite, and it matters for judging your exposure. The directory has to arrive **as files that include `.git/`** — a zip, a shared drive, a sync folder, a USB stick. `clone`, `fetch`, and `pull` don't transfer `.git/config`, so a hostile URL on its own doesn't trigger this. As of the disclosure, no in-the-wild exploitation had been reported, and vendor fixes were landing unevenly across the affected agents. Check each vendor's advisory rather than trusting any status list, including one in a write-up like this.

## Three non-obvious consequences

**1. Fixing one key is whack-a-mole.** In the disclosure, one agent that had fixed the `core.fsmonitor` path still had a second finding: a different internal call path that used a *different* program-naming config key. The defect class isn't "fsmonitor." It's "any background git call that inherits repo config." So the fix belongs at each call site, not on each key. Every context-gathering git call should run with sanitizing overrides, for example:

```bash
git -c core.fsmonitor=false -c core.hooksPath=/dev/null status
```

**2. The widely repeated user-side fix points the wrong way.** Several write-ups recommended `git config --global core.fsmonitor false`. But git's documented precedence runs system < global < local (repo) < worktree < command line (`-c`, or the `GIT_CONFIG_COUNT` / `GIT_CONFIG_KEY_n` / `GIT_CONFIG_VALUE_n` environment triple). A repo-local value **overrides** your global one. Only command-line or environment-injected config outranks the attacker's file. `safe.directory` doesn't save you either: an extracted zip is owned by the victim, so the ownership check passes. (This precedence argument is my inference from git's documented config order, not something the disclosure states.)

**3. Your own harness is a caller too.** This one is a hypothesis I haven't seen tested publicly. Statusline scripts, HUDs, and hooks that run `git status` on every turn hit the same sink, and no vendor patch covers them, because the vendor didn't write them. A hook that only runs `git rev-parse` doesn't refresh the index and isn't the fsmonitor sink, but other program-naming keys may apply to other subcommands. Audit by call site, not by assumption.

## How I apply it

- **Treat "opened a directory received as files" as untrusted execution.** Before an agent touches it, inspect `.git/config` for any key that names a program. A grep like `grep -nE 'fsmonitor|hooksPath|sshCommand|editor|pager|askpass' .git/config` is a starting point, not an exhaustive check. Or open the directory in a sandbox or VM.
- **Sanitize git in scripts I own.** In my own statusline and hook scripts, every git call gets `-c core.fsmonitor=false -c core.hooksPath=/dev/null`, or I export the `GIT_CONFIG_COUNT` triple once at the top.
- **Add a fourth entry point to the attack-surface list.** I used to think of agent attack surface as three things: the repo it opens, the packages it installs, the config it writes. There is a fourth: **the reconnaissance the harness performs before the human is asked anything.**

## When this is wrong

If your agent only ever opens repos obtained via `git clone` from sources you already trust, and none of your harness scripts call index-refreshing git commands, the delivery prerequisite never holds. In that setup this is noise, and the sanitizing flags are harmless but unnecessary.

## Sources

- Manifold Security, GitSpawn disclosure (primary): https://www.manifold.security/blog/ai-coding-agents-git-hijack
- Aviatrix threat note on CVE-2026-19592: https://aviatrix.ai/threat-research-center/malicious-git-configs-ai-agents-cve-2026-19592/
- Byteiota summary, noting that VS Code fixed the same class of bug in 2021: https://byteiota.com/gitspawn-ai-coding-agents-hit-by-git-config-rce-flaw/
- The precedence argument in consequence 2 comes from git's documented config-file order, not from the sources above.
