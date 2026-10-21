---
type: principle
title: "설정했다고 작동하는 건 아니다: harness 주장을 위한 capability 사다리"
description: "설치·선언·설정만 된 capability가 실제로 강제되거나 쓰인 것처럼 보고되는 일이 반복됩니다. 정직한 harness는 주장을 단계로 나누고, 이 호스트에서 실제로 확인한 가장 높은 단계까지만 주장합니다."
tags: [harness-design, capabilities, enforcement, evidence, cross-harness]
date: 2026-10-20
source: "External-derived — synthesis across open-source agent-harness repos; see Sources."
relates: [ai-native/agent-writable-trace-is-testimony, ai-native/enforcement-floor-vs-drift-detector, ai-native/harness-self-knowledge-version-skew, ai-native/cross-agent-rule-single-source, ai-native/green-must-be-non-vacuous, dev-process/completion-means-verification-output]
---

# 설정했다고 작동하는 건 아니다: harness 주장을 위한 capability 사다리

제 agent 환경을 설명하면서 제가 써 놓고도 멈칫한 문장들이 있습니다. "리뷰어 subagent는 읽기 전용이다", "이 저장소에는 Playwright가 세팅돼 있다", "worker는 싼 모델로 돈다", "외부 네트워크는 막혀 있다", "이 규칙은 다른 CLI에도 옮겨 놨다". 모두 설정 파일 기준으로는 맞는 말이었습니다. 하지만 이번 실행에서 호스트가 그 설정을 가지고 실제로 무엇을 했는지에 대해서는 한 마디도 해 주지 않았습니다.

서로 무관한 오픈소스 agent harness들을 읽어 보니 같은 실패가 계속 나왔고, 잘 만든 harness에서는 같은 해법이 나왔습니다. 실패는 이렇습니다. **존재하거나 선언되거나 설정된 capability가, 강제되거나 실제로 실행된 것처럼 보고됩니다.** 해법은 주장을 여러 단계로 나누고, 직접 확인한 단계보다 높은 곳까지는 주장이 올라가지 못하게 막는 것입니다.

## 사다리

저장소마다 단계 이름은 다릅니다. 합쳐 보면 이렇게 정리됩니다.

| 단계 | 뜻 | 무엇으로 확인하나 | 증명하지 *못하는* 것 |
|---|---|---|---|
| 1. 존재(present) | 파일이나 설정 항목이 있다 | 디스크와 설정 스캔 | 무언가가 그걸 볼 수 있는지 |
| 2. 연결(wired/advertised) | 호스트가 모델에게 노출하거나, 이 작업을 그쪽으로 보낸다 | 호스트 설정, tool 목록, 라우팅 표 | 모델의 context에 실제로 들어갔는지 |
| 3. 적재·시연(loaded/demonstrated) | 런타임 이벤트가 주입을 보여 주거나, 이 호스트에서 작동하는 모습이 확인됐다 | hook 이벤트, 기록된 실행 | *이번* 작업에서 썼는지 |
| 4. 실행(exercised/invoked) | 이번 실행이 그걸 신원과 함께 실제로 돌렸다 | 이번 실행에 묶인 tool 사용 이벤트나 산출물 | 그게 도움이 됐는지 |
| 5. 결과 뒷받침(outcome-supported) | 이후 비슷한 작업이 나아졌다 | 비교 가능한 작업의 전후 비교 | — |

사다리 위가 아니라 옆에 놓이는 상태가 두 가지 더 있습니다. **관찰 불가(unobserved)**는 증거를 얻을 통로가 없었다는 뜻입니다. 모르는 겁니다. **해당 없음(not applicable)**은 대상 자체가 여기에 없다는 뜻입니다. 둘 다 "없음"도 아니고 "통과"도 아닙니다.

사다리만으로는 담기지 않는 두 번째 축도 있습니다. 바로 **강제 상한(enforcement ceiling)**입니다. deny 규칙이 연결되고 적재까지 됐는데도 일부만 강제될 수 있습니다. 호스트가 어떤 방법은 막지만 다른 방법은 막지 못하기 때문입니다. "리뷰어는 쓰기를 못 한다" 같은 주장에는 단계와 상한이 둘 다 붙어야 합니다.

## 왜 자꾸 반복되나

- **harness 작성자가 가진 건 설정뿐입니다.** skill 묶음이나 프로토콜은 누가 무엇을 해야 하는지를 정합니다. 모델 실행, 권한, 파일 시스템, 스케줄링은 호스트 몫입니다. 묶음 쪽에서는 호스트가 무엇을 했는지 볼 방법이 없으니, 볼 수 있는 것, 즉 자기 설정을 보고합니다.
- **설정을 읽는 건 싸고 결정적이지만, 동작을 확인하려면 계측이 필요합니다.** 앞쪽은 파일 하나만 읽으면 끝납니다. 뒤쪽은 hook, 이벤트 수집, 그리고 그 기록을 쌓아 둘 곳까지 있어야 합니다.
- **이름이 같으면 같은 기능이라고 착각합니다.** 두 CLI에 모두 "permissions"와 "hooks"가 있으니, 한쪽에서 옮긴 규칙이 양쪽에서 같은 의미일 거라고 넘겨짚습니다. 대개는 그렇지 않습니다.
- **조용하면 없는 것처럼 보입니다.** heartbeat가 없는 수집기는 "한 번도 안 썼다"와 "수집하지 못했다"를 구별하지 못합니다. 이벤트가 0개면 사용도 0번처럼 보입니다.
- **같은 자리에서 다시 돌린 결과가 효과처럼 보입니다.** 게이트를 고치고 한 번 돌려서 초록이 뜨면, 그건 수리가 됐다는 증명이지 그 게이트가 이제 잡아야 할 것을 잡는다는 증명은 아닙니다.

## 원칙

**모든 주장은 이 호스트, 이번 실행에서 직접 확인한 가장 높은 단계까지만 하고, 그 옆에 강제 상한을 함께 적습니다.** "존재한다"고 보고해도 괜찮습니다. 다만 "존재한다"라고 보고해야 합니다.

## harness들은 이렇게 구현한다

### Better Harness — 증거 상태가 점수의 상한을 정한다

단계는 Present, Wired, Exercised, Outcome-supported이고, pass/fail과 따로 관리합니다. 여기에 Missing, Unobserved, Not applicable이 더해집니다. 설정된 capability, 읽은 자산 개수, tool 개수는 절대 동작의 증거로 승격되지 않습니다. 같은 시간대에 수리를 검증하면 수리 상태만 갱신됩니다. 효과 점수를 올리려면 나중에 비교 가능한 작업이 따로 있어야 합니다.

### harness-lint — 네 단계, 그리고 시간을 분모로

skill, MCP 서버, tool, agent를 installed → advertised → loaded → invoked로 추적하고, 어느 단계도 다음 단계로 올려 주지 않습니다. 흥미로운 부분은 시간입니다. capability가 존재한 기간과, 실제 전달로 hook 수집이 *확인된* 기간을 따로 기록합니다. hook을 설치했다고 수집 기간이 열리지는 않습니다. 사용량은 두 기간이 겹친 구간에서만 셉니다. 겹침이 있어도 결과는 `partial`입니다. heartbeat가 없으면 중간에 조용히 빠진 구간이 없다고 장담할 수 없기 때문입니다. `complete`는 예약만 해 두고 받아들이지 않습니다. 한쪽 런타임이 내보내지 않는 신호는 `false`나 `0`으로 채우지 않고 unavailable로 둡니다.

### Eclipse Harness — 의도, 설정, 실제 효과는 다른 필드다

역할 파일에 적힌 모델은 **의도**일 뿐이고, 실제로 돈 자식 agent의 정체가 아닙니다. 실제 모델(effective model)은 신뢰할 수 있는 호스트 메타데이터가 있을 때만 채웁니다. 어긋나면 `broken`, 메타데이터가 없으면 `unverified`입니다. 권한도 원하는 권한, 실제 권한, 강제 수준으로 나눕니다. "리뷰어는 읽기 전용"이라는 말은 호스트가 쓰기를 막은 증거를 보여 주기 전까지 `unverified`로 남습니다.

### Everruns — 이 호스트가 못 돌리는 건 광고하지 않는다

capability ID는 저장된 설정에 그대로 남아 있을 수 있습니다. 하지만 현재 호스트가 그걸 실행할 수 없으면 런타임은 프롬프트 문구도, tool도, 동작도 추가하지 않습니다. 실행할 수 없으면 아예 내세우지 않는 방식입니다. 모델은 자기가 갖지 않은 능력을 가졌다는 말을 듣지 않습니다. 실행 전 점검도 실제 실행과 같은 조립 경로를 쓰므로, 미리 보기와 실제 실행이 어긋날 수 없습니다.

### HarnessDesk — 선언한 것과 시연한 것

어댑터는 각 런타임이 지원한다고 *선언한* 기능을 보고하고, UI는 그 교집합만 그립니다. agent가 실제로 해낸 일에 대한 주장은 따로, 로그인한 상태의 실제 녹화에서 나오고, 주장마다 그걸 유지하는 테스트가 ledger에 연결됩니다. 녹화 날짜, 테스트 연결, 현재 시점의 증명은 서로 다른 증거입니다. 지난달 시연이 오늘 빌드를 증명하지는 않습니다.

### Tuff — 상한을 공개하고, 거짓 설치는 거절한다

Tuff는 공유 정책 하나를 여러 CLI의 고유 설정으로 컴파일합니다. 어댑터는 `{effect, subject}` 조합마다 `full`, `partial`, `unsupported`를 표시하고, 메커니즘과 단서를 함께 남깁니다. 2026년 9월 기준으로 예를 들면, Claude Code의 명령·파일 규칙은 다른 호출 방식으로 빠져나갈 수 있어 partial로 표시됩니다. Codex는 명령 접두어 규칙만 일부 강제하고 읽기, 편집, MCP 규칙은 unsupported입니다. 고른 호스트가 규칙을 강제하지 못하면 설치는 기본적으로 실패합니다. 사람이 명시적으로 그 공백을 받아들일 수는 있지만, 호스트가 규칙을 하나도 강제하지 못하면 그것도 허용하지 않습니다. 받아들인 공백은 lockfile에 남고, 검사할 때마다 다시 출력되며, `--strict`에서는 CI를 빨갛게 만들고, 어댑터가 바뀌면 다시 계산됩니다. 공유 정책은 `deny`나 `ask`만 쓸 수 있고 `allow`는 쓸 수 없습니다. 그래서 잘못 만든 정책이 낼 수 있는 최악의 결과는 눈에 보이게 너무 엄격한 상태입니다.

### SimpleFlowHarness — Enforced인가 BestEffort인가

registry 하나가 agent 어댑터마다 플래그, 최소 버전, 알려진 공백을 관리합니다. 읽기 전용 같은 접근 모드에 대해 CLI가 경계 전체를 실제로 보장하지 않으면, harness는 `Enforced` 대신 `BestEffort`로 표시합니다.

### Belay — 볼 수 없다고 인정하는 정책 이름

파일 단위 preset(생성 금지, 삭제 금지, 테스트 읽기 전용)은 실제로 관찰한 파일 시스템 변화에 근거합니다. 반면 네트워크 egress preset은 이름은 있지만 항상 `UNVERIFIED`를 돌려줍니다. harness가 나가는 바이트를 관찰하지 못하기 때문입니다. 운영자가 설정으로 근거가 있다고 선언하는 것도 막습니다. 모르는 preset은 막는 쪽으로 처리합니다. 검증할 수 있는 턴이 거의 없으면 깨끗한 0%가 아니라 계측 장치가 의심스럽다고 보고합니다.

## 이렇게 하면 주장이 어떻게 바뀌나

요즘은 capability 주장을 문장이 아니라 작은 기록으로 씁니다. 주장, 확인한 단계, 호스트와 버전, 강제 상한, 증거 위치, 남은 공백을 적습니다. "리뷰어 읽기 전용 — 연결 단계, 상한 partial, 이번 실행에서 쓰기 차단 이벤트 없음"은 "리뷰어는 읽기 전용이다"보다 덜 시원하게 읽힙니다. 하지만 문제가 생겼을 때는 훨씬 쓸모가 있습니다.

## 이 원칙이 틀리는 경우

- **그 주장에 기대는 게 없을 때.** 리뷰도, 보고서도, 결정도 그 주장을 읽지 않는 일회성 개인 환경이라면 이런 기록은 그냥 부담입니다.
- **동작을 0으로 만들면 빠진 capability가 숨을 수 있습니다.** Everruns도 스스로 짚는 단서입니다. 지원하지 않는 capability를 조용히 광고하지 않는 건 맞습니다. 하지만 작업에 그 capability가 꼭 필요하다면, 그것 없이 그냥 돌릴 게 아니라 사전 점검에서 "사용할 수 없음"으로 크게 실패해야 합니다.
- **너무 엄격하면 우회를 부릅니다.** partial 상한마다 작업을 막으면 사람들은 게이트를 꺼 버립니다. 공백을 명시적으로 받아들이고, 계속 보이게 두고, strict CI에서만 실패시키는 Tuff의 중간 경로가 제가 따라 할 방식입니다.
- **증인도 설정된 것입니다.** "실행됐다"를 증명하는 hook 역시 돌고 있지 않을 수 있는 capability입니다. harness-lint가 실제 전달이 확인될 때만 수집 기간을 여는 이유가 바로 이것입니다. 의심의 사슬은 또 다른 설정 파일이 아니라, 실제로 관찰한 무언가에서 멈춰야 합니다.

## Sources

- [QoderAI/better-harness](https://github.com/QoderAI/better-harness) — Present / Wired / Exercised / Outcome-supported 단계와 Unobserved·Missing 구분을 참고했습니다.
- [kespineira/harness-lint](https://github.com/kespineira/harness-lint) — installed / advertised / loaded / invoked 단계, 수집 기간과 존재 기간의 교집합, partial만 허용하는 coverage를 참고했습니다.
- [benedictdavon/eclipse-harness](https://github.com/benedictdavon/eclipse-harness) — 요청·설정·실제 모델 경로와 원하는·실제·강제 권한을 나누는 방식을 참고했습니다.
- [everruns/everruns](https://github.com/everruns/everruns) — 호스트가 못 돌리는 capability를 광고하지 않는 방식을 참고했습니다.
- [HarnessDesk/HarnessDesk](https://github.com/HarnessDesk/HarnessDesk) — 선언한 capability와 시연한 주장을 따로 기록하는 ledger를 참고했습니다.
- [kannandreams/tuff](https://github.com/kannandreams/tuff) — full / partial / unsupported 강제 행렬, 호스트가 규칙을 강제할 수 없으면 설치를 거절하는 방식, lockfile에 남는 공백을 참고했습니다.
- [Aero123421/SimpleFlowHarness](https://github.com/Aero123421/SimpleFlowHarness) — 어댑터별 Enforced·BestEffort 접근 표시를 참고했습니다.
- [haqaliz/belay](https://github.com/haqaliz/belay) — 근거가 있는 preset과 항상 UNVERIFIED인 preset을 나누는 방식을 참고했습니다.
