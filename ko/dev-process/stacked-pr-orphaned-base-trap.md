---
type: pattern
title: "Stacked PR 함정: 전부 Merged인데 main에는 아무것도 없습니다"
description: "stacked PR을 머지하면 커밋은 base 브랜치로만 옮겨지므로, 맨 아래 PR이 낡은 브랜치를 base로 삼고 있으면 스택 전체가 막다른 곳으로 머지됩니다. Merged 배지가 아니라 기본 브랜치에 커밋이 있는지를 확인합니다."
tags: [git, github, stacked-prs, code-review, ai-agents]
date: 2026-08-04
source: original
relates: [dev-process/completion-means-verification-output, ai-native/batch-pr-review-pipeline]
---

# Stacked PR 함정: 전부 Merged인데 main에는 아무것도 없습니다

개인 프로젝트에서 실제로 겪은 일입니다. PR 세 개를 쌓은 스택(#8 → #9 → #12)을 위에서부터 PR끼리 차례로 머지했습니다. 그런데 맨 아래 PR의 base는 feature 브랜치였고, 그 브랜치의 PR은 이미 한참 전에 `main`으로 머지된 상태였습니다. GitHub는 세 PR을 모두 **Merged**로 보여 줬습니다. 그사이 `origin/main`은 9일 전 상태에 머물러 있었고, 스택의 커밋 여섯 개 중 하나도 들어가지 않았습니다.

12일 동안 아무도 몰랐습니다. 보라색 "Merged" 배지는 "배포됐다"로 읽히기 때문입니다. 실제 뜻은 그게 아닙니다. "이 커밋들이 이제 base 브랜치에 있다"는 뜻이고, 그 base 브랜치가 막다른 길이었습니다.

## 왜 이런 일이 생기나

PR 머지가 하는 일은 딱 하나입니다. head 브랜치의 커밋을 **base 브랜치**로 옮기는 것입니다. 스택에서는 각 PR의 base가 바로 아래 PR이므로, 위에서부터 머지하면 스택 전체가 맨 아래 PR의 base로 접혀 들어갈 뿐입니다. `main`에 뭔가 닿는지는 전적으로 그 맨 아래 base가 무엇이냐에 달려 있습니다.

맨 아래 base는 아주 평범한 과정으로 낡습니다.

1. PR A(`feat/a` → `main`)를 열고, 그 위에 PR B(`feat/b` → `feat/a`)를 쌓습니다.
2. PR A가 `main`에 머지됩니다. `feat/a` 브랜치는 지우지 않고 그대로 둡니다.
3. 나중에 B에 커밋을 더 얹고, B 위에 C를 쌓은 뒤 스택을 머지합니다.
4. B는 `feat/a`로 머지되는데, `feat/a`는 앞으로 어디에도 다시 머지되지 않습니다.

GitHub는 머지된 base 브랜치가 *삭제되면* 그 브랜치를 바라보던 PR의 base를 자동으로 바꿔 줍니다. 브랜치가 남아 있으면 아무것도 바뀌지 않고, 앞날이 없는 브랜치로 머지하고 있다는 경고도 없습니다.

## 진단: 명령 두 줄

```bash
gh pr view <n> --json baseRefName,state,mergedAt     # 실제로 어디에 머지됐나?
git log origin/main..origin/<top-of-stack> --oneline  # main에 끝내 안 들어간 커밋
```

맨 아래 PR의 `baseRefName`이 `main`이 아니고, 그 base의 PR이 이미 닫혔거나 머지됐다면 스택은 고아가 된 것입니다. 두 번째 명령은 배포했다고 믿었던 커밋을 정확히 보여 줍니다.

## 예방

- **스택을 머지하기 전에 맨 아래 PR의 base를 `main`으로 바꾸고**, 아래에서부터 머지합니다. PR이 하나씩 들어갈 때마다 GitHub가 다음 PR의 base를 `main`으로 옮겨 줍니다.
- **저장소에서 head 브랜치 자동 삭제를 켭니다.** 머지된 base 브랜치가 지워지면, 그 위에 쌓인 PR은 죽은 브랜치를 가리킨 채 남지 않고 base가 바뀝니다.
- 위에서부터가 아니라 아래에서부터 머지합니다. 위에서부터 머지하면 `main`은 한 번도 건드리지 않은 채 스택 전체가 base 하나로 뭉쳐 버립니다.

## 복구

커밋은 사라지지 않았습니다. 스택 맨 위 브랜치에 아래 내용까지 전부 들어 있습니다. 그 브랜치에서 `main`으로 가는 PR을 하나 열고, 합쳐진 diff를 리뷰한 뒤 머지합니다. 제 경우에는 PR 하나를 더 여는 것으로 끝났습니다.

## 에이전트 관점: 배지는 영수증이 아닙니다

에이전트가 PR을 열고 머지까지 맡게 되면 이 문제가 더 커집니다. 세션이 "PR 머지했습니다"라고 보고하면, 확인할 영수증은 PR의 상태 필드가 아니라 **`origin/main`에 그 커밋이 들어 있는지**입니다. 고아가 된 스택에서도 `state: MERGED`는 참입니다. 완료를 주장하려면 변경이 원래 가야 할 곳에 도착했다는 증거가 있어야 합니다.

```bash
git fetch origin && git merge-base --is-ancestor <commit> origin/main && echo landed
```

PR 상태만 보고 작업을 완료로 표시하는 자동화는 이 실패를 성공으로 보고합니다.

## 이 확인이 맞지 않을 때

- **일부러 통합 브랜치나 릴리스 브랜치를 겨냥한 스택.** 팀이 작업을 `develop`이나 릴리스 브랜치에 먼저 넣는다면, base가 `main`이 아닌 게 정상입니다. 이때 확인할 것은 "base가 `main`인가"가 아니라 "그 통합 브랜치가 다음 단계로 올라갔는가"입니다.
- **스택 관리 도구가 base 변경을 맡는 경우.** stacked diff용 도구는 대개 스택의 base 변경과 rebase를 알아서 처리합니다. 여기서 다룬 함정은 평범한 GitHub PR로 스택을 손수 관리할 때의 이야기입니다.
