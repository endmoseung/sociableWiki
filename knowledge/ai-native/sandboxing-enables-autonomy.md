---
type: deep-dive
title: "Sandboxing, not permissions, is what makes a coding agent autonomous"
description: An OS-level sandbox — not a pile of permission prompts — is what lets a coding agent run unattended, because it contains the blast radius instead of asking you to catch every risky action.
tags: [coding-agents, sandboxing, autonomy, prompt-injection, security, claude-code]
date: 2026-06-08
source: "Synthesis of Anthropic and OpenAI Codex sandboxing docs — see Sources"
relates: []
---

# Sandboxing, not permissions, is what makes a coding agent autonomous

## The reframe

The intuitive mental model is "more autonomy = more risk, so to go faster I have to
turn off the safety prompts." That's backwards. In 2026 both Claude Code and OpenAI
Codex converged on the opposite insight: a real OS-level **sandbox** is what *lets* an
agent run unattended, because the sandbox removes the question instead of asking it.

The distinction, stated precisely:

| | **Permissions** | **Sandboxing** |
|---|---|---|
| Mechanism | Agent asks "may I?", you click yes/no | Kernel refuses the syscall — no dialog exists |
| Enforcement layer | Agent's own code (bypassable by a clever prompt) | OS primitive (bubblewrap on Linux, seatbelt on macOS) |
| Covers subprocesses? | No — only the agent's own tool calls | Yes — any script/program/subprocess the agent spawns |
| Failure mode | "click-through fatigue" → user rubber-stamps everything | Write outside the workspace → `Operation not permitted` at the syscall |

A permission is a request the agent makes. A sandbox is a wall the kernel enforces. The
agent can't talk its way past a wall — which is exactly why the wall lets you stop
watching.

## The two boundaries

A well-designed coding-agent sandbox enforces two complementary boundaries, both at the
OS level so they cover spawned subprocesses, not just the agent's direct tool calls:

1. **Filesystem isolation** — read/write only inside the current working directory.
   Writes outside it are kernel-blocked (`Operation not permitted`), no dialog to click.
2. **Network isolation** — outbound traffic only through a unix domain socket to a
   proxy running *outside* the sandbox. The proxy enforces an allowed-domain policy and
   handles confirmation for new domains.

Concrete payoff: Anthropic reports internal usage where sandboxing **cut permission
prompts by 84%** while *raising* the safety floor. Fewer interruptions and a harder
boundary at the same time — that's the whole point.

## Why this is the right answer to prompt injection

Prompt-injection defenses that live *inside* the agent (detection, refusal heuristics)
are a probabilistic filter — a sufficiently clever injection slips through. The sandbox
is a different kind of defense: it doesn't try to *detect* the attack, it *contains* the
blast radius. As Anthropic frames it, even a successful prompt injection stays fully
isolated and can't impact overall user security. A compromised agent inside the sandbox
can't read your SSH keys or phone home, because the kernel won't let it touch files
outside the workspace or open an unapproved connection. You stop betting on catching
every injection and start betting on the OS, which is a much better bet.

## Defaults diverge: autonomy-forward vs approval-forward

The architectures are nearly identical; the *defaults* reveal the product philosophy:

- **Claude Code** ships autonomy-forward: runs freely for the vast majority of
  operations, still prompts for genuinely destructive ones (`rm`/`rmdir` targeting `/`,
  `$HOME`, or system paths trigger a prompt even in auto-allow mode).
- **Codex** ships approval-forward (safest for a new product): default is the cautious
  approval mode. Users opt into autonomy via `--full-auto` (= `--approval-mode never` +
  `--sandbox workspace-write`). Its tiers run `workspace-write` (default) →
  `danger-full-access` (no sandbox at all).

Codex's own docs make the same two-axis split explicit: **the sandbox defines the
technical boundary; the approval policy decides when to stop and ask before crossing
it.** Two independent knobs, not one slider.

## The caveat that keeps this honest

Neither vendor claims the sandbox is a complete isolation boundary. The most important
gap: the network proxy **does not do TLS inspection** — it controls *which domains* you
reach, not *what* travels over an encrypted connection to an allowed domain. So an
allowed-but-compromised domain is still an exfiltration path. The boundary is "which
servers," not "what data." Treat the domain allowlist as the actual security control and
keep it tight.

## So what (practical takeaways)

- If you want a coding agent to run unattended (overnight tickets, parallel worktrees),
  reach for **sandboxing first, autonomy flags second** — not the reverse. The sandbox
  is what makes "never ask me" safe.
- Don't conflate "I turned off prompts" with "I made it safe." Turning off prompts
  *without* a sandbox is strictly worse; turning them off *with* a sandbox is the
  intended design.
- Keep the **network allowlist** as your real perimeter — filesystem isolation is the
  easy half, exfiltration via allowed domains is the hard half.
- Longer autonomous runs only pay off if you're not babysitting prompts, which requires
  the sandbox to exist first.

## Sources

- [Making Claude Code more secure and autonomous with sandboxing — Anthropic](https://www.anthropic.com/engineering/claude-code-sandboxing)
- [Configure the sandboxed Bash tool — Claude Code Docs](https://code.claude.com/docs/en/sandboxing)
- [Sandbox — Codex / OpenAI Developers](https://developers.openai.com/codex/concepts/sandboxing)
- [Codex CLI Full-Auto Mode: Two Flags to Stop the Approval Prompts — frr.dev](https://www.frr.dev/posts/codex-cli-autonomous-agent-two-flags/)
