---
type: pattern
title: "Bounded stop/resume — 무한 loop가 아니라 receipt를 남기고 멈춘다"
description: "긴 agent run은 이름 붙은 경계에서 resume packet을 남기고 멈춰야 한다. 조용히 영원히 auto-resume하면 안 된다."
tags: [coding-agents, orchestration, persistence, verification, agent-safety]
date: 2026-07-13
source: original
relates: [ai-native/clear-vs-compact-vs-autocompact, ai-native/dynamic-workflow-anti-trigger]
---

# Bounded stop/resume

"계속해"에 대한 올바른 답은 무한 self-resume loop가 아닙니다. **bounded stop/resume protocol**입니다.
에이전트는 이름 붙은 경계에서 멈추고, 다음 run이 안전하게 이어갈 수 있을 만큼 상태를 남기고,
명시적 예산이나 사람의 명시적 지시가 있을 때만 resume합니다.

이 경계가 중요한 이유는 장시간 agent가 대개 지루한 방식으로 실패하기 때문입니다. context drift,
stale verification, 같은 blocker를 향한 반복 attempt, 그리고 최신 상태를 아무도 복원할 수 없는
background work입니다. auto-resume은 "새 attempt가 필요하다"를 "조용히 하나 더 시작했다"로
바꿔 실패를 가립니다.

## Stop packet

에이전트가 멈출 때는 짧은 packet을 남겨야 합니다.

- **Goal** — 사용자의 현재 요청을 한 문장으로.
- **State** — 끝난 일, 남은 일, 정확히 바뀐 파일.
- **Evidence** — 이미 돌린 command/test/smoke와 revision/worktree fingerprint.
- **Blockers** — 진짜 blocker만, attempt 횟수와 마지막으로 관측한 실패 포함.
- **Next action** — 다음 run이 가장 먼저 할 command나 edit.
- **Budget** — resume 뒤 허용되는 최대 시간, 토큰, retry, 또는 attempt.

이 packet이 handoff입니다. 이게 없으면 "resume"은 사실상 낡은 자신감을 들고 처음부터 다시 하는
것입니다.

## Resume 규칙

resume은 아래 중 하나일 때 허용됩니다.

1. 사람이 명시적으로 resume하라고 말한다.
2. harness가 미리 선언한 bounded continuation budget을 갖고 있다.
3. 결정론적 job runner가 기록된 state file에서 알려진 단계를 재시작한다.

resume의 유일한 이유가 "에이전트가 계속하고 싶어서"라면 허용하지 않습니다. attempt cap도, 수정된
hypothesis도, 새로운 evidence도 없는 loop는 실패를 증폭할 뿐입니다.

## Verification 규칙

evidence는 그것을 만든 revision과 attempt에만 유효합니다. resume된 run이 마지막 build, test,
MCP smoke, behavioral QA receipt 뒤에 파일을 고쳤다면, 그 receipt는 final artifact에 대해 stale합니다.
완료를 주장하기 전에 관련 check를 다시 돌려야 합니다.

## 실전 기본값

interactive coding agent라면 같은 blocker가 세 번 반복될 때, 선언한 budget을 다 썼을 때, 또는
깔끔한 handoff 경계에 도달했을 때 멈추세요. stop packet을 남기세요. resume할 때는 packet을 먼저
읽고, worktree fingerprint를 확인한 뒤, next action부터 이어가세요. 끈질겨 보이려고 unbounded
auto-resume mechanism을 구현하지 마세요.
