---
type: reference
title: "worktree 격리는 하네스 상태를 세 갈래로 나눕니다"
description: "git worktree가 막아 주는 것은 추적 파일 수정이지 세션 전체가 아닙니다. Claude Code에서 권한 승인과 메모리는 울타리를 넘고, gitignore된 개인 지침은 새 worktree로 따라오지 않으며, hook 경로는 처음 실행한 위치에 묶여 있습니다."
tags: [worktrees, parallel-agents, permissions, agent-memory, claude-code]
date: 2026-10-11
source: "External-derived — Claude Code worktree and memory docs, Anthropic power-user tips; see Sources."
relates: [ai-native/sandboxing-enables-autonomy, ai-native/agent-memory-architecture, ai-native/configured-is-not-effective, ai-native/harness-self-knowledge-version-skew]
---

## 한 줄 요약

요즘 병렬 에이전트 작업에서 가장 많이 듣는 조언은 "세션을 3~5개 동시에 띄우고, 세션마다 git worktree를 하나씩 쓰라"입니다. 여기에 몇몇 외부 가이드는 plan mode, 메모리, hook, 권한, transcript가 "원래 저장소가 아니라 전부 worktree에 붙는다"고 덧붙입니다. **Claude Code 공식 문서를 보면 이 목록 대부분이 사실과 다릅니다.** worktree가 격리하는 것은 *추적 중인 파일의 수정*입니다. 하네스 자체의 상태는 세 갈래로 나뉘고, 나뉘는 방식도 직관과 다릅니다.

| 갈래 | 들어 있는 것 | 결과 |
|---|---|---|
| **메인 checkout과 공유**(울타리를 넘음) | 자동 메모리(git 저장소 단위), `.git`, 프로젝트 범위 플러그인, **"다시 묻지 않기" 권한 승인**(*메인* checkout의 `.claude/settings.local.json`에 저장), 추적하지 않는 `.claude/skills`·`agents`·`commands`(worktree에 없으면 메인 것을 읽음) | 한 세션에서 내준 권한이나 배운 내용이 모든 형제 worktree에 적용되고, worktree를 지워도 남습니다 |
| **worktree마다 따로**(울타리 안에 남음) | 추적 파일, worktree 루트의 `CLAUDE.md`와 `.claude/rules/`, gitignore된 모든 파일(`.env`, **`CLAUDE.local.md`**, 단 `.worktreeinclude`로 복사한 것은 예외), transcript(세션의 현재 디렉터리 기준으로 기록) | 개인 지침과 비밀값이 새 세션에서 티 나지 않게 빠집니다 |
| **처음 실행한 위치에 고정** | hook 명령의 `${CLAUDE_PROJECT_DIR}`는 원래 루트에 머뭅니다(hook 입력의 `cwd`만 따라 움직입니다). 데스크톱 앱의 worktree 세션은 설정·hook·skill·`.mcp.json`을 메인 루트에서 읽습니다 | `CLAUDE_PROJECT_DIR`로 경로를 잡는 hook 스크립트는 지금 고치는 파일이 아니라 메인 checkout을 건드립니다 |

그래서 이렇게 생각하고 씁니다. **worktree는 추적 파일을 둘러싼 파일 시스템 울타리일 뿐, 세션 경계가 아닙니다.** 권한, 메모리, 개인 지침처럼 "이번 실험에서만" 쓰고 싶은 것은 각각 따로 정해야 합니다.

## "전부 worktree에 붙는다"는 말이 틀린 이유와 그 영향

그렇게 추론하기 쉬운 것은 사실입니다. worktree는 다른 디렉터리이고, transcript는 실제로 디렉터리 기준으로 기록됩니다. 하지만 영향 범위가 가장 큰 두 가지 상태는 일부러 저장소 단위로 묶여 있습니다.

1. **권한 승인은 저장소 전체로 퍼집니다.** 예전 버전에서는 worktree 안에서 내준 승인이 그 worktree에 저장되고 worktree와 함께 사라졌습니다. 그래서 버릴 worktree가 "다시 묻지 않기"를 눌러 보는 자연스러운 sandbox 역할을 했습니다. 지금은 메인 checkout의 로컬 설정에 저장됩니다. 실험용 worktree에서 `rm -rf build/`를 "항상 허용"으로 누르면 저장소 전체에 계속 남는 권한이 됩니다. 병렬 세션 N개가 쌓은 허용 목록은 그 N개를 모두 합친 것입니다.
2. **자동 메모리에는 여러 세션이 동시에 씁니다.** 한 저장소의 모든 worktree가 메모리 디렉터리 하나를 같이 씁니다. 병렬 세션 다섯 개가 각자 *자기* 브랜치에서 배운 내용을, 앞으로 모든 세션이 읽어 들일 같은 색인에 적습니다. 버려진 실험 브랜치에서만 맞던 교훈이 메인 작업의 배경 지식이 됩니다.

반대로 사람들이 *따라올 거라고 기대하는* 상태는 따라오지 않습니다.

3. **새 worktree에는 `CLAUDE.local.md`가 없습니다.** gitignore된 파일이라 새로 만든 checkout에는 빠져 있습니다. 공식 문서가 권하는 해결책은 개인 지침을 gitignore된 파일에 두지 말고, 홈 디렉터리에 있는 파일을 `@import`하는 것입니다. `.worktreeinclude`로 복사해 올 수도 있지만, 저장소마다 직접 설정해야 해서 대부분 해 두지 않았습니다.
4. **subagent의 worktree는 그 루트의 지침을 읽지 않습니다.** `isolation: worktree`로 띄운 subagent는 지침 파일을 부모 대화에서 받아 옵니다. 기본 worktree 위치에서는 그 브랜치가 worktree 루트의 `CLAUDE.md`나 `.claude/rules/`를 바꿨더라도 읽지 *않습니다*. 브랜치에서 규칙을 고친 뒤 격리된 subagent에게 검증을 맡기면, 실제로는 예전 규칙을 검증한 셈입니다.

## 격리 검사의 범위는 "격리"라는 말보다 좁습니다

세션이 worktree 안에 있는 동안 Claude Code는 메인 checkout을 겨냥한 Edit·Write, 작업 디렉터리가 메인 쪽인 Bash, 메인 쪽으로 향하는 git(`git -C`, `GIT_DIR`, `cd` 뒤의 git, 해석할 수 없는 명령 형태)을 막습니다. 다만 **shell 명령이 무엇을 쓰는지는 추적하지 않는다**고 문서에 분명히 적혀 있습니다. `cp file ../main/...`이나 메인 checkout을 향한 `>` 리디렉션은 이 검사를 통과하고, 일반 권한 규칙과 sandbox 규칙만 적용받습니다. 결국 울타리가 막는 것은 편집 도구, git, 작업 디렉터리입니다. 임의의 shell 명령이 쓰는 파일은 sandbox를 켰을 때만 막힙니다.

## worktree 세션 N개를 띄우기 전 확인 목록

```
[ ] 개인 지침은 CLAUDE.local.md에만 두지 않고 홈 디렉터리 파일을 @import한다
[ ] 각 세션에 필요한 gitignore 파일(.env, 로컬 설정)을 .worktreeinclude에 적었다
[ ] hook 스크립트는 수정 중인 파일 경로를 ${CLAUDE_PROJECT_DIR}가 아니라 hook 입력의 cwd로 잡는다
[ ] "다시 묻지 않기"는 저장소 전체에 주는 권한이라고 생각하고 누른다
[ ] 실험용 worktree에서 쌓인 자동 메모리가 메인에도 보인다고 가정하고,
    실험 뒤에 정리하거나 탐색용 세션에서는 자동 메모리를 끈다
[ ] 브랜치에서 CLAUDE.md나 규칙을 고쳤다면 격리된 subagent가 아니라 그 세션에서 검증한다
[ ] 편집과 git뿐 아니라 worktree 밖으로 향하는 shell 쓰기까지 막아야 하면 sandbox를 켠다
```

## 이 판단이 틀리는 경우

`WorktreeCreate` hook으로 Claude Code 기본 구조 밖에 worktree를 만드는 경우(git이 아닌 버전 관리 도구), Windows, 그 밖에 Claude Code가 저장소 루트를 쓰지 않는 경우에는 승인이 해당 worktree에 남고 transcript도 처음 실행한 디렉터리에 남습니다. 위의 세 갈래 구분은 macOS·Linux의 git worktree 기준입니다. 이 동작들은 문서상 버전마다 조건이 다르므로(2026년 10월 기준 대략 v2.1.198부터 v2.1.277 사이에 기준선이 흩어져 있습니다) 업그레이드한 뒤에는 다시 확인합니다.

## Sources

- Claude Code 문서, "Run parallel sessions with worktrees" — 메인 checkout과 공유하는 것, 격리 검사, subagent 지침 로딩, `.worktreeinclude`, hook의 `CLAUDE_PROJECT_DIR`와 `cwd`: https://code.claude.com/docs/en/worktrees
- Claude Code 문서, "How Claude remembers your project" — 자동 메모리는 저장소 단위이며 worktree끼리 공유합니다. `CLAUDE.local.md`는 그것을 만든 worktree에만 있으니 홈 디렉터리 `@import`로 공유합니다: https://code.claude.com/docs/en/memory
- Anthropic 지원 문서, "Claude Code power user tips" — 세션 3~5개를 각자 worktree에서 병렬로 실행: https://support.claude.com/en/articles/14554000-claude-code-power-user-tips
- "메모리·hook·권한이 worktree에 붙는다"는 주장을 반복하는 외부 worktree 가이드(claudefa.st, developersdigest.tech, 2026년 9~10월) — 이 글에서는 반례로 인용합니다.
