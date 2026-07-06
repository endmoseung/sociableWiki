---
type: deep-dive
title: "Fan-out 너비에는 천장이 둘 있다 — 비용은 선형, 3~5를 정하는 건 synthesis fidelity다"
description: "'subagent 3~5개 띄워라'라는 흔한 규칙은 토큰 비용이 아니라 lead가 갈라진 결과를 합쳐내는 능력이 정한다. 그리고 이 규칙은 결과를 하나의 답으로 합쳐야 할 때만 걸린다."
tags: [subagent, fan-out, orchestration, multi-agent, synthesis, cost]
date: 2026-06-25
source: "Anthropic 멀티에이전트 리서치 글 + 실무자 보고 종합, 프레이밍은 자체 정리"
relates: []
---

## 한 줄 요약

지금까지 본 fan-out 비용 노트는 전부 너비의 **돈** 쪽만 값을 매깁니다. spawn 한 번당
바닥 비용, topology별 배수, 놀고 있는 wall-clock, 그리고 orchestrator에 결과가 쌓이는
지점까지요. 하나같이 결론은 같습니다 — 너비가 커질수록 fan-out은 **더 비싸진다**. 그런데
정작 `parallel(...)`을 칠 때 마주하는 질문에는 아무도 답하지 않습니다.

> *"6번째, 8번째, 20번째 worker를 더 붙였는데 — 돈을 더 낼 마음이 있어도 — 왜 **답이 더
> 좋아지지 않지?"*

이 노트가 바로 그 축입니다. **fan-out에는 서로 독립된 천장이 둘 있습니다.**

| 천장 | 무엇이 걸리나 | 모양 | 무엇이 정하나 |
|---|---|---|---|
| **비용** | 토큰 / 쿼터 | worker 수에 대략 선형 (6개 ≈ 단일 세션 6배) | rate limit + 예산 |
| **Synthesis fidelity** | 답의 품질 | 작은 N을 넘기면 **초선형으로** 나빠짐 | lead가 갈라진 결과를 합쳐내는 능력 |

흔히 말하는 **"subagent 3~5개"**는 **fidelity** 천장이지 **비용** 천장이 아닙니다. 토큰
예산에 닿기 한참 전에 여기부터 부딪힙니다. 그리고 이 천장이 애초에 걸리느냐 마느냐를
가르는 갈림길이 하나 있는데, 이걸 적어두는 사람이 드뭅니다 — **결과가 서로 독립적인가,
아니면 하나의 답으로 합쳐야 하는가?**

---

## 천장 둘, 그리고 서로 다른 구간에서 걸리는 이유

**비용은 심심한 천장입니다.** 대략 선형이고 오는 게 보입니다. Anthropic이 직접 낸
멀티에이전트 수치를 보면, *"에이전트는 보통 챗 대비 토큰을 약 4배 쓰고, 멀티에이전트
시스템은 챗 대비 약 15배 쓴다"*고 합니다. 실무자 보고는 worker당 기울기를 대략 선형으로
정리합니다 — *"sub-agent 6개면 단일 세션 토큰의 약 6배"*. 비용이 유일한 천장이라면 규칙은
"예산과 rate limit이 허락하는 만큼 띄워라"가 될 테고, 수백 개까지 fan-out하는 기능은 그냥
"돈을 더 써라"는 뜻일 겁니다. 어떤 작업에선 실제로 그렇습니다 — 아래 갈림길을 보세요.

**정작 3~5를 정하는 건 fidelity 천장입니다.** lead는 N개의 결과에 **돈만** 내는 게
아닙니다. 갈라진 N개의 요약을 **읽고, 충돌을 풀고, 하나의 일관된 답으로 압축**해야 하고, 이
일은 N이 커질수록 단지 비싸지는 게 아니라 **더 어려워집니다**. 초선형으로 나빠지는 기계적인
이유가 둘 있습니다.

1. **lead는 worker를 동기(synchronous)로 돌리고, 도중에 방향을 틀어줄 수 없습니다.**
   Anthropic 원문 그대로: *"현재 우리 lead agent는 subagent를 동기로 실행해, 각 subagent
   묶음이 끝날 때까지 기다린 뒤에야 다음으로 넘어간다"* — 그리고 그 결과 — *"lead agent가
   subagent를 조종할 수 없고, subagent끼리 협응할 수 없으며, subagent 하나가 끝나기를
   기다리는 동안 시스템 전체가 막힐 수 있다."* 그래서 lead는 fan-out 전체를 **미리, 눈 감고**
   커밋해버리고, 갈라짐은 merge 시점에야 봅니다. worker가 많아질수록 둘이 서로 양립 못 하는
   길로 빠질 확률이 커지고, lead는 그걸 사후에 수습해야 합니다 — 도중에 어느 쪽도 바로잡지
   못한 채로요.

2. **reconciliation은 고정된 lead 예산 안에서의 N대1 압축입니다.** worker마다 *"lead
   research agent를 위해 가장 중요한 토큰을 응축"*합니다. 그게 기능인 건 맞지만, lead 자신의
   window와 주의력은 유한합니다. 결과가 몇 개를 넘어가면 lead는 **이미 손실된 요약을 또
   손실 압축**하는 셈이고, 이때의 실패 양상이 **hallucinated consensus** — worker들 사이의
   진짜 이견을 매끈하게 뭉개 가짜 합의로 만들어버리는 것입니다. 8번째 worker는 신호를
   1/8만큼 더해주는 게 아니라, 늘어나지 않은 예산 위에서 lead가 떨어뜨리면 안 되는 항목을
   하나 더 얹습니다.

정리하면, 비용은 "20개 돌려도 된다"고 말합니다. fidelity는 "lead가 20개를 충실하게 **합칠
수는** 없다"고 말합니다. 더 작은 숫자가 이깁니다. 합쳐야 하는(reconciled) 작업에선 그게
대략 3~5입니다 (코딩 fan-out은 rate limit과 merge 비용이 지배하기 전까지 3~8까지 늘어납니다
— 측정치가 아니라 실무자 범위).

---

## 핵심 갈림길: 독립적인 결과 vs. 합쳐야 하는 결과

"3~5" 천장은 **결과를 하나의 답으로 합쳐야 할 때만 걸립니다.** 수백 개까지 띄우는 능력이
*당신의* 작업에 적용되는지를 가르는 구분이 바로 이겁니다.

| | **합쳐야 하는(reconciled) 결과** | **독립적인(independent) 결과** |
|---|---|---|
| merge에서 lead가 하는 일 | 갈라진 N개의 발견을 하나의 일관된 답으로 엮음 | N개의 자족적 결과를 N개의 자리로 라우팅, 교차 merge 없음 |
| 너비가 만드는 실패 양상 | hallucinated consensus, 이견 누락, 손실 재압축 | 너비발 실패 없음 — 결과마다 홀로 선다 |
| 너비 천장 | **fidelity로 묶임, ~3~5** | **비용/rate-limit으로 묶임, 수십~수백** |
| 예시 | "여러 소스로 X를 조사해서 답을 달라"; "이 diff를 5개 렌즈로 리뷰해 하나의 판정으로" | "모델×프롬프트 80조합 벤치마크 돌려라"; "200개 파일을 각각 독립 변환해라" |
| spawn 상한을 늘리면 천장이 올라가나? | **아니오** — 올라가는 건 *spawn*이지 *synthesis*가 아니다 | **예** — 정확히 이게 sweet spot |

Anthropic은 경계를 직접 말합니다. 멀티에이전트는 *"무거운 병렬화가 필요한 가치 있는 작업에
탁월"*하지만, *"모든 에이전트가 같은 context를 공유해야 하거나 에이전트 간 의존이 많은 일부
도메인에는 잘 맞지 않는다."* 한 겹 더 파고들어 읽으면, 잘 맞는 경우는 **독립적인 결과**이고
안 맞는 경우는 **빡빡한 reconciliation**입니다. fan-out을 수백 개로 키우는 것(예: 80조합
벤치마크 sweep)은 *독립적인 결과* 열입니다 — 결과마다 자기 칸에 떨어지고 아무것도 합쳐지지
않으니, 부딪힐 fidelity 천장 자체가 없습니다. 이건 *합쳐야 하는* 질문(답 하나를 기대하는)을
100개 worker로 흩뿌리라는 뜻이 **아닙니다.** lead는 여전히 갈라진 요약 100개를 충실히 합칠
수 없습니다.

---

## 이게 비용 이야기와 다른 이유

이걸 비용 축으로 뭉뚱그리지 마세요 — 이건 **품질** 축이고, 비용 축들과 직교합니다.

- **Topology 비용**은 *모양*에 값을 매깁니다(주어진 fan-out 구조에 얼마를 더 내나). 이 노트는
  "어느 너비에서 답이 **더 좋아지길 멈추나**"입니다 — 돈 낼 마음이 있어도 아래로 꺾이는 다른
  곡선입니다.
- **Context 누적**이 가장 가까운 이웃입니다 — 결과가 쌓일수록 orchestrator의 context가 계속
  커지고, 그래서 일을 *팀*으로 분산하면 규모에서 오히려 싸집니다. 하지만 이건 여전히 **비용**
  논증입니다(누적된 토큰이 턴마다 다시 청구됨). 이 노트는 **fidelity** 논증입니다 — context가
  무한하더라도 lead의 *reconciliation 품질*이 나빠집니다. context 누적은 "넓은 fan-out은
  비싸다"고 말하고, 이 노트는 "넓은 *합쳐야 하는* fan-out은 게다가 *더 나쁘다*"고 말합니다.
- **쓰기 쪽 merge**(합쳐지지 않는 병렬 git 브랜치)는 다른 대상입니다. 이 노트는 **읽기 쪽**
  merge(합쳐지지 않는 요약)입니다. 같은 단어 "merge"지만 대상이 다릅니다 — 코드 vs. 발견.
- **Occupancy**는 놀고 있는 *시간*에 값을 매깁니다. 이 노트는 reconciliation *fidelity*에
  값을 매깁니다. worker가 순식간에 끝나도 merge에서 lead에게 비용을 물립니다.

## 적용법

1. **fan-out 너비를 정하기 전에, 결과부터 분류하세요.** 독립적(자리로 라우팅, merge 없음)이면
   → 너비는 비용으로 묶이니 넓게 펼치세요. 합쳐야 하면(답 하나 기대) → 너비는 fidelity로
   묶이니 예산과 무관하게 **3~5로 상한을 두세요.** 첫 결정은 토큰 예산이 아니라 이 분류입니다.
2. **너비도 필요하고 합쳐진 답도 필요하면, synthesis 계층을 하나 넣으세요.** lead 하나에게
   20개 결과를 합치라고 하지 마세요. 20개 fan-out → 중간 synthesizer로 4개쯤씩 묶어 줄이기 →
   그렇게 나온 5개쯤의 그룹 요약을 합치기. fidelity 천장을 round-trip 한 번과 맞바꾸는 것이지,
   천장 값을 그대로 무는 게 아닙니다.
3. **lead가 이견을 매끈하게 뭉개지 못하도록 결과를 구조화하세요.** 타입 지정된/구조화된 결과
   (worker마다 `{verdict, evidence, disagreements}`를 뱉음)는 reconciliation을 산문 merge가
   아니라 기계적으로 만듭니다 — hallucinated consensus를 막는 문서화된 가드입니다.
4. **"수백 개 에이전트"를 "3~5 규칙은 끝났다"로 읽지 마세요.** 그 규칙이 끝난 건 *독립적인
   결과* 열에서만입니다. 하나의 합쳐진 답으로 끝나는 작업에선 3~5가 여전히 유효합니다 — spawn
   천장이 올라간 것이지 synthesis 천장이 올라간 게 아닙니다.

## 출처

- Anthropic Engineering, *How we built our multi-agent research system* — 1차 자료:
  "3~5 subagents in parallel," "execute subagents synchronously … can't steer subagents,"
  "4× more tokens than chat … 15× more tokens than chats," "domains that require all
  agents to share the same context … are not a good fit," "condensing the most important
  tokens for the lead." (배수는 1차 자료, 나머지는 정성적 서술)
- 실무자 가이드 (CloudZero, Tembo, aibuilderclub, ksred, 2026): "~6 sub-agents ≈ 6× a
  single session," "3~8 sweet spot for coding, then rate limits queue them," "4
  sub-agents = best ROI." (측정치가 아닌 추정)

**근거 등급: mixed** — 토큰 배수와 동기 실행 caveat는 Anthropic 1차 자료이고, "3~5 / 3~8"
너비 숫자와 worker당 선형 비용 기울기는 실무자 추정입니다.
