---
type: deep-dive
title: "캐시가 깨지지 않는 하네스 설계 — \"prefix를 건드리지 마라\"라는 벤더 공통 규율"
description: 긴 agent 루프에서 prompt cache는 켜고 끄는 플래그가 아니라 매 턴 프롬프트를 어떻게 다시 조립하느냐에 달린 구조적 성질이다 — 캐시 히트는 설계로 지켜내는 것이고, 사소한 하네스 결정들이 매 턴 그걸 조용히 깨뜨린다.
tags: [prompt-caching, agent-harness, prefix-cache, latency, cost-optimization, mcp-tools]
date: 2026-06-10
source: "'Don't Break the Cache' arXiv 평가(2601.06007), Unsloth의 changing-header 발견, OpenAI Codex의 prefix 규율을 종합 — Sources 참고."
relates: [ai-native/fork-vs-fresh-subagent]
---

## 한 줄 요약

prompt caching은 보통 "API 비용 최적화" 항목으로 분류됩니다. 켜기만 하면 되는 스위치처럼요.
그런데 2026년의 관점은 다릅니다. 긴 agent 루프에서 캐시는 **매 턴 프롬프트를 어떻게 조립하느냐에
달린 구조적 성질**이지, 플래그가 아닙니다. 전체를 지배하는 규칙은 딱 하나입니다. *prefix에 무언가
바뀌면 그 뒤는 전부 무효화된다.* 그래서 캐시 히트는 **설계로 지켜내야 하는 것**이고, 선의로
내린 자잘한 하네스 결정들(tool 순서 재배치, 매번 새 timestamp 주입, compaction 때 system
prompt 재조립)이 매 턴 그걸 조용히 깨뜨립니다. 이 글은 특정 벤더에 얽매이지 않는 규율입니다 —
"수정하지 말고 append하라, 잘 바뀌는 건 맨 뒤로, tool 결과는 캐시에서 빼라". 그리고 이제
왜 여기에 실측 숫자가 붙었는지도 함께 봅니다. Claude의 *문법*(`cache_control`, TTL,
`defer_loading`)은 이보다 한 층 아래고, 이 글은 그 위층입니다. 벤더가 무엇이든 상관없이 지켜야
할 원칙이요.

---

## 왜 API 문제가 아니라 하네스 문제인가

동작 원리는 Claude, OpenAI Codex, 로컬 prefix-caching 백엔드(vLLM / SGLang의 KV-cache
재사용)에서 모두 같습니다. 엔진은 요청에서 **이미 계산해 둔 것과 가장 길게 일치하는 prefix**를
찾아 그 부분의 연산을 재사용합니다. prefix 순서는 늘 같은 모양(`tools → system → messages`)이고,
규칙은 잔인하리만치 단순하며 어디서나 통합니다.

> **prefix 안 어디든 토큰 하나만 달라져도 그 지점부터 캐시가 전부 무효화된다.** 5,000 토큰짜리
> system prompt에서 글자 하나만 바뀌면 5,000 토큰을 다시 계산한다.

그래서 캐싱은 agentic AI가 **가장 크게 이득 보는** 케이스입니다 — 코딩 agent는 한 세션에 tool
call을 30~50번 넘게 돌리면서 큰 stable prefix를 매 턴 다시 보내니까요. 동시에 하네스가 그
prefix를 조용히 바꿔치기하면 **가장 크게 손해 보는** 케이스이기도 합니다. 비용 레버는 실재합니다.
캐시를 많이 쓰는 워크로드에서 캐싱은 쓸 수 있는 가장 큰 레버(70~90% 절감)입니다. 놓치기 쉬운
나머지 절반은, 이걸 "켠다"가 아니라 매 턴 **깨뜨리지 않는다**로 접근해야 한다는 겁니다.

---

## 실측 근거 (2026년 1월): 무지성 full-context 캐싱은 오히려 *더 나쁠* 수 있다

"Don't Break the Cache"(arXiv 2601.06007)는 long-horizon agentic 태스크를 여러 provider에
걸쳐 처음으로 평가한 연구입니다(OpenAI GPT-5.2/GPT-4o, Anthropic Claude Sonnet 4.5,
Google Gemini 2.5 Pro). 대표 수치는 이렇습니다.

- **비용 절감: provider 전반에서 41~80%**
- **TTFT(time-to-first-token) 개선: provider 전반에서 13~31%**

그런데 의사결정을 뒤흔드는 발견은 직관에 어긋나는 쪽입니다.

> **system-prompt만 캐싱하는 게 무지성 full-context 캐싱을 이긴다** — 비용과 latency 양쪽 모두,
> 게다가 *더 일관되게*.

"전부 캐싱"은 오히려 **latency를 악화시킬 수 있습니다.** 동적인 tool call과 결과가 세션 간에
절대 재사용되지 않을 내용에 대해 캐시 *쓰기*를 유발하기 때문입니다 — 쓸모없는 데이터에 1.25~2배의
쓰기 프리미엄을 무는 셈이죠. 가장 날카로운 데이터 포인트: GPT-4o는 system-prompt만 캐싱했을 때
**TTFT가 +30.9% 개선**됐지만, full-context로 캐싱하자 **−8.8%로 오히려 퇴보**했습니다.
해법은 "더 많이 캐싱"이 아니라 경계 배치입니다. **stable head를 캐싱하고, 동적인 내용은 system
prompt 맨 끝으로 몰고, tool 결과는 명시적으로 제외하라.**

그러니 "더 캐싱해야 하나?"는 틀린 질문입니다. 맞는 질문은 "**내 마지막 stable 토큰은 어디고, 내
breakpoint가 그 위에 찍혀 있나?**"입니다.

---

## 세 가지 불변식 (벤더 무관)

직접 하네스를 짜든, Claude API를 쓰든, SGLang 뒤에서 로컬 모델을 돌리든 모두 성립합니다.

1. **수정하지 말고 append하라.** 실행 도중 설정이 바뀌면(작업 디렉토리 변경, approval 모드 전환,
   메모리 로드 등) 이전 메시지를 고치거나 system prompt를 재조립하지 말고 **바뀐 내용을 담은 새
   메시지를 append**하세요. OpenAI의 Codex CLI는 이걸 일급으로 다룹니다. system 지시, tool
   정의, 샌드박스 설정, 환경 컨텍스트를 요청 사이에 바이트 단위로 동일하게, 순서까지 똑같이
   유지하고, 런타임 변경분은 append합니다. "깔끔하게 하려고" prefix를 손대는 것이 전형적인
   자충수입니다.

2. **잘 바뀌는 내용은 맨 뒤로.** 유저 입력, 요청마다 다른 값, 세션 고유 데이터 — 턴 사이에 달라지는
   건 뭐든 cache breakpoint *뒤에* 놓아야지, 앞에 놓으면 안 됩니다. 프롬프트 위쪽에 박힌
   timestamp나 session ID는 매 턴마다 캐시를 깨뜨리는 지뢰입니다.

3. **tool 표면(surface)을 안정적으로 유지하라.** tool 정의를 추가·삭제·재배치하면 그 tool부터
   prefix가 무효화됩니다. 이건 **동적 MCP tool discovery**와 정면충돌합니다 — 연결된 server에
   따라 사용 가능한 tool 집합이 달라지니까요. 탈출구는 deferred tool loading입니다(예: Claude의
   `defer_loading` / Tool Search Tool). 작은 고정 코어만 캐싱된 prefix에 두고, 발견된 tool은
   prefix를 건드리지 않는 appended reference로 불러오는 거죠. 이 규칙의 일반형은 이렇습니다.
   *재사용 가능한 고정 tool 집합 + code-gen을 통한 동적 능력*이, 턴마다 바뀌는 tool 목록을
   이깁니다.

---

## 외워둘 만한 함정: 헤더가 바뀌어서 캐시를 깨는 케이스

가장 비싼 cache miss는 눈에 안 보이는 miss입니다. 내 프롬프트보다 상류(upstream)에서 벌어지거든요.
2026년 3월 초, Unsloth 팀은 **Claude Code(2026년 1월 이후 빌드)가 메시지마다 attribution
헤더**(session ID / 턴 카운터 / timestamp를 실은)를 **모든 메시지 맨 앞에** 붙이고 있다는 걸
발견했습니다. 그 바뀌는 텍스트가 prefix 맨 앞에 앉아 있었기 때문에, 그 경로로 요청하는 모든
사람에게 **매 턴 캐시가 무효화**됐습니다. 내 프롬프트에는 아무 문제가 없었는데, 내 앞에 있던
하네스가 byte 0을 바꿔치기하고 있던 거죠.

이건 파일로 남겨둘 만한 디버깅 지문입니다. **"stable"한 프롬프트인데도 cache hit rate가 0에
가깝다 → prefix 맨 앞에 변하는 값을 주입하는 무언가가 있다.** 의심 순서는 이렇습니다. system
prompt 안의 timestamp/UUID, 재배치된 tool 배열, 대화 중간의 system-prompt 재조립(메모리 주입이나
compaction 단계가 유발하는 경우가 많습니다), 그리고 내가 통제 못 하는 상류 하네스 헤더. provider의
cache 진단 기능(예: `cache_miss_reason` 필드)은 바로 그 어긋난 지점을 짚어주려고 있습니다 —
추측하기 전에 그걸 먼저 쓰세요.

---

## compaction 충돌 (덜 알려진 덫)

좋은 관행 두 개가 서로 싸웁니다. long-horizon에서 흔한 조언은 *캐시가 따뜻할 때 일찍 compaction
하라*입니다. 그런데 compaction은 **메시지 히스토리를 다시 씁니다** — 이게 바로 캐시를 날려버리는
prefix 변형입니다. 이 둘을 화해시키는 방법은 이렇습니다.

- compaction은 새는 것(leak)이 아니라 **의도적이고 계산된 캐시 리셋**입니다. 재계산 한 번을 온전히
  치르는 대신, *다음* 백 턴 동안 더 작고 싼 prefix를 사는 겁니다. 스텝 중간이 아니라 자연스러운
  경계(태스크 전환)에 맞춰 실행하세요.
- 절대 하면 안 되는 건 조용한 버전입니다. system prompt를 "N턴마다" 자동 재조립하는 메모리 레이어는
  대응하는 이득도 없이 N턴마다 캐시를 깨뜨립니다 — 2026년에 실제로 여러 agent 프레임워크에 제기된
  버그입니다. *결정*이 있을 때 재조립하되, *타이머*로는 절대 하지 마세요.

이건 fork-vs-fresh subagent 선택을 지배하는 것과 같은 경계입니다. 따뜻한 prefix를 유지하려면
fork하고, 새 컨텍스트가 cold start를 감수할 만큼 가치 있을 때만 fresh로 가세요.

---

## 그래서 뭘 하면 되나 — 체크리스트

- **먼저 측정하라.** 무엇이든 최적화하기 전에 `cache_read` 대 `cache_creation`(또는 쓰는
  백엔드의 hit-rate 지표)을 먼저 보세요. "stable"한 프롬프트인데 read가 0에 가깝다 = 튜닝 문제가
  아니라 prefix 변형 범인 색출입니다.
- **기본값은 system-prompt만 캐싱**으로, cache-everything이 아닙니다. arXiv 근거는 무지성 최대치가
  오히려 latency를 갉아먹을 수 있다고 말합니다.
- **설정 바뀌면 append. 잘 바뀌는 건 맨 뒤. tool은 고정.** 위 세 불변식은 벤더 무관이고,
  거기에 대응하는 벤더별 문법은 각 벤더의 caching 문서에 있습니다.
- **compaction은 예산 잡힌 리셋으로 다뤄라.** 턴 타이머가 아니라 태스크 경계에서 실행하세요.
- **tool 라이브러리가 100개를 넘어가면** deferred/searched tool loading에 기대서, 동적 discovery가
  캐싱된 prefix를 건드리지 않게 하세요.

---

## Sources

- [Don't Break the Cache — long-horizon agentic prompt caching eval (arXiv 2601.06007)](https://arxiv.org/abs/2601.06007)
- [Prompt caching for AI agents — boundaries without breaking context](https://medium.com/@arvisionlab/prompt-caching-for-ai-agents-how-to-cut-cost-and-latency-without-breaking-context-245dc2502b4b)
- [Unsloth: Claude Code changing-header cache invalidation finding (Mar 2026)](https://thinksmart.life/research/posts/kv-cache-local-inference/)
- [OpenAI Codex append-don't-modify prefix discipline](https://developers.openai.com/cookbook/examples/prompt_caching_201)
