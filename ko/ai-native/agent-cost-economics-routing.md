---
type: deep-dive
title: "코딩 에이전트 비용 경제학 — 토큰 예산과 모델×effort 라우팅"
description: "에이전트 비용의 대부분은 추론 문제가 아니라 라우팅 문제다. 2026년부터 라우팅은 두 축(어떤 모델 × 얼마나 effort)이 됐고, subagent는 깨끗한 context를 얻는 대가로 토큰을 약 7배 쓴다."
tags: [ai-native, coding-agents, cost-economics, model-routing, subagents, prompt-caching]
date: 2026-06-07
source: "공개 모델 가격, SWE-bench Verified 수치, Anthropic이 공개한 advisor 패턴 테스트를 종합함 (하단 Sources 참고)."
relates: []
---

## 한 줄 요약

에이전트 비용의 대부분은 **추론 문제가 아니라 라우팅 문제**입니다. 분류 작업에까지 Sonnet 요금을
내는 팀이 많습니다. 2026년의 변화는 라우팅이 **한 축에서 두 축**이 됐다는 점입니다. *어떤 모델*
(성능 상한)을 고를지, 그리고 *얼마나 effort*(그 상한을 한 호출에서 얼마나 끌어쓸지)를 줄지입니다.
subagent는 공짜가 아닙니다. 깨끗한 context를 얻는 대신 토큰을 단일 스레드의 약 7배 씁니다. 판단
기준은 언제나 "아낀 메인 context의 어수선함이 subagent 하나당 시작 비용보다 큰가?"입니다. 이 글은
**비용** 관점만 다룹니다. context 격리 트레이드오프와 장시간 실행(long-horizon) 트레이드오프는
별개의 질문입니다.

---

## 비용이 쌓이는 이유: 제곱으로 늘어나는 재전송

매 턴마다 **대화 전체**가 input 토큰으로 다시 전송됩니다. 201번째 메시지의 input 비용은 1~200번
메시지를 합친 것과 맞먹습니다. input은 세션 길이에 따라 제곱으로 늘어나므로, 2시간 세션은 1시간
세션의 2배가 아니라 훨씬 더 비쌉니다. 여기서 두 가지가 따라옵니다.

- **context 품질은 100%가 아니라 ~50%부터 떨어집니다.** 절반을 넘기면 이미 답도 더 나빠지고 턴당
  비용도 더 나가는 "에이전트 멍청이 구간(agent dumb zone)"에 들어섭니다. auto-compact를 기다리지
  말고, 캐시가 아직 따뜻할 때 일찍 compact하세요.
- **항상 로드되는 규칙 파일은 절대 밀려나지 않습니다.** `CLAUDE.md` 같은 상시 지시 파일은 세션
  내내 매 턴 context에 들어앉습니다. 5,000 토큰짜리 규칙 파일은 2번째 턴에도 200번째 턴에도 똑같이
  5,000 토큰을 먹습니다. 가볍게 유지하세요. 이건 모든 호출에 붙는 고정세입니다.

---

## 두 축 라우팅 모델 (2026년의 변화)

지난 2년간 공식은 한 축이었습니다. 쉬운 작업엔 싼 모델, 어려운 작업엔 비싼 모델. 최근 Claude
모델들은 **adaptive thinking**을 추가했습니다. `effort` 파라미터로 한 모델이 요청마다 추론 예산을
동적으로 배분할 수 있게 된 것입니다. 이제 라우팅은 행렬입니다.

| 축 | 무엇을 고르나 | 조절값 |
|------|---------------|------|
| **Model** | *성능 상한* | `haiku` / `sonnet` / `opus` |
| **Effort** | 이번 호출에서 *그 상한을 얼마나* 끌어쓰나 | `low` / `medium` / `high` / `xhigh` / `max` |

놓치면 안 되는 단서:
- `xhigh` effort는 **Opus 전용**입니다. **Haiku는 `effort`를 아예 지원하지 않습니다.**
- 인상적인 데이터: **Sonnet 4.6 @ medium effort가 SWE-bench Verified에서 79.6%** —
  **Opus 4.6 @ high(80.8%)보다 1.2점 뒤질 뿐**인데 비용은 대략 60%입니다. 가장 많이 보는 코딩
  벤치마크에서 비용 ~60%로 성능 ~98.5%를 낸다는 뜻입니다. 기본은 Sonnet으로 두고, Opus는 *자기
  작업에서 실제로 측정한* 근거가 있을 때만 꺼내세요.

가격 기준 (Mtok당 in/out): Haiku 4.5 **$1/$5** · Sonnet 4.6 **$3/$15** · Opus 4.7 **$5/$25**.
각 단계는 아래 단계의 약 3.75~5배입니다. (스냅샷이니 예산 잡기 전 공급사 가격 페이지에서 최신
숫자를 확인하세요.)

---

## 모델 사다리 — 실전 트래픽 분배

무난한 기본 분배는 이렇습니다.

- **Haiku — 하위 ~60%.** 파일 탐색, 단순 수정, 린팅, 분류, 트리아지, 구조화 추출, subagent
  *worker* 실행. 가장 큰 절감 한 방은 빠른 수정과 코드 리뷰를 Opus에서 Haiku로 내리는 것입니다.
- **Sonnet — 중위 ~30%.** 프로덕션 기본값. 대부분의 코딩, 다단계 종합, 추론이 여기 들어갑니다.
  "기본은 Sonnet"이 모델 규칙 중 레버리지가 가장 큽니다.
- **Opus — 상위 <10%.** 새로운 문제 풀이, 강하게 얽힌 코드의 다중 파일 리팩터, 동시 제약이 많은
  아키텍처 결정. *자기 실제 작업*에서 비교 eval로 Opus가 확실히 이길 때만 올리세요.

라우팅한 하루 모델(예시): Haiku 1,800 + Sonnet 1,050 + Opus 150 요청 ≈ **월 $710 —
전부 Sonnet보다 ~37% 저렴**하면서도 필요한 곳엔 Opus를 씁니다. 실제 Claude Code 사용은 평균
**개발자당 활동일 하루 ~$13**($150~250/월)입니다. 습관이 좋으면 하루 $5~15, 나쁘면 *같은 작업*을
하루 $20~40까지 밀어 올립니다.

## 역할 × 난이도 × 실행 surface 라우팅

비용 라우팅은 단순히 "어떤 모델?"이 아닙니다. **역할 × 난이도 × 실행 surface**입니다. 에이전트가
무슨 일을 하는지, 이 인스턴스가 얼마나 어려운지, 그리고 실제 작업이 어디서 도는지를 함께 봐야 합니다.

| 역할 | 낮은 난이도 | 중간 난이도 | 높은 난이도 | 실행 surface |
|------|-------------|-------------|-------------|--------------|
| **Explorer / librarian** | Haiku, low effort | Sonnet, low/medium | Sonnet, medium | 검색·로그 노이즈가 main context에 들어오지 않도록 read-only CLI나 background subagent |
| **Executor** | 단일 파일 기계적 수정은 Haiku | Sonnet, medium | Sonnet 실패 근거가 있을 때만 Opus | 수정은 main CLI에서, 병렬 수정일 때만 격리 worktree |
| **Reviewer / verifier** | 체크리스트·정적 점검은 Haiku | 행동 검토는 Sonnet | 모호한 아키텍처·보안은 Opus 조언자 | 작성한 context가 아니라 별도 review pass와 receipt |
| **Orchestrator** | Sonnet, low | Sonnet, medium | Opus 조언자 + Sonnet 실작업 | main 대화. 매 턴 재전송되므로 가볍게 유지 |
| **Automation / CI loop** | Haiku 또는 결정론적 스크립트 | 종합이 필요할 때만 Sonnet | 열린 Opus loop는 피함 | 토큰·시간·재시도 상한을 둔 headless/background 호출 |

Claude에서의 경계는 이렇습니다. custom agent는 **model**을 정할 수 있습니다. 모델 선택은 그 agent의
역할과 도구 surface에 속하기 때문입니다. 하지만 **effort는 custom-agent 정체성이 아닙니다.** effort나
thinking 예산은 호출 단위 제어로 다루세요. CLI flag, background 실행 설정, 또는 surface가 지원하는
경우 작업별 명시 지시가 맞습니다. 생각 깊이를 강제하려고 "high-effort reviewer" 같은 custom agent를
따로 만들지 마세요. 역할은 그대로인데 라우팅 대상만 늘어납니다.

## subagent 비용 계산

subagent는 **같은 모델, 같은 토큰**으로 과금됩니다. 별도의 더 싼 요금은 없습니다. 사는 것은
**context 격리**, 치르는 것은 **토큰 물량**입니다.

- **7배 어림 규칙.** subagent를 많이 쓰는 워크플로우는 단일 스레드의 약 7배 토큰을 태울 수 있습니다.
  *subagent마다 모든 걸 새로 로드*하기 때문입니다. system prompt, 규칙 파일, 읽는 파일 전부가 다시
  과금됩니다. subagent 5개 = 전체 context 5번 로드입니다.
- **자동으로 더 싸지 않습니다.** 작고 단순한 동작(빠른 git 작업, 셸 명령 하나)에는 아키텍처 자체의
  오버헤드 — prompt, 도구 스키마, 왕복 추가 — 때문에 subagent가 오히려 *낭비*가 됩니다. 규칙:
  **아낀 메인 context 어수선함 > 시작 오버헤드**일 때만 띄우세요.
- **시간 대 토큰 트레이드오프.** 시끄러운 작업(테스트, 문서 가져오기, 로그 처리)은 subagent에 넣어
  노이즈는 메인 context 밖에 두고 요약만 돌려받으세요. *토큰* 예산이 빡빡하면 탐색을 **순차**로
  돌리고, *시간* 예산이 빡빡하면 **병렬**로 돌리세요.

비용을 의식한 subagent 실전:
- **Haiku worker + Sonnet orchestrator** 조합은 rate-limit 소비를 두 풀로 나누는 효과도 있습니다.
  단순한 가격 놀음이 아닙니다.
- **subagent 모델을 무작정 Haiku로 박지 마세요.** Claude Code에서 `CLAUDE_CODE_SUBAGENT_MODEL`
  환경변수는 **planning** 에이전트도 함께 몰기 때문에, 약한 플래너가 하류 오류를 눈덩이처럼 키웁니다.
  Sonnet이 더 안전한 subagent 기본값입니다(Opus 대비 ~40% 저렴, 리서치·탐색에서 품질 손실은 미미).
- **경계가 있는 게 두루뭉술한 것보다 낫습니다.** 명시적 파일 목록 + 출력 스키마 + 토큰 예산을 준
  subagent가 열린 subagent를 이깁니다(내장 Explore/Plan 모드는 싸게 굴러가려고 규칙 파일과 부모
  git status를 일부러 건너뜁니다).
- **병렬은 3~5개로 제한하세요.** 20개 동시 요청을 쏟아붓는 것보다 신뢰성이 낫습니다.

---

## advisor 패턴 (추가 단계가 값을 할 때)

**Opus를 실행하지 않는 조언자**로, Sonnet/Haiku를 직접 손대는 구현자로 배치합니다. Opus가 계획 →
싼 모델이 실행 → Opus가 리뷰. Anthropic이 공개한 테스트에서 이 advisor 패턴은 단일 모델 대비
**~11% 저렴하고 벤치마크 +2%**로 보고됐습니다. 다만 왕복이 하나 늘어납니다. *의미 있게 복잡한*
작업에서만 값을 하고, 짧고 정형화된 작업은 단일 모델이 이깁니다.

---

## 임팩트 큰 레버 (순서대로)

1. **Prompt caching —단일 최대 레버.** 에이전트 루프는 크고 안정적인 system prompt + 도구
   스키마를 매 턴 다시 보냅니다. 이걸 캐싱하면 캐시가 무거운 워크로드에서 input 비용을 **70~90%**
   깎습니다. *캐시가 따뜻할 때* compact하세요.
2. **모델 선택** — 기본 Sonnet, Opus는 근거가 있을 때만.
3. **effort 상한** — thinking 토큰 상한을 걸어(예: `MAX_THINKING_TOKENS=10000`) 사소한 호출이
   max로 생각하게 두지 마세요.
4. **context 위생** — 작업 사이에 clear, ~50%에서 compact, 과도하게 큰 도구 출력은 디스크로
   내려놓기(Claude Code는 50KB 초과 결과를 ~2KB 미리보기로 남기고, 메시지당 상한은 ~200KB) —
   orchestrator의 context(와 rate-limit 사용)를 낮게 유지합니다.
5. **구체적 프롬프팅** — 파일을 지목하고, 결과를 명시하고, 열린 탐색을 피하세요.

---

## 감사할 함정 두 가지

- **조용한 자동화 누수.** 5~10분마다 도는 cron/loop는 매번 전체 system prompt + 규칙 파일을 다시
  로드합니다. 관측된 한 사례는 자동으로 **하루 288번 context를 로드**했습니다. 반복 러너의 실제
  소비량을 점검하세요.
- **프로그래매틱 대 구독 과금 분리.** 프로그래매틱 사용(헤드리스 `-p` 모드, Agent SDK, CI cron)은
  구독의 rate-limit 풀에서 빠져나와, API 정가로 과금되는 별도의 달러 기반 크레딧으로 옮겨질 수
  있습니다. 공급사가 이런 분리를 발표하면 자동화·CI 워크로드의 경제학이 그 날짜부터 바뀝니다.
  나중이 아니라 미리 점검하세요.

---

## Sources

- SWE-bench Verified — Sonnet 대 Opus 성능/비용 비교에 쓴 공개 코딩 에이전트 벤치마크.
- Anthropic 모델 가격 페이지 — Mtok당 input/output 요금 (스냅샷이니 예산 잡기 전 최신 숫자 확인).
- Anthropic이 공개한 advisor 패턴 테스트 — Opus-조언자 대 단일 모델의 "~11% 저렴, 벤치마크 +2%"
  수치.
- Claude Code 문서 — subagent 모델 환경변수, 도구 결과 디스크 저장 임계값, thinking 토큰 제어.
