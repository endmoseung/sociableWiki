---
type: reference
title: "Fork냐 fresh subagent냐: 격리가 정당화된 뒤에 오는 캐시 재사용 판단"
description: "spawn하기로 정했다면, 부모를 fork할지 fresh subagent를 띄울지는 능력이 아니라 prompt cache 경제성으로 갈린다."
tags: [subagents, fork-mode, prompt-caching, orchestration, token-economics]
date: 2026-06-09
source: original
relates: []
---

## 한 줄 요약

작업을 subagent로 격리할지 말지는 그 자체로 별개의 질문입니다. 여기엔 두 개의 관문이 있죠. 그 context를 버려도 되는가, 그리고 이 작업이 약 2~3K 토큰짜리 spawn 바닥값을 넘길 만큼 무거운가. 이 글이 다루는 건 **격리가 이미 정당화된 다음에야 열리는 세 번째 관문**입니다. spawn하기로 정했다면, 부모를 **fork**할 것인가 아니면 **fresh subagent**를 새로 띄울 것인가.

이 구분은 능력의 문제가 아니라 순수하게 캐시 경제성의 문제입니다.

- **Fork** = 자식이 부모의 system prompt와 tool 정의를 **바이트 단위로 그대로** 물려받습니다. 그래서 첫 요청이 **부모의 prompt cache에 hit**하고, 공유되는 앞부분(prefix)은 정가가 아니라 약 0.1배(10%)로 청구됩니다. 정가를 내는 건 새로 붙는 작업별 tail뿐이죠.
- **Fresh subagent** = system prompt가 다르고 대체로 tool 목록도 다릅니다. prefix가 어떤 캐시 항목과도 맞지 않으니, worker는 **바닥값을 정가로 다시 물고** 자기 context를 맨바닥부터 다시 긁어모읍니다.

제가 기본으로 삼는 규칙은 이렇습니다. **부모와 role이 같고 tool도 같다면 → fork. role이 진짜로 다르거나 tool 세트가 다르면 → fresh.** fork는 이미 정당화된 두 spawn 중 더 싼 쪽일 뿐이지, 원래 inline으로 해도 됐을 일을 굳이 spawn할 이유가 되지는 않습니다.

## 왜 cache prefix가 판을 전부 결정하는가

prompt caching은 안정적으로 맞아떨어지는 prefix를 input 가격의 10%로 청구합니다. 단, 캐시는 prefix를 **바이트 단위로 정확히 맞추거나, 아니면 아예 못 맞추거나** 둘 중 하나입니다. 이 all-or-nothing 매칭이야말로 fork-vs-fresh를 감이 아니라 진짜 판단거리로 만드는 지점입니다.

| | Fork | Fresh subagent |
|---|---|---|
| System prompt | 부모와 동일 → **cache hit** | 다름 → cache miss |
| Tool 정의 | 부모와 동일 → **cache hit** | 대체로 다름 → cache miss |
| Task tail | 새로 붙음, 정가 | 새로 붙음, 정가 |
| 실질 진입 비용 | 공유 prefix의 약 10% + tail | prefix 전액 + tail |

절약폭은 **공유하는 prefix가 얼마나 큰가**에 비례합니다. 긴 system prompt에 tool schema 20개를 얹은 무거운 부모는 prefix가 비쌉니다. 이걸 fork하면 자식마다 첫 턴에 그 prefix를 정가로 재처리하던 걸 10%로 바꿔줍니다. 반대로 가벼운 부모는 아낄 prefix 자체가 적어서, fork의 이점이 0에 가깝게 줄어듭니다.

## 바닥값 다음에 오는 관문으로서의 판단

이건 앞선 두 관문이 이미 "spawn하라"고 말한 **다음에만** 돌립니다.

1. **자식이 부모의 system prompt와 tool을 그대로 필요로 하는가?**
   그렇다 → **fork.** 작업을 격리하면서 prefix까지 10%로 가져갑니다.
   아니다(다른 전문가 role, 더 좁거나 다른 tool 목록) → **fresh.**
2. **자식이 부모의 checkout을 건드리면 안 되는 파일을 수정하는가?**
   그렇다 → worktree 격리를 건 fork(자식의 수정이 별도 git worktree에 떨어지도록). 이건 캐시 질문과는 별개 축입니다. fork 하나가 캐시도 재사용하고 자기 쓰기도 sandbox에 가둘 수 있습니다.

피해야 할 함정은 이겁니다. **원래 inline으로 했어야 할 작업을 "토큰 아끼겠다"며 fork하는 것.** fork도 어쨌든 spawn입니다. 여전히 latency 바닥값을 물고, context를 다시 긁는 tail 비용도 냅니다. 캐시 할인은 *prefix*에만 적용되지 cold-start 작업에는 적용되지 않으니까요. 그래서 fork-vs-fresh는 철저히 바닥값 관문의 *하류*에 있습니다. 바닥값 관문이 죽인 spawn을 되살리는 일은 절대 없습니다.

## multi-agent 비용 배수와의 연결

multi-agent 실행은 single agent 대비 대략 4~15배의 토큰을 쓰는 것으로 측정된 바 있고, 그 원인은 spawn 바닥값입니다. worker마다 고정 진입 비용을 다시 물고, 그 비용들이 **분할상환되지 않고 그냥 더해집니다.** fork mode는 이 비용을 *부분적으로* 분할상환해주는 유일한 지렛대입니다. 부모의 캐시된 prefix를 공유하니, fork 부대가 비싼 prefix를 정가로 내는 건 한 번(부모 자신의 턴)뿐이고 각 fork의 첫 턴은 약 10%만 냅니다. 정가를 N번 내는 대신에요. 배수를 없애주지는 못하지만, prefix가 무거운 부모에서는 눈에 띄게 꺾어줍니다. 같은 role을 fan-out하는 경우(동일 reviewer N개, 동일 file-reader N개)가 fork가 가장 크게 이득 보는 자리고, *서로 다른* 전문가들로 이뤄진 부대는 각자 자기 prefix가 필요해서 fork로 얻는 게 별로 없습니다.

## 한 줄 heuristic

두 spawn 관문이 "가라"고 한 다음: **자식이 부모에서 작업만 뺀 존재라면 fork, 자식이 아예 다른 agent라면 fresh.** cache prefix가 결정합니다. 그리고 그건 언제나 *이미 정당화된* spawn을 할인해줄 뿐입니다.
