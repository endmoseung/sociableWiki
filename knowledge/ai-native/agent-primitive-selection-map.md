---
type: reference
title: "Coding-agent primitive selection map — CLAUDE.md vs Skill vs Subagent vs Hook vs MCP"
description: "A per-behavior routing table for which Claude Code primitive to encode a reusable behavior in, picked in priority order."
tags: [claude-code, skills, subagents, hooks, mcp]
date: 2026-06-07
source: "original — synthesizes the Claude Code docs and two community write-ups (see Sources)"
relates: []
---

# Coding-agent primitive selection map

When you want a coding agent to do something *repeatedly and well*, you pick a
**primitive** to encode it in. As of mid-2026 the Claude Code stack settled on
five, and choosing the wrong one is the most common reason a "reusable" workflow
rots. This note is the decision map — not how to author each one, but **which to
reach for**.

There's a narrower question one level down — *"spawn a subagent or stay in one
context?"* — that only matters once you've already decided the behavior is a
procedure Claude runs. This map sits one level up: *which primitive does this
behavior even belong in?*

Read it as a *per-behavior* routing table consulted by **semantics** — you look
up a single behavior and it tells you where that behavior lives. It is **not** a
bootstrap sequence. "What do I build first in an empty `.claude/`?" is a
different, cost-ordered axis (cheapest-to-author first: Skill → Hook →
Subagent). Reading this map's top-down order as an adoption order is exactly how
harnesses get over-built before they do anything useful.

## The 2026 architectural shift (what changed)

- **Commands merged into Skills.** The old `.claude/commands/` still works as a
  legacy path, but the canonical home is now `.claude/skills/` (project) and
  `~/.claude/skills/` (personal). A "slash command" is just a skill you invoke
  by name.
- **Skills can auto-invoke.** A skill's `description:` is what the agent matches
  against the task to decide whether to fire it on its own — the big break from
  old commands, which were manual-only.

## The five primitives — one line each

| Primitive | What it is | Reach for it when… |
|-----------|-----------|--------------------|
| **CLAUDE.md** | Always-loaded project context | Static facts that must hold *every* turn — architecture, conventions, "don't commit until I approve" |
| **Skill** | Reusable prompt/procedure, runs in **main context** | A repeated *workflow* (deploy, style-check, doc generation) you want triggerable by name or by task-match |
| **Subagent** | Task handler in an **isolated context window** | Heavy side work that would flood main context with logs/search dumps — returns only a summary |
| **Hook** | Event-driven shell, fired by the harness | Automatic reaction to a lifecycle event (lint after edit, gate a bash command). The *harness* runs it, not the agent |
| **MCP** | External-system integration | Reaching a database/API/SaaS (issue tracker, design tool, GitHub) as native tools |

## The decision, in order

1. **Must it hold on every single turn, with no trigger?** → CLAUDE.md. (Costs
   context budget always — keep it lean.)
2. **Is it an automatic reaction to an event, that must run even if the agent
   "forgets"?** → Hook. Memory and preferences can't guarantee this; only the
   harness can guarantee execution.
3. **Does it reach an external system?** → MCP — *but this trigger over-fires.*
   The cheaper default is a CLI call wrapped in a Skill; MCP should have to clear
   a real bar (e.g. you need typed tools and a live connection, not a one-shot
   shell command) before you pay for a server.
4. **Is it a repeated procedure the agent performs?** → Skill (default) — unless
   step 5 applies.
5. **Would that procedure flood main context with throwaway output (search,
   logs, file dumps)?** → Subagent, or a Skill with `context: fork`.

## Execution surface is a separate routing axis

After you pick the primitive, route the **execution surface** separately. The primitive
answers "where does this behavior live?" The surface answers "where should this run this
time?"

| Behavior shape | Default primitive | Low difficulty surface | High difficulty surface |
|----------------|-------------------|------------------------|-------------------------|
| Static policy or project fact | `CLAUDE.md` | Main context | Main context, but trim aggressively before it becomes a fixed tax |
| Repeatable human-triggered workflow | Skill | Main context | Skill with `context: fork` if logs/search would pollute the main thread |
| Heavy investigation or review | Subagent | Background subagent on cheap model | Isolated subagent/worktree with explicit files, schema, and budget |
| Guaranteed lifecycle reaction | Hook | Shell hook | Hook plus deterministic receipt; do not rely on model memory |
| External system access | MCP | Existing CLI wrapped by a skill when one-shot | MCP server only when typed, repeated, live tool access is worth the server |

Do not encode difficulty as a new primitive. "Easy reviewer" and "hard reviewer" are the
same behavior with different model/effort routing. In Claude custom agents, `model` belongs
in the agent definition when the role truly needs a ceiling; `effort` belongs to the CLI,
background runner, or per-attempt invocation. Avoid "effort custom-agent frontmatter" as a
design pattern — it turns a runtime budget decision into permanent surface area.

## Key skill frontmatter (how the same file changes behavior)

| Field | Effect |
|-------|--------|
| `description` | The auto-invocation trigger — the agent matches the task against it |
| `disable-model-invocation: true` | Manual-only (`/name`). Use for irreversible actions — a `/deploy` the agent must never fire on its own |
| `user-invocable: false` | Inverse — the agent can read/auto-fire it, but it's hidden from the `/` menu |
| `context: fork` | Run this skill in an isolated subagent instead of main context (with optional `agent:` type) |
| `allowed-tools` | Restrict the tool surface, e.g. `Bash(npm:*)` |
| `paths` | Glob limiting when the skill auto-loads |

So **Skill and Subagent aren't always different files** — one `context: fork`
line turns a skill into subagent-isolated work. The primitive question is partly
a frontmatter question.

## Hard constraints (design around these)

- **Subagents cannot spawn subagents.** Need nested delegation? Chain them from
  the main conversation, or use Skills. This is one reason orchestration logic
  lives at the top level.
- **Subagents start with a fresh, isolated context** — they don't see your
  history, the skills you invoked, or files already read. You must pack
  everything into the delegation message. This is also their value: context
  isolation.
- **MCP servers don't inherit native Read/Write/Bash** unless explicitly
  granted.
- **Worktree isolation (2026):** a forked subagent can take a dedicated git
  worktree so parallel edits don't collide — expensive, worth it only when
  agents actually mutate files concurrently.

## Practitioner lessons worth keeping

- **More lines ≠ better instructions.** Skills and subagents should be
  *maintainable*, not comprehensive — concise, well-structured guidance beats a
  wall of rules.
- **Commit project skills** (`.claude/skills/`) so the whole team gets the same
  commands, standards, and shortcuts — encoding collective intelligence as
  reusable primitives.
- **Plugins** bundle skills + subagents + hooks + MCP as one distributable unit
  for cross-team sharing.

## TL;DR

Five primitives, picked in priority order: **always-on fact → CLAUDE.md;
guaranteed event reaction → Hook; external system → MCP; repeated procedure →
Skill; context-flooding side work → Subagent (or `context: fork`).** The
skill-vs-subagent line is often a single frontmatter flag, not a separate file.
And remember the wall: subagents can't spawn subagents, so orchestration stays at
the top.

## Sources

- [Claude Code sub-agents docs](https://code.claude.com/docs/en/sub-agents)
- [alexop.dev — Understanding the Claude Code full stack](https://alexop.dev/posts/understanding-claude-code-full-stack/)
- [BSWEN — Subagents & Skills in Claude Code](https://docs.bswen.com/blog/2026-04-09-subagents-skills-claude-code/)
