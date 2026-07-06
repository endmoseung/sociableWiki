---
type: deep-dive
title: Tool Receipt 패턴과 rubric 품질이 eval의 진짜 병목인 이유
description: 에이전트 평가의 발목을 잡는 건 judge 모델의 성능이 아니라 rubric 설계이고, 가장 날카로운 hallucination 탐지기는 "에이전트가 호출했다고 주장한 tool이 실제로 실행됐는지" 확인하는 것이다.
tags: [agent-eval, llm-as-judge, rubric-design, tool-receipts, trajectory-evaluation]
date: 2026-06-13
source: "2026년 실무자 글 두 편(Vinod Rane, Adnan Masood)과 HealthBench를 종합 — Sources 참고"
relates: []
---

# Tool Receipt 패턴과 rubric 품질이 eval의 진짜 병목인 이유

2026년 4~5월에 나온 실무자 글 두 편이 서로 독립적으로 같은 두 가지 주장에 도달했습니다. 하나, LLM-as-judge 평가에서 발목을 잡는 건 judge 모델이 아니라 *rubric*(채점 기준표)이다. 둘, 에이전트 시스템에서 hallucination을 가장 잘 잡아내는 방법은 **tool receipt 패턴** — 에이전트가 호출했다고 주장하는 tool이 진짜로 실행됐는지 증거로 확인하는 것 — 이다.

두 주장 모두 새겨둘 만합니다. eval 결과가 들쭉날쭉하면 보통 더 센 judge 모델부터 찾게 되는데, 그건 대개 잘못 잡은 손잡이거든요.

## 발견 1: judge 모델 성능보다 rubric 품질이 먼저다

가장 날 선 표현은 이렇습니다.

> 잘 설계된 rubric 아래에서 돌아가는 약한 judge가, 허술한 rubric을 든 강한 judge를 이긴다.

이 주장을 구체적으로 만들어 주는 근거가 HealthBench 데이터셋입니다. 의사가 직접 작성한 rubric — 임상 대화 5,000건에 걸쳐 48,562개의 고유 기준 — 을 LLM judge에 붙였더니 judge가 의사 수준의 일치도에 도달했습니다. 모델이 더 똑똑해서가 아니라, rubric이 애매함을 없앨 만큼 구체적이어서였습니다. judge 입장에서 알아서 추측할 여지가 거의 남지 않았던 거죠.

여기서 rubric을 쓸 때 챙기는 규칙 네 가지를 뽑아봤습니다.

- **구체성(Specificity)** — 뭉뚱그린 레이블 말고 측정 가능한 행동을 채점하세요. "해당 조문을 조 번호까지 인용해야 한다"가 "법적으로 정확하다"보다 낫습니다.
- **측정 가능성(Measurability)** — 각 기준은 도메인 지식 없이도 텍스트만 보고 객관적으로 관찰할 수 있어야 합니다.
- **독립성(Independence)** — 기준끼리 겹치면 안 됩니다. 두 기준이 같은 오류에 동시에 걸리면 한 실수를 두 번 감점해 점수가 뒤틀립니다.
- **앵커 예시(Anchor examples)** — 각 기준에서 1점, 3점, 5점이 실제로 어떤 모습인지 구체적인 예시를 붙이세요. 이게 모든 점수가 슬금슬금 중간(3점)으로 쏠리는 central-tendency bias를 막아줍니다.

실무적으로 챙길 한 줄: **judge 모델을 업그레이드하기 전에 rubric의 구체성부터 감사하세요.** 거의 모든 경우 병목은 rubric이고, 애매한 rubric은 더 좋은 모델을 붙여도 안 고쳐집니다 — 약하게 흔들리던 게 자신 있게 흔들리는 걸로 바뀔 뿐입니다.

## 발견 2: tool receipt 패턴

제가 아는 한 에이전트 시스템에서 hallucination을 가장 잘 잡는 방법은 허무할 만큼 간단합니다. **호출했다고 주장한 tool 실행이 진짜 일어났는지 확인하는 것**입니다.

이게 노리는 실패 유형은 흔한 사실 hallucination과 결이 다릅니다. 실행 로그에 아무 흔적이 없는데도 에이전트는 "`search_database()`를 돌려서 X를 찾았다"고 보고할 수 있습니다. 이건 *과정(process)* hallucination입니다 — 주장한 작업 흐름 자체가 없었던 거죠. 그리고 출력만 의미적으로 평가해서는 못 잡습니다. 출력 텍스트는 완벽하게 그럴듯하게 읽히거든요.

패턴은 이렇습니다.

1. 모든 tool 호출이 구조화된 실행 receipt(타임스탬프, 입력, 출력, 상태)를 남기도록 계측합니다.
2. 매 턴이 끝날 때마다 에이전트가 *주장한* tool 사용을 *실제* 실행 로그와 대조합니다.
3. 대응되는 receipt가 없는 주장은 전부 플래그를 세웁니다.

이렇게 하면 조작된 결과가 뒤쪽 추론으로 전파되기 전에 발생 지점에서 잡힙니다. 싸고, 결정론적이고, 아무리 출력 품질을 채점해도 못 찾는 구멍을 막아줍니다.

## 4단계 eval 피라미드

비용을 감당하면서도 정작 중요한 실패는 놓치지 않게 해주는 계층 구조입니다.

| 단계 | 방법 | 커버리지 | 언제 쓰나 |
|------|------|----------|-----------|
| 1 | 결정론적 체크 (regex, 스키마 검증, tool receipt) | 100% | 항상 — 빠르고 싸고 구조적 실패를 잡음 |
| 2 | 경량 fine-tuned classifier | 약 60~80% | LLM judge 호출 비용이 부담스러운 고빈도 eval |
| 3 | 풀 LLM judge | 10~20% 샘플링 | 품질·뉘앙스·rubric 채점 |
| 4 | 사람 어노테이션 | 2~5% 타깃 | 불확실성 높은 케이스, calibration set, 새 rubric 검증 |

붙들어 둘 숫자 두 개입니다.

- **데이터 분할: happy-path 60%, adversarial 40%.** 대부분의 팀은 happy-path에 과하게 쏠려 있다가 adversarial 실패를 프로덕션에 가서야 발견합니다.
- **judge 배포 게이트: Krippendorff's α ≥ 0.80.** 프로덕션에서 judge를 믿기 전 이 선을 넘겨야 합니다(하한 0.70). 먼저 사람이 검증한 예시 200~500개로 calibration하세요.

## LLM judge를 조용히 갉아먹는 bias들

체계적으로 발생하는 bias 세 가지입니다. 각각 값싼 탐지법과 완화책이 있습니다.

| Bias | 탐지 | 완화 |
|------|------|------|
| Position bias | 같은 쌍을 순서만 바꿔 두 번 제시하고 판정이 뒤집히는 횟수를 셈 | Swap-and-average — 두 순서로 각각 돌려 점수를 평균 |
| Verbosity bias | 품질과 무관하게 긴 응답이 더 높은 점수를 받음 | 길이 보정 지표, rubric에 간결성 기준 추가 |
| Self-preference bias | 모델 judge가 같은 계열 모델의 출력을 편애함 | 다른 계열 모델로 교차 평가 |

가장 견고한 프로덕션 구성은 다양한 judge 3개로 패널을 꾸려 다수결로 가는 것입니다 — bias를 상쇄하는 건 단순 평균이 아니라 이 *다양성*입니다.

## 결과가 아니라 trajectory를 평가하라

위의 모든 이야기 밑에 깔린 원칙이 하나 있습니다. **최종 답만이 아니라 trajectory(경로) 전체를 채점하라.**

조작된 추론 사슬을 타거나 단계를 건너뛰어 정답에 도달한 에이전트는 깔끔하게 실패한 에이전트보다 *더* 위험합니다. 겉보기엔 맞아 보이는데 나중에 예측 불가능하게 터지거든요. trajectory 채점은 단계마다 촘촘하게 보상을 매깁니다.

- 단계 정확성
- tool 선택 정확성
- 인자 recall (없는 인자를 지어내지 않았는지)
- 순서 정확성 (Kendall's tau τ ≥ 0.85)
- 추론 일관성

이걸 실행 가능하게 만드는 기법이 **counterfactual credit assignment**입니다. "에이전트가 X 단계에서 다르게 결정했다면 최종 결과가 바뀌었을까?"를 물어보는 거죠. 그러면 결과를 좌우한 결정적 단계와 곁가지 단계가 갈라지고, 어디에 집중해야 할지가 드러납니다. 실무자 보고에 따르면 LLM judge가 이 귀속(attribution)을 할 때 사람 평가자와 대략 70~75% 일치한다고 합니다 — 쓸 만하지만 결정적이진 않으니, 정답이 아니라 우선순위를 가르는 신호 정도로 다루는 게 맞습니다.

## Sources

- Vinod Rane (Senior SWE, BBC), Medium, 2026년 5월 — tool receipt 패턴, 4단계 피라미드, trajectory 채점 (실무자 글, 프로덕션 경험 기반이며 통제된 연구는 아님).
- Adnan Masood, PhD, Medium, 2026년 4월 — rubric 품질, judge bias, Prometheus 연구 계열 인용 (Prometheus 논문을 인용한 실무자 글).
- HealthBench (OpenAI, 2026) — 의사가 작성한 rubric으로 judge가 의사 수준 일치도에 도달 (벤치마크, Masood를 통해 인용했으며 여기서 직접 재현하지는 않음).
- Berkeley RDI, 2026년 4월 — SWE-bench / WebArena의 벤치마크 오염(contamination) 발견 (인용).
