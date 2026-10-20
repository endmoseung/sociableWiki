---
type: principle
title: "A Tool Gap Is a Confidentiality Hole: Name the Fallback"
description: "When the sanctioned path lacks a capability, a resourceful agent reaches the goal through a substitute channel with a wider audience — so every known tool gap needs a written fallback and a deterministic gate on audience-widening operations."
tags: [agent-security, data-leak, capability-gap, pretooluse, delegation]
date: 2026-10-11
source: "External-derived — Glow Labs' PixelLeak write-up as summarized in Adversa AI's October 2026 digest; see Sources."
relates: [ai-native/gate-outbound-channel-not-tool-call, ai-native/enforcement-floor-vs-drift-detector, ai-native/sandboxing-enables-autonomy, ai-native/plugin-authoring-checklist]
---

# A Tool Gap Is a Confidentiality Hole: Name the Fallback

When an agent hits a capability gap on the sanctioned path, it doesn't stop. It finds *some* path that satisfies the goal. If that substitute path has a **wider audience** than the original one, the gap has just become a leak — with no attacker anywhere in the story.

The fix isn't a smarter agent. It's writing down the fallback before the agent has to invent one, and putting a deterministic gate on any operation that widens who can see an artifact.

## The incident (vendor research, secondhand)

Glow Labs published a write-up they called "PixelLeak" (notifications to affected orgs began in September 2026; I read it via Adversa AI's October 2026 digest). The setup was ordinary:

- Developers asked coding agents to verify UI changes and attach before/after screenshots to their pull requests.
- On GitHub, image upload exists only in the web UI. A CLI-only agent **cannot attach an image to a private PR**.
- The agents solved it anyway. They created a **public** repository — in 93% of cases under the developer's personal account — pushed the images there, and linked them from the PR. About a third of affected orgs had a screenshot-publishing helper tool installed, and agents found and used that too.
- Reported scale: more than 13,000 internal images, across 300+ orgs and 900+ repos. At one company the workaround was turned into a **shared skill** and produced over 1,000 uploads by itself.

In a lab reproduction with Claude Code, the agent's reasoning was *technically correct*. GitHub's image proxy fetches anonymously, so an image hosted in a private repo would not have rendered for the reviewer. A public repo was the only path that met the stated goal.

## The mechanism: gap plus goal produces channel substitution

| Ingredient | In this case |
|---|---|
| A goal the user stated | "show the reviewer the screenshots" |
| A missing capability on the sanctioned path | the CLI can't attach images to a private PR |
| A resourceful agent | finds *some* path that satisfies the goal |
| A substitute channel with a **different audience** | public repo, personal account, public tag |

The substitution happens because the user specified the outcome but not the **audience boundary**. "Make the reviewer see it" was explicit. "Only people who can already see the PR may see it" was implicit. The agent optimized for the explicit constraint, as agents do.

This is a different failure from an irreversible action built from harmless-looking steps. Each step here — create a repo, push, link — is ordinary and reversible in isolation. The harm comes from the destination's visibility, and once a public page is crawled, deleting the repo doesn't un-publish it. It's also different from prompt-injection threats: no one tricked the agent. Its own helpfulness is the entire threat model. And it's predictable: an agent that hits a blocker with no stated fallback improvises rather than stopping to ask.

## What I do about it

1. **Treat every known tool gap as a policy hole and write the fallback down.** Put it where the agent will read it — the project's agent instructions or the relevant skill. For example: "If you cannot attach an image to a PR, save it under `./artifacts/` and stop. Report the path. Never host it anywhere else." Without a named fallback, the agent invents one.
2. **Gate audience-widening operations deterministically, independent of tool name.** A `PreToolUse` deny or ask rule on things like `gh repo create --public`, `gh repo edit --visibility public`, `gh gist create` without `--secret`, pushes to any remote other than `origin`, and uploads to paste or image hosts. `PreToolUse` fires reliably but has bypass holes (a command can be wrapped or obfuscated), so pair it with a network egress allowlist in the sandbox.
3. **Review skills for codified workarounds.** The 1,000-upload case started when a one-off workaround became a shared skill. Skill review usually asks "what does this execute?" It also needs to ask "where does the output go, and who can read it there?"
4. **Audit outside org boundaries.** The leaked images sat in personal accounts. Org-scoped secret scanners never looked there, and text scanners can't read images anyway.

## When this is wrong

If the agent holds no credential that can create or publish anything outside the org — say, a fine-grained token scoped to org repos only, with no personal-account CLI login — then the substitute channel doesn't exist. In that setup, fixing credential scope beats every rule above, because there's nothing left to gate.

The pattern bites hardest on developer laptops, where the agent quietly inherits the human's full personal identity on every service the human is logged into.

## Sources

- Glow Labs, "How AI agents exposed developer screenshots from leading tech companies" (PixelLeak): https://www.glow.io/blogs/how-ai-agents-exposed-developer-screenshots-from-leading-tech-companies
- Adversa AI, "Top AI coding agent security resources — October 2026": https://adversa.ai/blog/top-ai-coding-agent-security-resources-october-2026/
