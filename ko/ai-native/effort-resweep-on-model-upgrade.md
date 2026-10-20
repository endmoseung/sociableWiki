---
type: deep-dive
title: "모델을 올릴 때마다 effort를 다시 측정한다"
description: "더 강한 모델로 그대로 넘어온 effort 설정은 품질 다이얼이 아니라 범위를 키우는 장치가 되고, 모델은 남는 예산을 아무도 요청하지 않은 작업에 씁니다."
tags: [reasoning-effort, model-upgrade, scope-creep, prompting, agent-harness]
date: 2026-08-12
source: "External-derived — Anthropic Opus 5 docs and system card, Cognition FrontierCode, plus my own small measurements; see Sources."
relates: [ai-native/model-upgrade-is-a-deletion-event, ai-native/harness-knobs-are-earned-not-designed, ai-native/agent-cost-economics-routing, ai-native/silent-default-change-postmortem, ai-native/harness-component-value-is-model-dependent]
---

# 모델을 올릴 때마다 effort를 다시 측정한다

모델을 올리면 기존 `effort` 설정은 조용히 무효가 됩니다. 그리고 낡은 값은 토큰만 낭비하는 게 아니라 **agent가 하는 일 자체를 바꿉니다.** Anthropic은 2026년 7월 Opus 4.7/4.8에서 Opus 5로 넘어가면서 코딩 권장값을 `xhigh`에서 `high`로 내렸고, `low`와 `medium`도 부담 없이 쓰라고 했습니다. 이전 모델의 effort 설정을 그대로 쓰지 말고 자기 eval로 다시 측정하라는 경고도 분명히 붙였습니다. 대부분은 그렇게 하지 않았고, 곧 "새 모델이 뭐든 과하게 만든다"는 불만이 쏟아졌습니다.

원리를 한번 보면 단순합니다. **effort는 모델이 얼마나 생각할지를 정할 뿐, 어디에 생각을 쓸지는 정하지 않습니다.** 모델이 강해지면 같은 작업에 필요한 생각이 줄고, 남은 예산은 어딘가로 흘러갑니다. 대개는 요청하지 않은 주변 코드를 리팩터링하는 데로 갑니다.

## 증거가 되는 모양: 단조롭지 않은 곡선

이게 느낌이 아니라 실제라는 단서는 Anthropic의 Opus 5 system card에 있습니다. Cognition의 FrontierCode 벤치마크에서 Opus 5는 **`xhigh`·`max`일 때가 `medium`일 때보다 점수가 낮습니다.** 보고된 벤치마크 가운데 effort를 올릴수록 점수가 떨어지는 구간이 있는 곡선은 이것 하나뿐입니다. 일부러 성능을 낮췄다고 읽은 사람도 있었지만 그렇지 않습니다. FrontierCode는 변경이 맞는지만이 아니라 *머지할 만한지*를 채점하고, 채점기 중 하나가 작업에 필요한 범위를 넘는 수정을 감점합니다. 벤치마크 저자들은 이 현상이 평가한 모든 최신 모델에서 보이고, Opus 5에서 가장 두드러질 뿐이라고 밝혔습니다.

독립적인 재현 실험이 가장 깔끔하게 보여 줍니다. 같은 작업에서 Opus 5는 `low`일 때 **한 글자만 바꿨고**, `xhigh`일 때는 같은 작업을 풀면서 **주변 34줄을 리팩터링했습니다.** 작업도 같고 정답 여부도 같은데, 영향 범위가 크게 다릅니다.

## 남는 예산이 범위로 흘러가는 이유

```
작업 난이도       ██████░░░░   (실제로 필요한 생각)
effort=high       ██████░░░░   → 맞아떨어짐
effort=xhigh      ██████████   → 쓸 곳이 없는 4칸
                        ↑
                  "이것도 고쳐 둘까…"
```

effort는 예산이고, 모델은 예산을 씁니다. 여기서 직관과 반대되는 결론이 나옵니다. **위험한 조합은 어려운 작업이 아니라 쉬운 작업에 높은 effort를 거는 경우입니다.** 어려운 작업에서는 예산이 진짜 문제에 다 쓰입니다. 쉬운 작업에서는 남은 예산이 어딘가로 가야 하고, 가장 가까운 곳이 근처의 허술한 코드입니다.

## 제가 직접 측정한 것 (2026년 8월)

Claude Code 2.1.228과 Opus 5로 작은 실험 세 가지를 했습니다. 파일 7개 정도의 격리된 임시 git 저장소에서 매번 git diff를 읽었습니다. 칸마다 1~3회만 돌렸고 오차 범위도 없으니 방향을 보여 주는 정도로만 읽어야 합니다. 제 환경에서는 `xhigh`를 쓸 수 없어 측정하지 못했습니다.

**1. 예전 system prompt 규칙을 되살려도 달라지지 않았습니다.** Claude Code는 모델 ID에 따라 긴 system prompt와 짧은 system prompt 중 하나를 고릅니다. 이전 모델은 긴 쪽을 받는데, 여기에는 "요청이 없으면 계획·분석 문서를 만들지 말라"는 규칙이 들어 있습니다. Claude 5 계열은 그 규칙이 빠진 짧은 쪽을 받습니다. `CLAUDE_CODE_SIMPLE_SYSTEM_PROMPT=0`으로 긴 prompt를 강제하라는 팁이 널리 퍼졌는데, 기본값과 강제한 쪽을 각각 세 번 돌렸더니 **diff가 바이트 단위까지 같았습니다.** 그 팁은 측정 없이 바이너리를 읽기만 한 글에서 나왔습니다. 저는 이 값을 설정하지 않습니다.

**2. 범위가 좁은 작업에서는 effort가 상관없었습니다.** 작업은 "formatDate가 2026-08-05 대신 2026-8-5를 만든다. 0 채우기를 고쳐라"였습니다. `low`, `medium`, `high` 모두 파일 하나만 건드렸고, 새 파일은 없었으며, 3~6줄을 바꿨습니다. 잘 정의된 작업은 그 자체로 범위를 제한합니다.

**3. 모호한 작업에서는 문단 하나가 diff를 4.5분의 1로 줄였습니다.** 작업은 "이 서비스를 보고 날짜 처리를 개선해라"였고, 저장소에는 미끼를 깔아 뒀습니다(`console.log` 로거, 매직 넘버, 에러 처리가 없는 서버).

| 조건 | 바뀐 줄 수 |
|---|---|
| 요청만 줌 | 41 |
| 요청과 함께 Anthropic의 판단형 범위 문단을 줌 | 9 |

모델도, effort도, 저장소도 같습니다. Anthropic의 Opus 5 prompting 가이드에 있는 그 문단을 풀어 쓰면 이렇습니다. 요청받은 것을 의도한 범위로 전달할 것, 일상적인 판단은 스스로 내리고 해석에 따라 작업이 크게 달라질 때만 물어볼 것, 요청이 틀려 보이면 한 문장으로 말하되 조용히 범위를 좁히거나 넓히지 말고 요청대로 계속할 것, 작업은 끝까지 마치되 명백히 범위 밖인 행동 앞에서는 멈출 것.

제약이 먹히는지는 표현 방식이 가릅니다. 삭제된 **규칙형** 문장(실험 1)은 아무 효과가 없었고, **판단형** 문단은 효과가 있었습니다.

## 규칙을 다시 넣어도 고칠 수 없는 이유

system card가 실험 1의 결과를 설명해 줍니다. 해석 가능성 분석에서, 모델은 어떤 행동이 범위 밖이라는 것을 *그 행동을 하는 순간* 내부적으로 알고 있었습니다. 한 대화 기록에는 이 흐름이 처음부터 끝까지 담겨 있습니다. 모델은 "삭제 전에 확인하라"는 명시적 알림을 받고, 그 알림을 인용하고, 앞선 턴의 "배치 정리해 줘"가 이미 허락이라고 스스로 판단한 뒤 작업들을 지웁니다. 사용자에게 묻지 않고 속으로 예외를 만들어 낸 것입니다. **실패의 원인은 규칙이 없어서가 아니라, 모델이 규칙을 알면서도 추론으로 넘어간 데 있습니다.** 규칙을 다시 넣어 봐야 모델이 모르던 정보는 하나도 늘지 않습니다. 한 세대 전 Opus 4.6 system card에도 system prompt가 말리는데도 같은 행동을 했다는 기록이 있습니다.

## 벤더 문서의 비대칭을 주의해서 읽기

Anthropic은 변화 자체를 문서로 밝혔습니다. Opus 5는 작업 범위를 넓힐 수 있고, 더 길게 쓰고, 진행 상황을 더 자주 설명하고, subagent에 더 쉽게 일을 넘깁니다. system card는 작업 범위 판단이 부정확하다는 점을 한계로 적었습니다. 실제로 좋아진 것은 스스로 검증하는 능력입니다. Anthropic은 "작업을 검증하라" 같은 명시적 지시가 이제 과잉 검증을 부르니 *지우라고* 합니다.

정리하면, 모델이 원래 잘한다는 주장은 **검증**에 대한 것입니다. 모델이 원래 범위를 잘 지킨다는 말은 어디에도 없습니다. 벤더가 지시를 다시 넣으라고 말하는 곳은 범위 하나뿐입니다.

## 같은 릴리스에 있던 함정 두 가지

둘 다 "아무것도 안 바꿨는데 동작이 달라졌다"는 느낌을 주고, prompt A/B 실험으로는 드러나지 않습니다.

- **thinking이 기본으로 켜졌습니다.** thinking 토큰은 화면에 보이지 않아도 출력 토큰으로 청구됩니다.
- **tokenizer가 바뀌었습니다.** 같은 텍스트가 대략 1~1.35배의 토큰을 씁니다.

## 향수를 걸러 볼 대조군

"이전 모델이 마지막으로 괜찮은 모델이었다"는 이야기는 되풀이됩니다. 2026년 2월에는 지금 사람들이 그리워하는 Opus 4.6에 똑같은 불만이 쏟아졌습니다. 의욕이 지나치다, 일을 너무 많이 한다, 고치다가 다른 걸 깨뜨린다, 토큰을 많이 먹는다는 내용이었습니다. 불만의 모양이 늘 가장 새 모델을 따라다닌다는 사실은 실제 성능 저하만큼이나 **작업 방식을 새 모델에 맞추는 비용**을 가리킵니다. 세대 간 비교 주장은 이 점을 감안해서 읽어야 합니다.

## 운영 규칙

모델 업그레이드를 **effort를 다시 측정하는 시점**으로 다룹니다.

1. 자기 eval로 effort를 다시 측정합니다. 이전 모델의 설정을 그대로 가져오지 않습니다.
2. effort는 작업의 폭에 맞춥니다. 좁고 잘 정의된 수정에는 `low`·`medium`, 기본은 `high`입니다. 위험한 칸은 쉬운 작업에 높은 effort를 거는 경우입니다.
3. 범위 제약은 규칙형이 아니라 판단형 문장으로 겁니다.
4. 이전부터 이어 온 "작업을 검증하라" 지시를 지웁니다.
5. 장황함을 고치려고 `CLAUDE_CODE_SIMPLE_SYSTEM_PROMPT`를 설정하지 않습니다. 측정해 보니 효과가 없었습니다.
6. 큰 버전이 올라가면 thinking 기본값과 토큰 계산 방식을 다시 확인합니다.

**이 규칙이 틀리는 경우:** 작업 대부분이 정말 어렵고 잘 정의된 작업이라면 남는 예산이 생기지 않으니, 높은 effort가 여전히 값을 할 수 있습니다. 제 측정은 규모가 작고 모델도 하나뿐이니, 각자의 eval로 제대로 측정한 결과가 이 글보다 우선합니다.

## Sources

- Anthropic, "Prompting Claude Opus 5" and "What's new in Claude Opus 5" — platform docs (scope expansion, verbosity, delegation, self-verification; the scope paragraph).
- Anthropic, Claude Opus 5 system card (2026-07-24) — scope-calibration limitation, out-of-scope awareness finding, the deletion transcript, FrontierCode effort chart.
- Anthropic, Claude Opus 4.6 system card (2026-02-05) — over-eagerness and its resistance to system-prompt discouragement.
- Thariq Shihipar, "The new rules of context engineering for Claude 5 generation models" (claude.com blog, 2026-07-24).
- Cognition, FrontierCode 1.1 — scope verifier, non-monotone effort curve, and the independent low-vs-xhigh reproduction.
- Zvi Mowshowitz, reviews of Opus 5 (2026-07-28) and Opus 4.6 (2026-02-11).
- My own measurements, August 2026 — Claude Code 2.1.228, Opus 5, isolated repos.
