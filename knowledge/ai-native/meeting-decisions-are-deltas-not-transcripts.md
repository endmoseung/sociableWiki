---
type: pattern
title: "Meeting knowledge is the decision delta, not the transcript"
description: "A durable wiki should record what a meeting changed, why, and which owner document now differs—not preserve the conversation that produced it."
tags: [ai-native, knowledge-management, meetings, decision-log, agent-memory]
date: 2026-07-16
source: original
relates: [ai-native/agent-memory-architecture]
---

# Meeting Knowledge Is the Decision Delta, Not the Transcript

Meeting transcripts are rich in detail and poor in durable signal. They mix proposals,
questions, repetition, social negotiation, action items, and decisions. Saving the
whole transcript makes future retrieval harder because every discarded idea competes
with the conclusion that replaced it.

The durable unit is the **decision delta**: what changed in the shared model because
the meeting happened.

## The extraction test

An item is a decision when the meeting settled a change in priority, scope, ownership,
deadline, policy, constraint, or accepted trade-off. A statement is not a decision
merely because it was said confidently or assigned as an action.

Record four fields:

```text
decision → rationale → affected owner document → source evidence
```

Use “rationale not stated” when the source does not provide one. Never reconstruct a
clean explanation that the participants did not actually agree on.

## Update owners instead of creating meeting pages

A decision about authentication belongs in the authentication policy. A changed
milestone belongs in the roadmap. A cross-cutting choice may belong in a decision log.
The meeting date is provenance, not the information architecture.

Prefer updating the existing owner document. Create a new page only when the decision
introduces a genuinely new durable topic.

## Ambiguity is a state, not a defect

Transcripts often contain conditional language: “we could,” “unless,” “for now,” or
“let’s check.” These items should remain `NEEDS_CONFIRMATION` until a human resolves
them. Turning ambiguity into a polished decision is memory corruption.

## Conflict handling

When a new meeting appears to reverse an existing decision, do not silently replace the
old text. Show both positions and establish whether the new decision supersedes the old
one. Preserve the change date and rationale so later readers can distinguish evolution
from contradiction.

## The empty result is valid

Some meetings share information or generate tasks without changing any durable
decision. In that case the correct wiki write is no write at all.

## Related skill

The `meeting-digest` skill in sociableSkills applies this rule to meeting notes and
transcripts, then delegates placement and indexing to `setwiki`.
