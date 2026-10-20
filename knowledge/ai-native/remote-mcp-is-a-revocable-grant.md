---
type: principle
title: "A Remote Vendor MCP Is a Revocable Grant, Not a Protocol Guarantee"
description: "MCP standardizes how a client talks to a server, not whether a hosted vendor server will talk to your client — so treat a remote vendor MCP as a revocable grant and keep a thin self-owned REST fallback for the reads you depend on."
tags: [mcp, vendor-dependency, resilience, agent-harness, integrations]
date: 2026-10-11
source: "External-derived — practitioner reports from two Hacker News threads (Sept–Oct 2026); see Sources."
relates: [ai-native/agent-primitive-selection-map, ai-native/configured-is-not-effective, ai-native/harness-component-value-is-model-dependent]
---

# A Remote Vendor MCP Is a Revocable Grant, Not a Protocol Guarantee

MCP is a protocol. It standardizes *how* a client and a server talk. It says nothing about *whether* a hosted vendor server will agree to talk to **your** client. A vendor can accept or reject a connection based on which client is calling — Claude Code, Codex, Copilot, a minimal agent, a harness you built yourself — and as of October 2026 at least one major design-tool vendor does exactly that.

So a workflow that leans on a remote vendor MCP leans on a **vendor-side allowlist you don't control and can't see until it fails**. I now treat every remote vendor MCP like any other third-party API grant: inventory it, make its failure loud, and own a small fallback over the vendor's plain REST API.

## What made this concrete

In early October 2026 a Figma staffer announced that Figma's remote MCP would only accept allowlisted clients. A minimal-harness agent called Pi was among the clients left out. The Hacker News discussion filled in the shape of it (these are practitioner reports, not independently verified):

- The vendor runs **two** MCP servers: a local one bridged through the desktop app, and a remote one. Only the remote one grants **write** access, and that is the one gated per client.
- One commenter added the server to a different IDE agent and got repeated opaque errors before learning the client simply wasn't on the list.
- The gate reportedly keys on client-identifying request metadata, which is spoofable. Someone in the thread runs a CLI patched to impersonate an allowlisted client. That makes the gate a **contract lever, not a security boundary** — and spoofing it trades a technical failure for a terms-of-service one, so it isn't a real fallback.
- The vendor MCP can expose capabilities the public REST API does not. That makes it the only route to those capabilities, and it is the route the vendor can close.

The broader pattern commenters named: as products get reduced to a bag of tools for AI to call, vendors keep **write** access for the clients they have agreements with. Read access through the REST API tends to stay open longer than write access through the MCP.

The same week showed the pressure from the other side. A widely discussed post from the Pi project explained why a harness that had avoided MCP was adding it after all: the server ecosystem is where the integrations live. More clients converging on a few popular servers gives those server owners more leverage over which clients they serve.

## Why this is a different axis

Client identity usually shows up in MCP discussions as an input to *serving better*: a server author might return a full tool roster to one client and a single `exec` tool to another, or an operator might log which client generated which traffic. Here client identity is an input to *serving at all*. The server vendor decides, and the consumer carries the risk.

## What I do on the consumer side

1. **Inventory remote vendor MCPs as external grants, not as tooling.** For each one, write down which client you use, whether you need read or write, and whether a local or desktop-bridge variant exists. A local variant usually runs under a different trust and gating model.
2. **Make the gate's failure loud.** An allowlist rejection rarely says "you're not allowlisted." It surfaces as a generic auth or connection error, or as "tool not found," which then looks like a broken config or an agent that "didn't use the tool." Add a startup canary — one cheap read — and fail the workflow with an explicit "vendor MCP unreachable for this client" message instead of letting the agent quietly fall back to guessing.
3. **Own a thin "lens" over the REST API for the reads you depend on.** One practitioner in the thread replaced the remote MCP for native mobile work by having the agent write a few narrow tools on the REST API: all fonts, layout dimensions, colors, each emitting a compact plaintext format. Those tools were cheaper in tokens — the MCP returned web-framework-shaped design context that was mostly waste for a non-web target — and immune to client gating. The lens is the "prefer a CLI plus a skill over a new MCP" default, applied as a resilience hedge rather than only as a context-cost optimization.
4. **Don't build on write paths you can't replicate.** If a step needs a capability only the MCP can write, mark it in the workflow design as human-gated or vendor-dependent. Then a revocation degrades one step instead of the whole pipeline.

## When this advice is wrong

If you use the vendor's **first-party** client, or one of the few major clients the vendor has an agreement with, and the workflow is short-lived, the grant is unlikely to move under you. The lens is then maintenance cost with no payoff, and custom harness code is always paid for against the churn of the base tools underneath it.

The hedge earns its keep for long-lived automation, for non-flagship clients (custom harnesses, minimal agents, newer IDE integrations), and whenever you expect to switch harnesses later.

## Sources

- Hacker News item 49922729 — "Figma restricts MCP access to whitelisted clients, excluding Pi" (2026-10-01) and comments. Practitioner reports; not independently verified.
- Hacker News item 49906637 — "You said no MCP" (earendil.com, 2026-09-30) and comments.
