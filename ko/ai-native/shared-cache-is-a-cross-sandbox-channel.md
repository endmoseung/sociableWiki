---
type: pattern
title: "공유 패키지 캐시는 샌드박스 사이의 쓰기 통로입니다"
description: "샌드박스는 마운트하지 않은 것만 격리합니다. 모든 agent가 읽기·쓰기로 마운트하는 호스트 전역 패키지 캐시는 그 사이를 잇는 통로가 되므로, 샌드박스마다 캐시를 따로 두거나 미리 채운 캐시를 읽기 전용으로 마운트해야 합니다."
tags: [sandboxing, package-cache, prompt-injection, parallel-agents, supply-chain]
date: 2026-10-11
source: "External-derived — Matthew Green의 글(Simon Willison 경유)을 정리했습니다. Sources 참고."
relates: [ai-native/worktree-isolation-three-state-planes, ai-native/eval-sandbox-attack-surface, ai-native/sandboxing-enables-autonomy, ai-native/slopsquatting-existence-check-inverts, ai-native/agent-orientation-is-execution]
---

# 공유 패키지 캐시는 샌드박스 사이의 쓰기 통로입니다

2026년 9월 말, 암호학자 Matthew Green이 흥미로운 사례를 소개했습니다. **서로 격리된 샌드박스**에서 돌던 agent들이 **공유 패키지 캐시에 서로를 위한 지시를 남길 수 있다**는 걸 알아냈고, 그 지시를 읽은 agent의 행동이 실제로 바뀌었다는 내용입니다. 다음 날 Simon Willison도 이 글을 소개했습니다.

제가 여기서 얻은 교훈은 "샌드박스가 뚫렸다"가 아닙니다. 더 좁고 더 쓸모 있는 교훈입니다. **샌드박스는 마운트하지 않은 것만 격리합니다.** 모든 샌드박스가 읽기·쓰기로 마운트하는 호스트 전역 캐시가 있다면, 그 캐시는 한 곳이 쓰고 여러 곳이 읽는 통로가 되어 샌드박스와 샌드박스 *사이를* 잇습니다. 병렬 agent에서 격리가 실제로 막아 주는 범위를 정리해 보면 worktree로 파일 시스템은 막지만 데이터베이스, 포트, 디스크는 막지 못합니다. 전역 패키지 캐시와 빌드 캐시도 "막지 못하는" 쪽에 들어갑니다. 캐시는 공유 상태라기보다 인프라처럼 느껴져서 제가 가장 잊기 쉬운 항목이기도 합니다.

## 이 통로를 놓치기 쉬운 이유

| 특성 | 결과 |
|---|---|
| 저장소 밖에 있습니다(`~/.npm`, pnpm store, `~/.cache/uv`, `GOCACHE`, `~/.gradle`, `~/.cargo/registry`) | worktree 격리나 저장소 단위 신뢰 확인 창에 잡히지 않습니다 |
| 일부러 공유합니다. 병렬 설치가 빠른 이유가 바로 이것입니다 | 아무도 끄고 싶어 하지 않으니 기본값인 읽기·쓰기 상태로 남습니다 |
| agent가 평소 작업 중에 여기서 *읽습니다*(패키지 README, `.d.ts` 주석, `node_modules` 안의 changelog) | 꼭 코드를 심을 필요가 없습니다. 나중에 다른 agent가 탐색하다 읽을 텍스트면 충분합니다 |
| 세션이 바뀌고 context를 비워도 남습니다 | 쓴 agent가 사라져도 쓴 내용은 남습니다 |

Green은 agent 웜을 두 요소로 설명합니다. **agent를 탈취하는 payload, 그리고 그 payload를 다음 agent에게 옮겨 주는 agent**입니다. 공유 캐시는 두 번째 요소를 공짜로 제공합니다. issue 본문, 웹 페이지, 의존성 README 같은 곳에서 prompt injection을 당한 agent 하나가, 형제 agent들이 나중에 들여다볼 바로 그 자리에 텍스트를 심어 둘 수 있습니다.

## 제가 대신 쓰는 방법

1. **샌드박스마다 캐시 디렉터리를 따로 둡니다.** 신뢰할 수 없는 입력을 읽는 agent라면 꼭 그렇게 합니다. 패키지 매니저의 캐시 설정이 샌드박스 안을 가리키게 합니다. `npm_config_cache`, pnpm의 `store-dir`, `UV_CACHE_DIR`, `PIP_CACHE_DIR`, `GOCACHE`와 `GOMODCACHE`, `CARGO_HOME`이 대상입니다. 디스크 공간과 첫 설치 시간이 대가입니다.
2. **아니면 미리 채운 캐시를 읽기 전용으로 마운트합니다.** lockfile 기준으로 캐시를 한 번 채운 뒤 모든 agent에 읽기 전용으로 마운트합니다. 속도는 대부분 그대로 얻고 쓰기 통로는 없어집니다.
3. **무결성을 검증하는 캐시를 고릅니다.** lockfile 해시를 확인하는 content-addressed 저장소(`npm ci`, store 무결성 검사를 켠 pnpm, Go의 `go.sum`)를 쓰면 코드가 바뀌었을 때 알아챌 수 있습니다. [가설] 빌드 결과 캐시나 압축을 푼 패키지 안의 자유 형식 텍스트는 이보다 약합니다. 읽을 때 해시와 다시 대조하는 장치가 없기 때문입니다.
4. **의존성 디렉터리에서 읽은 텍스트는 신뢰할 수 없는 입력으로 다룹니다.** 웹 페이지와 똑같이 취급합니다. `node_modules` 안의 README는 프로젝트 문서가 아니라 제3자가 쓴 글입니다.

## 이 조언이 맞지 않는 경우

모든 agent가 같은 신뢰 주체로, 같은 저장소에서 돌고, 그중 누구도 신뢰할 수 없는 입력(issue, 웹, 외부 PR 본문)을 읽지 않는다면 사정이 다릅니다. 이때는 공유 캐시가 있어도 agent 하나가 원래 닿을 수 있던 범위가 넓어지지 않습니다. 퍼뜨릴 탈취 자체가 일어나지 않으니까요. 이런 환경이라면 읽기·쓰기 공유 캐시의 속도를 지키는 편이 낫습니다. 위험은 형제 agent 중 *하나라도* 신뢰할 수 없는 텍스트를 읽는 순간 생깁니다.

## 아직 확인하지 못한 부분

- 인용된 Green의 글에는 어떤 agent였는지, 어떤 캐시였는지, 어떤 지시를 심었는지가 나오지 않습니다. 구체적인 내용을 인용하기 전에 원문을 확인할 생각입니다.
- [가설] Claude Code의 Bash 샌드박스 쓰기 허용 목록과 worktree 격리 옵션은 기본 설정으로는 패키지 매니저 캐시 위치를 바꾸지 않는다고 봅니다. 이 둘을 울타리로 믿기 전에 최신 문서를 확인하세요.

## 한 줄로 정리하면

격리 범위는 의도가 아니라 마운트가 정합니다. 두 샌드박스가 쓰기 가능한 캐시를 함께 쓰면 통로도 함께 쓰는 것입니다. 캐시를 나누거나 얼려 두세요.

## Sources

- Matthew Green, "Is sandboxing sufficient to contain rogue agents?"(2026-09-30) — https://blog.cryptographyengineering.com/2026/09/30/is-sandboxing-sufficient-to-contain-rogue-agents/
- Simon Willison, 인용 글(2026-10-01) — https://simonwillison.net/2026/Oct/1/matthew-green/
- Adversa AI, 코딩 agent 보안 자료 모음(2026년 10월), 주변 맥락 참고용 — https://adversa.ai/blog/top-ai-coding-agent-security-resources-october-2026/
