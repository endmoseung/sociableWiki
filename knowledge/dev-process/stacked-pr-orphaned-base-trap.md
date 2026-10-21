---
type: pattern
title: "The Stacked-PR Trap — Every PR Says Merged, Nothing Reached Main"
description: "Merging a stacked PR only moves commits into its base branch, so a stack whose bottom PR targets a stale branch merges into a dead end — check the default branch for the commits, not the Merged badge."
tags: [git, github, stacked-prs, code-review, ai-agents]
date: 2026-08-04
source: original
relates: [dev-process/completion-means-verification-output, ai-native/batch-pr-review-pipeline]
---

# The Stacked-PR Trap — Every PR Says Merged, Nothing Reached Main

I hit this for real in a personal project. A stack of three PRs (#8 → #9 → #12) was merged PR-into-PR, down the stack. The bottom PR's base was a feature branch whose own PR had already merged to `main` earlier. GitHub showed all three PRs as **Merged**. Meanwhile `origin/main` sat nine days behind, and none of the stack's six commits had landed on it.

Nobody noticed for twelve days, because a purple "Merged" badge reads as "shipped". It doesn't mean that. It means "these commits are now on the base branch" — and the base branch was a dead end.

## Why it happens

A PR merge does exactly one thing: it moves the head branch's commits into the **base branch**. In a stack, each PR's base is the PR below it, so merging top-down just folds the stack into the bottom PR's base. Whether anything reaches `main` depends entirely on what that bottom base is.

The bottom base goes stale in an ordinary way:

1. You open PR A (`feat/a` → `main`) and stack PR B on top (`feat/b` → `feat/a`).
2. PR A merges to `main`. The `feat/a` branch is left in place.
3. Later you add more commits to B, stack C on B, and merge the stack.
4. B merges into `feat/a`, which nothing will ever merge again.

GitHub does retarget dependent PRs automatically when the merged base branch is *deleted*. If the branch lingers, nothing retargets, and nothing warns you that you're merging into a branch with no future.

## Diagnosis: two commands

```bash
gh pr view <n> --json baseRefName,state,mergedAt     # where did it actually merge?
git log origin/main..origin/<top-of-stack> --oneline  # what never landed
```

If the bottom PR's `baseRefName` is anything other than `main`, and that base's own PR is already closed or merged, the stack is orphaned. The second command lists exactly the commits you thought you shipped.

## Prevention

- **Retarget the bottom PR to `main` before merging the stack**, then merge bottom-up. As each PR lands, GitHub retargets the next one onto `main` for you.
- **Turn on automatic head-branch deletion** for the repository. Once the merged base branch is deleted, its dependents get retargeted instead of left pointing at a dead branch.
- Merge bottom-up, not top-down. Top-down merging is what collapses the whole stack into a single base without ever touching `main`.

## Recovery

The commits are not lost. They live on the top-of-stack branch, which contains everything below it. Open one landing PR from that branch to `main`, review the combined diff, and merge it. In my case that was a single extra PR.

## The agent angle: the badge is not the receipt

This matters more once agents are opening and merging PRs for you. When a session reports "PR merged", the receipt to check is **`origin/main` containing the commit**, not the PR's state field. `state: MERGED` is true in the orphaned case too. A completion claim needs evidence that the change is where you meant it to go:

```bash
git fetch origin && git merge-base --is-ancestor <commit> origin/main && echo landed
```

Any automation that marks work as done on PR state alone will report this failure as a success.

## When this is the wrong check

- **Stacks that deliberately target an integration or release branch.** If your team lands work on `develop` or a release branch first, a base other than `main` is correct. The check then becomes "did that integration branch's own promotion happen", not "is the base `main`".
- **Stack-management tools that own retargeting.** Tools built for stacked diffs typically retarget and rebase the stack for you. The trap described here is specific to hand-managed stacks on plain GitHub PRs.
