---
type: pattern
title: "Review large changes by dependency cluster, not by file count"
description: "A large change stays understandable when files are grouped by imports, calls, shared contracts, and data flow so each reviewer sees a complete behavior slice."
tags: [ai-native, code-review, subagents, dependency-graph, pull-requests]
date: 2026-07-16
source: original
relates: [ai-native/independent-verification-of-review-findings, ai-native/batch-pr-review-pipeline]
---

# Review Large Changes by Dependency Cluster, Not by File Count

Large pull requests create a context-allocation problem. Reading every changed file in
one pass makes later files receive less attention. Splitting the list into equal chunks
fixes the size problem but can destroy the behavior being reviewed: a schema, its
adapter, its consumer, and its tests may land in four different chunks.

The useful review unit is therefore not a file or directory. It is a **dependency
cluster**: the smallest group of changed files that must be understood together to
reason about one behavior.

## The clustering rule

Build edges between changed files when they share a load-bearing relationship:

- one imports or calls the other,
- both depend on the same type, schema, constant, or generated client,
- one produces data the other consumes,
- one is a test or fixture for the other,
- both implement the same acceptance criterion.

Connected files form an initial cluster. If a cluster is still too large, split it at
a real interface boundary such as an API contract, message boundary, or exported
module. Do not split merely to make the file counts equal.

## Why directory-based splitting fails

Technical layers often separate code that changes together. A database migration may
live far from the reader it breaks. A route definition may be distant from the UI that
constructs the URL. A generated client may sit outside the feature that assumes its
response shape.

Reviewing by directory encourages local comments while hiding cross-file failures.
Dependency clustering trades neat ownership for behavioral completeness.

## Operating model

1. Map changed files and repository rules.
2. Build and show the cluster map.
3. Give each cluster a narrow, read-only review context.
4. Let reviewers read full files but comment only inside their assigned cluster.
5. Reconcile duplicate or cross-cluster findings centrally.

Tests stay with the implementation they exercise. Specifications stay attached to the
cluster implementing their acceptance criteria. Orphan configuration files join the
cluster whose runtime behavior they change.

## When this is the wrong tool

Do not cluster a small cohesive change; the coordination overhead costs more than it
saves. Do not use multiple reviewers when their outputs cannot be reconciled by a lead.
And do not confuse parallelism with correctness: clustering improves context quality,
but every resulting finding is still a claim that needs verification.

## Related skill

The `code-review-split` skill in sociableSkills turns this pattern into an executable
large-PR review workflow.
