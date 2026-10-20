---
type: principle
title: "초록불은 공허하면 안 된다 — 실패할 수 없었던 검사는 아무것도 증명하지 못한다"
description: "발견 0건, exit 0, 전부 통과는 harness가 그 검사가 이 대상에서 실패할 수 있었음을 보여 주지 않는 한 '아무것도 안 돌았다'와 구별되지 않습니다."
tags: [verification, non-vacuous, agent-eval, gates, false-green]
date: 2026-10-20
source: "External-derived — synthesis across open-source agent-harness repos; see Sources."
relates: [dev-process/completion-means-verification-output, ai-native/agent-eval-tool-receipt-pattern, ai-native/fail-on-base-test-qualification, ai-native/proof-is-bound-to-a-subject, ai-native/models-may-only-downgrade]
---

# 초록불은 공허하면 안 된다

제 완료 규칙은 "검사를 돌리고 출력을 붙여라"입니다. 이 규칙 끝에는 제가 각주 정도로 여기던 단서가 하나 붙어 있었습니다. 공허하게 통과하는 검사는 규칙의 문구는 지키지만 목적은 무너뜨린다는 내용입니다. 오픈소스 agent harness 십여 개가 검증을 어떻게 다루는지 읽고 나서, 저는 그 각주가 사실 본론이라고 생각하게 됐습니다. 검사가 빨간불이 될 기회 자체가 없었기 때문에 초록불이 나올 수 있습니다. exit code만 보면 그 결과는 진짜 성공과 구별되지 않습니다.

그래서 이제 초록불을 볼 때 "돌았나?"가 아니라 **"실패할 수 있었나?"**를 묻습니다. 실패할 수 있었다는 걸 보여 주지 못하면, 그 초록불은 코드가 아니라 검사 자체에 대해 말하고 있는 겁니다.

## 실패 양상

초록불은 빨간불이 없다는 뜻입니다. 그런데 검사가 원래 확인해야 할 대상을 한 번도 건드리지 않았을 때 나오는 결과도 정확히 '빨간불 없음'입니다. 전혀 다른 기술 스택용 harness에서도 같은 모양이 반복됩니다.

- **선택이 비어 있음.** `--changed` 플래그나 glob, skip 목록이 실행 범위를 좁히다 보면 아무것도 실행되지 않습니다. "실패 0건"은 참이고, "실행 0건"도 참입니다.
- **대상에 도달하지 못함.** UI probe가 redirect나 에러 페이지, 로그인 화면에 떨어집니다. 실제로 검사한 그 페이지는 깨끗합니다.
- **도구 부재를 skip으로 셈.** scanner나 브라우저 실행 파일이 설치돼 있지 않아 harness가 skip을 기록하고, 그 skip이 집계에서 통과로 올라갑니다.
- **이미 만족된 assertion.** 변경 전에도 후에도 통과하는 테스트라면 "변경 후 초록"은 변경이 무언가를 했는지에 대해 아무 말도 하지 않습니다. 아무것도 안 바꾼 "리팩터링"도 모든 동작 테스트를 통과합니다.
- **발동할 수 없는 규칙.** 한 번도 발동하지 않은 규칙의 "false positive 0건"은 정밀도가 아니라 침묵입니다.

## 왜 계속 반복되는가

**exit code는 1비트입니다.** 통과와 실패는 말할 수 있지만 "안 돌았다", "볼 수 없었다", "harness가 고장 났다"는 말할 수 없습니다. 실패가 아닌 것은 exit code만 주고받는 첫 경계에서 전부 통과로 반올림됩니다.

**설정 실패는 깨끗한 결과처럼 보입니다.** 검사가 아무것도 못 보게 되는 가장 흔한 원인은 브라우저 부재, 잘못된 route, 빠진 인증 정보 같은 환경 문제입니다. 이런 문제는 에러를 내지 않고 빈 관찰 결과를 내놓으며 조용히 실패합니다.

**코딩 agent는 초록불 쪽으로 흘러갑니다.** 악의가 있어서가 아닙니다. 빨간 gate를 없애는 가장 싼 방법은 범위를 좁히거나, 건너뛰거나, 사소하게 만족시키는 것일 때가 많습니다. "검사를 통과시켜"라는 지시를 받은 agent는 그 길을 찾아냅니다. agent가 그 길을 스스로 알리지 않으니, 공허한 경로를 드러내는 일은 gate가 맡아야 합니다.

## 설계 규칙

초록불은 harness가 다음 네 가지를 보여 줄 수 있을 때만 인정합니다.

1. **검사가 판별력을 가진다.** task나 gate를 받아들이기 전에, 알려진 나쁜 사례는 반드시 실패하고 알려진 좋은 사례는 반드시 통과해야 합니다. 나쁜 사례를 통과시키는 gate는 관대한 게 아니라 고장 난 겁니다.
2. **무언가가 빨강에서 초록으로 바뀌었다.** 변경이 효과가 있었다고 주장하려면, 적어도 검사 하나는 이전 상태에서 빨강이었고 후보 상태에서 초록이어야 합니다. 전후 모두 초록이라면 기존 동작이 보존됐다는 증거일 뿐, 변경의 증거는 아닙니다. agent가 쓴 테스트에 "고치기 전 코드에서 먼저 실패할 것"을 요구하는 규칙도 이 원칙의 한 사례입니다.
3. **실행을 센다.** 실제로 실행된 검사 수, 적용된 선택 조건, 도달한 범위(방문한 route, 실행한 step, 발동한 규칙)를 보고합니다. 실행 0건은 별도의 상태입니다.
4. **통과가 아닌 상태는 통과가 되지 않는다.** `not_run`, `not_testable`, `inconclusive`, `harness_error`는 그 자체로 독립된 결과입니다. 통과로 합쳐지지 않고, "제품 실패"로도 합쳐지지 않습니다. 고장 난 검증기는 고장 난 코드와 다른 문제이기 때문입니다.

## harness들은 이렇게 구현합니다

**입장 쌍(admission pair).** AppleBench는 fixture를 그대로 두는 no-op agent가 task를 **실패**하고, 따로 보관해 둔 정답 풀이를 적용한 agent가 **통과**할 때만 그 task를 benchmark에 넣습니다. 그대로 둬도 통과하면 공짜 점수이고, 정답을 넣어도 실패하면 풀 수 없는 문제이니 둘 다 제외합니다. frontend-visualqa의 자체 CI 데모는 정상 claim이 통과하고 **동시에** 일부러 심어 둔 progress bar 버그가 실패해야 성공으로 끝납니다. VeriHarness는 한 단계 더 올라가 release 지표 자체를 반증합니다. 핵심 지표마다 일부러 망가뜨린 빌드를 잡아내야 하고, 놓치면 그 지표는 PASS가 아니라 `NOT_RUN`으로 보고됩니다.

**변경 증거(change witness).** VeriHarness는 영수증이 전부 초록이어도, 적어도 한 기준이 이전 상태에서 빨강이었다는 증거를 갖추지 않으면 후보를 받아들이지 않습니다. 전후 모두 초록이던 검사는 버리지 않고 다음 반복으로 넘기지만, 변경의 증거로는 세지 않습니다. engineering-protocols는 TDD를 산문 지시가 아니라 사실 술어로 표현합니다. 이벤트 기록에서 첫 테스트 결과가 첫 diff보다 앞서야 한다는 식입니다. open-agent-harness는 같은 함정의 리팩터링 버전을 기록해 뒀습니다. 원래 코드가 이미 동작 테스트를 만족한다면 "아무 변경 없음"도 초록입니다. 그래서 리팩터링에는 테스트와 함께 구조나 diff 증거가 필요합니다.

**실행된 것을 센다.** checkride는 `ok: true`와 `checks_run: 0`을 서로 다른 필드로 둡니다. strict gate 모드에서는 실행 0건이 harness 오류 exit가 되고, 도구가 없으면 skip이 아니라 실패이며, 범위를 좁히는 플래그를 쓰면 부분 실행으로 기록돼 좁은 실행이 전체 실행 행세를 하지 못합니다. 브라우저 monkey-test 도구인 Mischief는 findings 목록이 비었다는 이유만으로 깨끗하다고 하지 않습니다. 요청한 route에 실제로 도달했는지, 유효한 step이 실행됐는지, 눌러 볼 수 있는 후보가 있었는지를 증거로 요구하고, 없으면 별도 exit code와 함께 `NOT VERIFIED`로 닫습니다. a11ign은 정밀도에 대해 같은 지적을 합니다. 한 번도 발동하지 않은 규칙은 false positive도 없지만 증거도 없습니다. 그래서 gate에 접근성을 지킨 컨트롤, 지키지 않은 컨트롤, 알려진 나쁜 fixture를 함께 두고 발동 횟수를 기록합니다.

**통과가 아닌 상태를 지킨다.** checkride는 통과에 0, 제품 실패에 1, harness·설정·환경 실패에 2를 써서 빨간 제품과 고장 난 검증기가 같은 코드를 공유하지 않게 합니다. engineering-protocols는 술어를 `true / false / unknown`으로 평가하고 `true`만 상태 전이를 허용합니다. "실패한 테스트 0건"과 "테스트 미실행"은 서로 다른 사실입니다. frontend-visualqa는 dev server에 접속할 수 없거나 브라우저가 없으면 `not_testable`로 처리합니다. 제품 실패도 아니고 통과도 아닙니다.

## 이 정도 엄격함이 맞지 않을 때

- **알려진 나쁜 fixture는 관리 비용이 듭니다.** 결함을 심어 둔 gate마다 따로 어긋날 수 있는 산출물이 하나 더 생깁니다. 위험이 낮고 싼 로컬 검사라면 한 번 손으로 망가뜨려 빨강이 되는 걸 확인하는 정도로 충분할 수 있습니다. fixture는 gate가 merge를 막거나 agent 점수를 매길 때 제값을 합니다.
- **모든 검사가 뒤집혀야 하는 건 아닙니다.** 회귀 검사는 원래 전후 모두 초록이어야 합니다. 변경 증거는 지금 내세우는 주장에 적용하는 것이지, suite 안의 모든 검사에 요구하는 게 아닙니다.
- **자연스러운 빨강 사례가 없는 성질도 있습니다.** 깨끗한 코드에서 보안 scanner는 아무것도 찾지 않는 게 정상입니다. 발동할 수 있다는 건 canary를 심어 증명하고, 제품에 진짜 결함이 있기를 요구하지는 않습니다.
- **[hypothesis]** 같은 소수의 나쁜 fixture에 맞춰 다듬은 gate는 딱 그 fixture만 잡고 나머지는 놓치게 될 수 있습니다. 제가 읽은 harness 중 이걸 측정한 곳은 없었습니다. 실제로 놓친 사례를 fixture로 추가하는 게 대응책이라는 건 제 추측이고, 검증된 방법은 아닙니다.

## 요약

- 초록불을 믿기 전에, 그 검사가 여기서 실패할 수 있었는지 묻습니다.
- 알려진 나쁜 사례는 실패하고 좋은 사례는 통과할 때만 gate를 받아들입니다. 변경을 주장하려면 이전 빨강, 이후 초록인 증거가 적어도 하나 있어야 합니다.
- 실행된 검사 수, 적용된 선택 조건, 도달한 범위를 셉니다. 실행 0건은 통과가 아닙니다.
- `not_run`, `not_testable`, `inconclusive`, `harness_error`는 각자의 상태로 둡니다. 통과도 아니고 제품 실패도 아닙니다.

## Sources

- AppleBench harness (afterxleep/applebench-harness) — https://github.com/afterxleep/applebench-harness
- VeriHarness (SKZL-AI/veriharness) — https://github.com/SKZL-AI/veriharness
- checkride (robmclarty/checkride) — https://github.com/robmclarty/checkride
- Mischief (ca1773130n/Mischief) — https://github.com/ca1773130n/Mischief
- frontend-visualqa (yutori-ai/frontend-visualqa) — https://github.com/yutori-ai/frontend-visualqa
- engineering-protocols (codewandler/engineering-protocols) — https://github.com/codewandler/engineering-protocols
- a11ign, 이전 이름 a11y-witness (DanBeckDev/a11y-witness) — https://github.com/DanBeckDev/a11y-witness
- open-agent-harness (tsushanth/open-agent-harness) — https://github.com/tsushanth/open-agent-harness
