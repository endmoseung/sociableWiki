---
type: pattern
title: "Slopsquatting Turns the Registry Existence Check Into the Attack's Confirmation"
description: "Checking that an agent-added package exists on the registry stops protecting you once an attacker registers the hallucinated name; the real signal is existence plus a brand-new registration, a new publisher, and almost no downloads."
tags: [slopsquatting, supply-chain, dependencies, hooks, coding-agents]
date: 2026-10-11
source: "External-derived — slopsquatting research and vendor write-ups (CSA, Trend Micro, Socket); see Sources."
relates: [ai-native/shared-cache-is-a-cross-sandbox-channel, ai-native/sandboxing-enables-autonomy, ai-native/enforcement-floor-vs-drift-detector]
---

# Slopsquatting Turns the Registry Existence Check Into the Attack's Confirmation

Every so often a coding agent writes `npm install <name>` or `import <name>` for a package that **does not exist**. The name looks right: it follows the ecosystem's naming conventions, or it describes exactly what I asked for. Attackers collect these recurring fake names and **register them on the public registry with a malicious payload**. The attack is called slopsquatting (the term comes from Seth Larson of the Python Software Foundation).

The standard advice is to ground the agent: let it check the registry, through web search or an MCP tool, before it adds a dependency. That advice has a blind spot I think is worth naming precisely. **The check answers "does this name exist?", and once the attacker has registered the name, the answer is yes.** The check that was meant to catch the hallucination now confirms it.

## Why the existence check inverts

| Phase | Name state | Existence check says | Correct verdict |
|---|---|---|---|
| Before squatting | unregistered | "not found", so the agent picks another name | safe — the check works |
| After squatting | registered last week by an unknown account | "found", so the install proceeds | **malicious** — the check waves it through |
| Legitimate package | registered years ago, many dependents | "found" | safe |

The second and third rows look identical to an existence check. Only metadata separates them: how old the registration is, who published it, and whether anyone actually uses it. So the signal I gate on is not existence. It is **existence combined with a very recent first publish, a new publisher, and almost no download history**.

## Why this is practical for an attacker, not just theoretical

Two findings from the 2025–2026 research make the attack economical. I am working from secondary write-ups here, not the original papers, so treat the exact figures as approximate.

- **Fake names recur.** The USENIX Security 2025 study "We Have a Package for You!" found that the same fabricated names come back across repeated prompts, so an attacker can harvest a stable list. It reported about 205k unique fabricated names, with rates up to roughly 20% for weaker models.
- **Rates have fallen, but not to zero.** A 2026 re-evaluation reports roughly 4.6–6.1% for newer frontier models, and agents with live package search do better still. In a long autonomous run that installs dozens of packages, a few percent is a likely hit, not a rare one.

## Where the gate goes

An install is a side effect. A filter that inspects the command's result after it ran is too late, because `postinstall` scripts execute during the install itself. So the gate needs two positions.

1. **Before the tool call.** In a Claude Code-style harness that means a `PreToolUse` hook on the shell tool. Match install commands (`npm|pnpm|yarn add`, `pip|uv add`, `cargo add`, `go get`). For each name *not already in the lockfile*, look up registry metadata and **deny** when any of these is true: first published fewer than N days ago, fewer than M weekly downloads, or a publisher with no history. Give the agent a reason it can act on, such as "package too new — find an established alternative or ask the human." Names already in the lockfile pass untouched, so normal work does not slow down.
2. **At the manifest diff, in CI or pre-commit.** The agent can add a dependency without ever running an install command, for example by editing `package.json` directly and then running a plain `install`. The hook never sees that path. So also diff the manifest and apply the same metadata rule to every *new* entry.

Supporting measures from the same sources:

- Pin lockfiles and verify hashes in CI.
- Point agents at a private registry or an allowlist where you can.
- Run installs with scripts disabled (`--ignore-scripts`) inside the sandbox until a new dependency is approved.

## When this is wrong

If the project legitimately depends on new packages often — say the team publishes its own packages to the public registry, or the ecosystem moves fast enough that the right library is two weeks old — an age threshold blocks real work, and people will switch the gate off. In that case, allowlist your own scope or known publishers instead of lowering the age threshold for everyone. A gate that gets disabled protects nothing.

## The one-line version

"The package exists" is what the attacker wants your check to say. Gate on age, publisher, and usage, and gate both the install command and the manifest diff.

## Sources

- Cloud Security Alliance, research note on slopsquatting (2026-04) — https://labs.cloudsecurityalliance.org/research/csa-research-note-slopsquatting-ai-supply-chain-20260419-csa/
- Trend Micro, "Slopsquatting: When AI Agents Hallucinate Malicious Packages" — https://www.trendmicro.com/vinfo/us/security/news/cybercrime-and-digital-threats/slopsquatting-when-ai-agents-hallucinate-malicious-packages
- Trend Micro slopsquatting dataset — https://github.com/trendmicro/slopsquatting
- Socket, "The Rise of Slopsquatting" — https://socket.dev/blog/slopsquatting-how-ai-hallucinations-are-fueling-a-new-class-of-supply-chain-attacks
- "We Have a Package for You!" (USENIX Security 2025) — recurring fabricated names; cited via the write-ups above.
- arXiv 2606.13918, "Bayesian-Calibrated Detection of Hallucinated Package Imports in AI-Assisted Code" — https://arxiv.org/pdf/2606.13918
