---
type: principle
title: "원격 vendor MCP는 프로토콜이 보장하는 게 아니라 언제든 거둬갈 수 있는 허가입니다"
description: "MCP는 client와 server가 어떻게 대화하는지만 정하고, 호스팅된 vendor server가 내 client와 대화해 줄지는 정하지 않습니다. 그러니 원격 vendor MCP는 회수 가능한 허가로 다루고, 꼭 필요한 읽기 작업에는 직접 관리하는 얇은 REST 대체 경로를 둡니다."
tags: [mcp, vendor-dependency, resilience, agent-harness, integrations]
date: 2026-10-11
source: "External-derived — practitioner reports from two Hacker News threads (Sept–Oct 2026); see Sources."
relates: [ai-native/agent-primitive-selection-map, ai-native/configured-is-not-effective, ai-native/harness-component-value-is-model-dependent]
---

# 원격 vendor MCP는 프로토콜이 보장하는 게 아니라 언제든 거둬갈 수 있는 허가입니다

MCP는 프로토콜입니다. client와 server가 *어떻게* 대화하는지를 표준으로 정해 둡니다. 하지만 호스팅된 vendor server가 **내** client와 대화해 줄지 *말지*는 아무것도 정하지 않습니다. vendor는 어떤 client가 접속했는지 보고 연결을 받거나 거절할 수 있습니다. Claude Code인지, Codex인지, Copilot인지, 최소 구성 agent인지, 직접 만든 harness인지에 따라서요. 2026년 10월 기준으로 큰 디자인 도구 vendor 한 곳이 실제로 그렇게 하고 있습니다.

그래서 원격 vendor MCP에 기대는 워크플로는 **내가 통제하지 못하고, 실패하기 전까지는 보이지도 않는 vendor 쪽 허용 목록**에 기대는 셈입니다. 저는 이제 원격 vendor MCP를 다른 외부 API 허가와 똑같이 다룹니다. 목록으로 관리하고, 실패하면 크게 드러나게 하고, vendor의 일반 REST API 위에 작은 대체 경로를 직접 둡니다.

## 이 문제가 구체적으로 드러난 계기

2026년 10월 초, Figma 직원이 Figma의 원격 MCP가 허용 목록에 오른 client만 받는다고 공지했습니다. Pi라는 최소 구성 harness agent는 목록에서 빠졌습니다. Hacker News 토론에서 실무자들이 전한 내용은 이렇습니다(독립적으로 검증된 내용은 아닙니다).

- 이 vendor는 MCP server를 **두 개** 운영합니다. 데스크톱 앱을 거치는 로컬 server와 원격 server입니다. **쓰기** 권한은 원격 server에만 있고, client별로 막는 것도 바로 이 원격 server입니다.
- 한 댓글 작성자는 다른 IDE agent에 이 server를 붙였다가 이유를 알 수 없는 오류를 계속 받았고, 나중에야 그 client가 목록에 없었다는 걸 알았다고 합니다.
- 차단은 요청에 실린 client 식별 정보를 기준으로 한다고 알려져 있는데, 이 정보는 위조할 수 있습니다. 토론에는 허용된 client인 척하도록 CLI를 고쳐 쓰는 사람도 있었습니다. 그러니 이 차단은 보안 경계가 아니라 **계약상의 수단**입니다. 위조로 뚫으면 기술적 실패를 이용약관 위반으로 바꿀 뿐이라, 진짜 대체 경로가 되지 못합니다.
- vendor MCP는 공개 REST API에 없는 기능을 열어 주기도 합니다. 그러면 그 기능에 닿는 길은 MCP 하나뿐이고, vendor가 닫을 수 있는 길도 바로 그 길입니다.

댓글들이 짚은 더 큰 흐름도 있습니다. 제품이 AI가 호출하는 도구 묶음으로 바뀌어 갈수록, vendor는 계약을 맺은 client에게만 **쓰기** 권한을 남겨 둡니다. REST API를 통한 읽기 권한은 MCP를 통한 쓰기 권한보다 오래 열려 있는 편입니다.

같은 주에는 반대 방향의 압력도 보였습니다. Pi 프로젝트가 쓴 글이 화제가 됐는데, MCP를 피해 오던 harness가 결국 MCP를 붙이기로 한 이유를 설명하는 글이었습니다. 연동 기능이 모여 있는 곳이 server 생태계라는 것이죠. 몇몇 인기 server에 client가 몰릴수록, 그 server 주인은 어떤 client를 받을지 고를 힘이 커집니다.

## 기존 논의와 축이 다른 이유

MCP 이야기에서 client 식별 정보는 보통 *더 잘 응답하기* 위한 입력으로 등장합니다. server 작성자가 어떤 client에는 tool 목록 전체를, 다른 client에는 `exec` tool 하나만 돌려줄 수 있고, 운영자는 어떤 client가 어떤 트래픽을 만들었는지 기록할 수 있습니다. 이 글에서 client 식별 정보는 *응답할지 말지*를 정하는 입력입니다. 결정은 server vendor가 하고, 위험은 사용하는 쪽이 집니다.

## 사용하는 쪽에서 제가 하는 일

1. **원격 vendor MCP를 도구가 아니라 외부 허가로 목록에 올립니다.** 각 항목마다 어떤 client로 쓰는지, 읽기만 필요한지 쓰기도 필요한지, 로컬이나 데스크톱 연동 버전이 있는지를 적어 둡니다. 로컬 버전은 대개 신뢰 모델과 차단 방식이 다릅니다.
2. **차단당했을 때 크게 드러나게 합니다.** 허용 목록에서 거절당해도 "허용 목록에 없습니다"라는 메시지는 거의 나오지 않습니다. 평범한 인증 오류나 연결 오류, 아니면 "tool not found"로 나타납니다. 그러면 설정이 깨졌거나 agent가 "도구를 안 쓴" 것처럼 보입니다. 시작할 때 값싼 읽기 호출 하나로 확인하고, 실패하면 "이 client에서 vendor MCP에 닿을 수 없음"이라고 분명히 밝히며 워크플로를 멈춥니다. agent가 조용히 추측으로 넘어가게 두지 않습니다.
3. **꼭 필요한 읽기 작업에는 REST API 위에 얇은 "렌즈"를 직접 둡니다.** 토론의 한 실무자는 모바일 네이티브 작업에서 원격 MCP를 빼고, agent에게 REST API 위에 좁은 tool 몇 개를 만들게 했습니다. 전체 폰트, 레이아웃 치수, 색상을 각각 간단한 평문 형식으로 내보내는 tool이었습니다. 이 tool들은 토큰이 더 적게 들었고(MCP는 웹 프레임워크 모양의 디자인 맥락을 돌려줬는데, 웹이 아닌 대상에서는 대부분 버려지는 내용이었습니다) client 차단의 영향도 받지 않았습니다. "새 MCP보다 CLI와 skill을 먼저 쓴다"는 원칙을 context 비용 절감용으로만이 아니라 장애 대비용으로도 쓴 사례입니다.
4. **따라 만들 수 없는 쓰기 경로 위에 쌓지 않습니다.** MCP로만 쓸 수 있는 기능이 필요한 단계가 있으면, 워크플로 설계에서 그 단계를 사람이 승인하는 단계나 vendor 의존 단계로 표시해 둡니다. 그래야 허가가 회수돼도 파이프라인 전체가 아니라 그 단계 하나만 약해집니다.

## 이 조언이 틀리는 경우

vendor의 **자사** client나 vendor와 계약을 맺은 몇 안 되는 주요 client를 쓰고, 워크플로도 짧게 쓰고 끝낼 거라면 허가가 바뀔 가능성은 낮습니다. 그때 렌즈는 얻는 것 없이 유지 비용만 듭니다. 직접 만든 harness 코드는 언제나 그 아래에 있는 기반 도구의 변화를 따라가는 비용을 치르기 때문입니다.

이 대비책이 값을 하는 곳은 오래 돌아가는 자동화, 주력이 아닌 client(직접 만든 harness, 최소 구성 agent, 새로 나온 IDE 연동), 그리고 나중에 harness를 바꿀 가능성이 있을 때입니다.

## Sources

- Hacker News item 49922729 — "Figma restricts MCP access to whitelisted clients, excluding Pi" (2026-10-01)와 그 댓글을 참고했습니다. 실무자 보고이며 독립적으로 검증되지 않았습니다.
- Hacker News item 49906637 — "You said no MCP" (earendil.com, 2026-09-30)와 그 댓글을 참고했습니다.
