---
type: pattern
title: "증명은 대상에 묶여 있다 — 대상이 움직이면 만료된다"
description: "초록불은 그 검사가 실행된 정확한 tree, 실행 조건 묶음, 채점 기준에 대해서만 의미가 있습니다. 그래서 영수증은 digest에, 승인은 리비전에 묶고, 최신성은 상태로 추적하며, 재개할 때는 다시 확인한 뒤에 재사용합니다."
tags: [verification, provenance, receipts, freshness, resume]
date: 2026-10-20
source: "External-derived — synthesis across open-source agent-harness repos; see Sources."
relates: [ai-native/agent-eval-tool-receipt-pattern, dev-process/completion-means-verification-output, ai-native/green-must-be-non-vacuous, ai-native/agent-writable-trace-is-testimony, ai-native/harness-is-the-eval-unit]
---

# 증명은 대상에 묶여 있다

이 글 아래에는 먼저 쓴 규칙 두 개가 깔려 있습니다. "완료란 검사를 돌리고 출력을 붙인 것"이라는 규칙은 검사가 실제로 있었는지를 챙깁니다. tool receipt 패턴은 주장한 도구 호출이 실제로 일어났는지를 챙깁니다. 하지만 둘 다 그 초록불이 **무엇에 대한** 것인지는 말하지 않습니다. "테스트 통과"라는 영수증은 "이 tree에서, 이 toolchain으로, 이 채점 기준에 대해"까지 적혀야 완성됩니다. 그리고 그중 하나라도 움직이면, 그 영수증은 지금 눈앞에 있는 대상에 대한 증거가 아니게 됩니다.

놓치기 쉬운 점이 있습니다. 증명은 낡아도 요란하게 실패하지 않습니다. 계속 초록으로 보입니다.

## 실패 양상

- 어떤 branch의 CI가 초록입니다. agent가 commit을 두 개 더 올렸는데, "이 branch의 최신 실행이 초록인가?"를 묻는 merge gate는 이전 실행을 보고 그렇다고 답합니다.
- 어떤 commit에서 테스트가 통과했지만 작업 tree가 깨끗하지 않았습니다. 추적되지 않는 파일이나 commit하지 않은 수정이 있었다면, 테스트한 것과 commit에 들어간 것은 다릅니다.
- 리뷰가 승인된 뒤 patch를 "조금만" 고쳤습니다. 승인은 실제로 읽은 patch가 아니라 pull request에 붙어서 따라갑니다.
- 중단된 실행이 프롬프트나 설정 overlay, 도구 버전이 바뀐 뒤에 재개됩니다. 앞 단계의 통과 결과가 이제는 다른 실행이 된 작업에 그대로 재사용됩니다.
- 평가용 이미지에 현재 commit 이름이 tag로 붙어 있지만, 실제로는 더 오래된 commit에서 빌드된 이미지입니다.

## 왜 반복되는가

**증명이 움직이는 이름 아래 보관됩니다.** branch, pull request 번호, "그 빌드", 이미지 tag 같은 편한 이름은 원래 바뀌라고 있는 것입니다. 이름에 묶인 영수증은 이름이 옮겨 가면 소리 없이 다른 대상을 가리키게 됩니다.

**대상은 코드보다 큽니다.** 검사가 보증하는 범위에는 toolchain, 환경, 데이터셋, 판정에 쓴 프롬프트나 채점 기준, harness 버전까지 들어갑니다. 이 중 하나만 바뀌어도 같은 코드가 다른 판정을 받을 수 있습니다.

**재사용은 싸고 재실행은 비쌉니다.** 어느 파이프라인이든 "중요한 건 안 바뀌었으니" 30분짜리 suite를 건너뛰고 싶은 압력을 받습니다. 최신성 규칙이 명시돼 있지 않으면 그 판단은 그때그때 내려집니다. 그 판단을 agent가 내리는 경우가 많고, 근거는 두 시간 전, 수정 몇 번 전에 transcript에 찍힌 "테스트 통과" 한 줄인 경우가 많습니다.

## 설계 규칙: 네 가지 습관

1. **영수증은 이름이 아니라 내용 digest로 식별합니다.** 수정 중이거나 추적되지 않는 파일까지 포함한 tree hash, 이미지 digest, 데이터셋 리비전, 설정 hash를 씁니다. tree가 깨끗하지 않을 수 있다면 commit만으로는 부족하고, tag가 다른 곳을 가리키게 바뀔 수 있다면 tag만으로도 부족합니다.
2. **승인과 리뷰는 정확한 산출물 리비전에 묶습니다.** 승인에는 자신이 승인한 digest가 적혀 있어야 합니다. digest가 바뀌면 그 승인은 권한이 아니라 기록이 됩니다. 리뷰 승인이 적용이나 push 권한까지 슬그머니 넓어지지도 않습니다.
3. **최신성은 상태로 추적합니다. 지우지도, 그대로 재사용하지도 않습니다.** 실행돼서 통과했다는 건 역사적 사실이니 기록으로 남깁니다. 그 결과가 지금도 적용되는지는 별도로 계산하는 상태입니다. 정확히 일치, 관련 파일 그대로, 관련 파일 변경, 환경 변경, 알 수 없음 같은 식입니다.
4. **이전 증거를 믿기 전에 실행 조건 묶음을 다시 확인합니다.** 재개, 적용, release 단계는 대상의 식별값을 다시 계산해 증거가 묶여 있던 값과 비교합니다. 다르면 기본적으로 거절하고, 이를 무시하고 진행하려면 명시적으로 기록을 남겨야 합니다.

## harness들은 이렇게 구현합니다

**tree hash 영수증.** HAR는 전체 검증 기록의 이름을 Git tree hash로 짓고, commit gate에서 현재 tree가 검증된 tree와 같은지 확인합니다. 한 줄만 바뀌어도 그 영수증은 재사용할 수 없습니다. VeriHarness는 검증 대상을 commit, tree digest, 수정 여부의 조합으로 묶습니다. 임시 index로 tree를 써서 추적되지 않는 파일까지 포함하고, QA 뒤에 이 묶음을 다시 확인합니다. 그래서 commit은 그대로인데 작업 tree가 달라진 경우를 잡아냅니다.

**코드가 아니라 실행 조건 묶음 전체.** agent-evals는 결과마다 framework commit, 컨테이너 이미지 digest, 데이터셋 리비전, gateway 설정 hash를 묶어 둡니다. 새 클라우드 계정에서 처음부터 돌려 보다가, tag만 보면 최신인데 안에 구워진 SHA는 더 오래된 이미지를 발견했습니다. 이 출처 불일치는 재빌드를 강제하는 guard로 바뀌었습니다. QA 기억 harness인 Verdict는 판정마다 harness 경로와 버전, 프롬프트 hash, 정확한 commit 범위를 함께 기록합니다. 어떤 측정기와 어떤 채점 기준이 그 판정을 냈는지 언제든 되짚을 수 있습니다.

**digest에 묶인 승인.** Eclipse Harness는 현재 task 계약 digest와 정확한 결과 digest가 모두 맞지 않으면 리뷰 요청 묶음을 거절합니다. 그래서 낡은 계획이나 이전 결과가 최신 diff 대신 리뷰되는 일을 막습니다. Agent Arena는 리뷰 결정을 base commit, 참가 agent, 프롬프트, 정확한 patch digest에 묶습니다. 이후 적용 단계에서는 승인된 digest, base commit, 깨끗한 worktree, `git apply --check`를 다시 확인하고, GitHub로 내보내는 건 그 위에 별도 승인이 또 필요합니다.

**최신성을 명시적 상태로.** Agent Engineering Toolkit은 소스가 바뀐 뒤에도 테스트가 통과했다는 사실은 지우지 않고, 그 증명이 지금도 적용되는지를 따로 계산합니다. 상태는 `EXACT_MATCH`, `RELEVANT_FILES_MATCH`, `RELEVANT_FILES_CHANGED`, `ARTIFACT_CHANGED`, `ENVIRONMENT_CHANGED`, `UNKNOWN` 같은 것들입니다. 낡은 증명은 통과도 실패도 아니고, `UNKNOWN`은 절대 성공으로 처리되지 않습니다. Verdict의 release gate는 상태 없음, 낡은 상태, 손으로 쓴 상태에 각각 다른 exit code를 씁니다. 이전 판정은 최대 경과 시간, 최소 실행 번호, 최대 뒤처진 commit 수를 한꺼번에 통과할 때만 재사용합니다.

**재개할 때 다시 확인합니다.** SimpleFlowHarness는 실행을 시작할 때 외부 입력, 즉 profile overlay, context 바이트, 도구 버전, workspace와 base commit, 수용한 위험 목록을 정규화한 JSON과 SHA-256으로 기록하고, 재개할 때 그 값을 diff합니다. 다르면 기본적으로 거절합니다. 바뀐 실행 조건을 받아들이는 것과 바뀐 workspace를 받아들이는 것은 서로 다른 플래그여서, 비상구 하나로 다른 신뢰 경계까지 열리지 않습니다.

## 이 규칙이 틀릴 때

- **느린 suite에는 정확한 tree 묶음이 지나치게 엄격할 수 있습니다.** 주석 하나 바뀌었다고 30분짜리 suite를 무효로 만드는 건 낭비입니다. 흔히 관련 경로 기준 최신성으로 완화하지만, 경로 선언이 정확한 만큼만 믿을 수 있습니다. 의존성을 하나 빠뜨리면 낡은 증명이 최신처럼 보입니다. 정확히 일치보다 약한 상태로 취급해야 합니다.
- **싼 검사는 그냥 다시 돌립니다.** 최신성 기록에도 비용이 듭니다. 몇 초면 끝나는 검사라면, 예전 결과가 아직 유효하다고 증명하는 것보다 경계마다 다시 돌리는 편이 간단합니다.
- **식별은 정확성이 아닙니다.** 완벽하게 최신이고 정확히 묶인 증명이라도 그 뒤의 검사만큼만 의미가 있고, 그 검사는 여전히 실패할 수 있는 검사여야 합니다. 묶음은 "이게 지금 대상에 대한 것인가?"에 답할 뿐, "지금 대상이 옳은가?"에는 답하지 않습니다.
- **외부 상태에 기대는 검사는 완전히 묶을 수 없습니다.** 네트워크, 시계, 실제 서비스에 닿는 검사에는 어떤 digest로도 담지 못하는 입력이 있습니다. hash가 다 덮는 척하지 말고 환경 의존적이라고 기록합니다.

## Sources

- HAR (os-factory/har) — https://github.com/os-factory/har
- VeriHarness (SKZL-AI/veriharness) — https://github.com/SKZL-AI/veriharness
- agent-evals (psdhali/agent-evals) — https://github.com/psdhali/agent-evals
- Verdict (ArtJack/verdict) — https://github.com/ArtJack/verdict
- Eclipse Harness (benedictdavon/eclipse-harness) — https://github.com/benedictdavon/eclipse-harness
- Agent Arena (JDKrasnick/agentarena) — https://github.com/JDKrasnick/agentarena
- Agent Engineering Toolkit (AdvancingTitans/agent-engineering-toolkit) — https://github.com/AdvancingTitans/agent-engineering-toolkit
- SimpleFlowHarness (Aero123421/SimpleFlowHarness) — https://github.com/Aero123421/SimpleFlowHarness
