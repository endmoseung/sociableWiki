---
type: reference
title: 평가 단위는 모델이 아니라 harness다
description: LLM 에이전트를 평가할 때 scaffold는 모델만큼이나 벤치마크 점수를 흔든다. harness를 고정하고, LLM-as-judge는 다른 계열 모델로 calibration을 거친 뒤에야 믿어라.
tags: [eval, agent-harness, llm-as-judge, benchmarks, regression, reproducibility]
date: 2026-06-16
source: "외부 자료 기반 — 에이전트 평가 논문(arXiv), DeepEval 관리자 글, HN 토론을 종합. 출처는 하단 참고."
relates: []
---

# 평가 단위는 모델이 아니라 harness다

에이전트 평가에서 사람들이 계속 하는 실수가 하나 있습니다. 평가 대상을 모델이라고 생각하는 겁니다. 실제 대상은 모델이 아닙니다. 모델을 감싸는 **harness** — scaffold, tool 정의, prompt 포맷, feedback loop — 가 벤치마크 점수를 모델 선택만큼이나 크게 움직입니다. harness를 고정하지 않으면 결국 재고 있는 건 모델이 아니라 내 셋업입니다.

문제는 세 가지가 겹쳐서 나타납니다. 고치는 방법이 서로 다르니 나눠서 보는 게 좋습니다.

## 1. 벤치마크 confounder — 점수의 일부는 내 셋업 탓

*똑같은* 벤치마크를 *공통* scaffold 위에서 다시 돌리면, 원래 보고된 숫자와 점수가 달라집니다. 때로는 꽤 크게요. 그 차이는 모델 성능이 아니라 평가 셋업입니다. 2026년 한 연구는 주요 에이전트 벤치마크 7종을 고정된 ReAct 계열 아키텍처 하나 위에서 다시 돌렸는데, 보고된 점수 차이의 상당 부분이 모델 개선이 아니라 scaffolding 선택에서 나왔다는 걸 보였습니다.

그래서 "모델 B가 벤치마크 X에서 모델 A를 4점 앞선다" 같은 문장은, 둘이 같은 harness에서 돌지 않았다면 아무 의미가 없습니다. tool schema가 다르거나, system prompt 템플릿이 다르거나, retry loop가 다르면 — 그중 하나만으로도 4점 차이를 만들어내거나 지워버릴 수 있습니다.

## 2. 비교 불가능한 protocol — 공통 triplet이 없다

벤치마크마다 task를 다르게 정의합니다. observation space가 다르고, 쓸 수 있는 tool이 다르고, 성공 기준이 다릅니다. 그래서 공통 형태를 강제하지 않으면 벤치마크끼리 비교가 신뢰할 수 없습니다. task를 비교 가능하게 만들어주는 단위는 명시적이고 버전이 붙은 **(instruction, tools, environment) triplet**입니다. 셋 중 하나라도 암묵적으로 남아 있으면, "같은" task 둘은 사실 같은 task가 아닙니다.

## 3. LLM-as-judge 신뢰도 — 싸지만, calibration 전엔 편향돼 있다

에이전트 출력을 LLM으로 채점하면 사람 리뷰보다 500~5000배 쌉니다. 대규모에서 이게 기본값이 되는 이유죠. 그런데 여기엔 체계적 편향이 딸려 옵니다.

- **Position bias** — pairwise 비교에서 judge가 먼저 나온 쪽을 선호하는 경향.
- **Flattery bias(같은 계열 편애)** — 모델이 자기 계열 출력에 더 높은 점수를 줍니다.
- **Calibration drift** — 사람과의 일치도가 시간이 지나고 task 유형이 바뀌면서 서서히 무너집니다.

제대로 calibration하면 LLM judge는 사람 판단과 80~90% 일치한다고 보고됩니다. 여기서 일하는 단어는 *calibration*입니다. calibration 안 된 상태의 80~90%는 거저 얻은 숫자가 아니라, 근거 없는 숫자입니다.

## 이게 진짜 병목인 이유

이 분야가 수렴한 두 가지 결론이 있습니다.

- **평가 단위는 모델 하나가 아니라 전체 시스템이다.** tool 정의나 prompt 포맷을 바꾸면 pass rate가 모델을 업그레이드한 만큼 움직입니다. 그래서 평가 결과는 이름 붙고 얼려진(frozen) harness를 기준으로 할 때만 의미가 있습니다.
- **평가 인프라는 풀타임 엔지니어링 분야다.** custom harness를 프로토타입 단계 너머로 만드는 건 테스트 프레임워크 하나를 짓는 것과 같습니다. 저는 직접 만들기보다 이미 나와 있는 도구(Opik, DeepEval 등)를 씁니다. flaky한 grader, 조용히 어긋나는 config, 근거 없는 judge 같은 실패 유형은 성숙한 프레임워크가 이미 값을 치르고 해결해 둔 것들이기 때문입니다.

## 제가 돌리는 방식

**벤치마크 구성하기**
- 각 테스트를 명시적이고 버전 붙은 **(instruction, tools, environment) triplet**으로 정의합니다. 셋 다 코드에 묻어두지 말고 config에 보이게 둡니다.
- 모델을 비교할 땐 **scaffold를 고정하고 한 번에 변수 하나만 바꿉니다.** 모델도 갈고 prompt도 손댄 한 번의 run은 버린 run입니다.
- 정적 test set보다 **계속 갱신되는** 벤치마크를 씁니다. 에이전트 task는 정적 NLP task보다 contamination으로 더 빨리 풀려버려서, 정적 set은 결국 암기 체크로 썩습니다.

**LLM-as-judge**
- 절대 점수("1~5점으로 매겨라")보다 **pairwise 비교**("둘 중 어느 쪽이 더 나은가?")를 씁니다. pairwise가 더 안정적이고 절대 스케일의 drift를 상당 부분 피합니다. 대신 position bias는 통제해야 합니다 — 순서를 랜덤화하거나 두 순서 다 채점하세요.
- **다른 계열의 judge**를 씁니다. 평가 대상이 Claude면 judge는 GPT나 Gemini로, 반대도 마찬가지입니다. 같은 계열끼리 채점하면 flattery bias가 측정될 만큼 나타납니다.
- 자동 점수를 믿기 전에 예시 50~200개에서 **사람 라벨과 calibration**을 거치고 Cohen's kappa ≥ 0.6을 목표로 합니다. 그 아래면 judge는 숫자를 뒤집어쓴 노이즈일 뿐입니다.
- judge는 사람 리뷰를 **보강**하는 용도지 대체가 아닙니다. 저는 edge case와 주기적인 calibration 갱신은 사람에게 맡기고, 규모는 judge가 처리하게 둡니다.

**harness confounder 피하기**
- tool schema와 system prompt 템플릿을 코드처럼 **버전 붙은 artifact**로 고정합니다.
- 모든 평가 run에 scaffold 설정 전체 — 모델, temperature, tool set, context window 크기 — 를 같이 기록합니다. config 없는 점수는 재현이 안 됩니다.
- 개선을 보고할 땐 **ablation**을 넣습니다. 이 향상 중 모델 몫은 얼마고 harness 몫은 얼마인가? 이걸 답 못 하면, 아직 무엇이 나아졌는지 모르는 겁니다.

## 한 줄 요약

harness를 얼리고, (instruction, tools, environment) triplet에 버전을 붙이고, calibration 안 된 같은 계열 judge는 절대 믿지 마세요. 에이전트 평가의 나머지는 전부 이 셋을 제대로 잡은 뒤에 따라오는 이야기입니다.

## 참고 출처

- ["A Unified Framework for the Evaluation of LLM Agentic Capabilities" (arXiv:2605.27898)](https://arxiv.org/html/2605.27898v1) — 벤치마크를 고정 scaffold에서 재실행한 confounder 근거.
- ["A Survey on Evaluation of LLM-based Agents" (arXiv:2503.16416)](https://arxiv.org/abs/2503.16416) — 평가 관점 정리와 gap 분석.
- ["Towards More Standardized AI Evaluation" (arXiv:2602.18029)](https://arxiv.org/pdf/2602.18029) — 통합 scaffold 주장, HAL 리더보드.
- [DeepEval — LLM-as-a-judge](https://deepeval.com/blog/llm-as-a-judge) — 80~90% 일치 수치, kappa calibration, pairwise vs. 절대 점수.
- [Hacker News — "About AI Evals" (item 44430117)](https://news.ycombinator.com/item?id=44430117) — "harness가 평가 단위"라는 합의와 도구 추천.
