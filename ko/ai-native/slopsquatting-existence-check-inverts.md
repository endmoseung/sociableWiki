---
type: pattern
title: "slopsquatting 앞에서 레지스트리 존재 확인은 공격을 승인해 줍니다"
description: "agent가 추가한 패키지가 레지스트리에 있는지 확인하는 방어는 공격자가 그 이름을 등록하는 순간 무력해집니다. 실제로 봐야 할 신호는 '존재한다'에 더해 갓 등록됐고, 게시자가 낯설고, 다운로드가 거의 없다는 사실입니다."
tags: [slopsquatting, supply-chain, dependencies, hooks, coding-agents]
date: 2026-10-11
source: "External-derived — slopsquatting 연구와 보안 업체 글(CSA, Trend Micro, Socket)을 정리했습니다. Sources 참고."
relates: [ai-native/shared-cache-is-a-cross-sandbox-channel, ai-native/sandboxing-enables-autonomy, ai-native/enforcement-floor-vs-drift-detector]
---

# slopsquatting 앞에서 레지스트리 존재 확인은 공격을 승인해 줍니다

코딩 agent는 가끔 **존재하지 않는** 패키지를 두고 `npm install <name>`이나 `import <name>`을 씁니다. 이름은 그럴듯합니다. 생태계의 이름 짓는 관례를 따르거나, 제가 부탁한 기능을 그대로 설명하는 이름이기 때문입니다. 공격자는 이렇게 반복해서 나오는 가짜 이름을 모아 두었다가 **악성 코드를 담아 공개 레지스트리에 등록합니다.** 이 공격을 slopsquatting이라고 부릅니다. Python Software Foundation의 Seth Larson이 붙인 이름입니다.

흔히 권하는 방어는 agent가 의존성을 추가하기 전에 웹 검색이나 MCP 도구로 레지스트리를 확인하게 하는 것입니다. 그런데 이 방어에는 정확히 짚어 둘 사각지대가 있습니다. **이 확인은 "이 이름이 존재하는가?"에 답할 뿐이고, 공격자가 이름을 등록한 뒤에는 답이 "예"가 됩니다.** 환각을 잡으려고 넣은 확인 절차가 오히려 환각이 맞다고 보증해 주는 셈입니다.

## 존재 확인이 거꾸로 작동하는 이유

| 시점 | 이름 상태 | 존재 확인 결과 | 올바른 판정 |
|---|---|---|---|
| 선점 전 | 등록 안 됨 | "없음" → agent가 다른 이름을 고름 | 안전 — 확인이 제 역할을 함 |
| 선점 후 | 지난주 낯선 계정이 등록 | "있음" → 설치 진행 | **악성** — 확인이 그냥 통과시킴 |
| 정상 패키지 | 수년 전 등록, 의존하는 프로젝트가 많음 | "있음" | 안전 |

존재 확인만으로는 두 번째 줄과 세 번째 줄을 구분할 수 없습니다. 둘을 가르는 건 메타데이터뿐입니다. 언제 등록됐는지, 누가 게시했는지, 실제로 쓰는 사람이 있는지를 봐야 합니다. 그래서 제가 막는 기준은 존재 여부가 아닙니다. **존재하면서 첫 게시가 아주 최근이고, 게시자가 처음 보는 계정이고, 다운로드 기록이 거의 없는 경우**입니다.

## 이론이 아니라 실제로 써먹을 수 있는 공격입니다

2025~2026년 연구에서 나온 두 가지 사실 때문에 이 공격은 공격자에게 남는 장사가 됩니다. 원 논문이 아니라 2차 정리 글을 보고 쓴 내용이라 수치는 대략으로만 봐 주세요.

- **가짜 이름은 반복됩니다.** USENIX Security 2025 논문 "We Have a Package for You!"에 따르면 같은 프롬프트를 여러 번 돌려도 같은 가짜 이름이 다시 나옵니다. 공격자는 안정적인 목록을 확보할 수 있습니다. 이 연구는 고유한 가짜 이름 약 20만 5천 개를 보고했고, 약한 모델에서는 비율이 20% 가까이 올라갔습니다.
- **비율은 줄었지만 0은 아닙니다.** 2026년 재평가에서는 최신 frontier 모델이 대략 4.6~6.1%였고, 실시간 패키지 검색을 쓰는 agent는 이보다 더 낮았습니다. 하지만 패키지를 수십 개 설치하는 긴 자율 실행에서 몇 퍼센트라면 드문 일이 아니라 한 번쯤은 걸린다고 보는 편이 맞습니다.

## 차단 지점은 두 곳입니다

설치는 부수 효과입니다. 명령이 끝난 뒤 결과를 걸러내는 방식은 이미 늦습니다. `postinstall` 스크립트가 설치 도중에 실행되기 때문입니다. 그래서 두 곳에서 막아야 합니다.

1. **tool 호출 전.** Claude Code 같은 harness라면 셸 도구에 `PreToolUse` hook을 겁니다. 설치 명령(`npm|pnpm|yarn add`, `pip|uv add`, `cargo add`, `go get`)을 잡아내고, *lockfile에 아직 없는* 이름마다 레지스트리 메타데이터를 조회합니다. 첫 게시가 N일 이내이거나, 주간 다운로드가 M회 미만이거나, 게시자 이력이 없으면 **거부합니다.** 거부할 때는 agent가 다음 행동을 정할 수 있는 이유를 함께 줍니다. 예를 들어 "패키지가 너무 새것입니다. 오래 쓰인 대안을 찾거나 사람에게 물어보세요" 같은 식입니다. lockfile에 이미 있는 이름은 그대로 통과하니 평소 작업은 느려지지 않습니다.
2. **manifest diff 단계(CI나 pre-commit).** agent는 설치 명령을 직접 실행하지 않고도 의존성을 추가할 수 있습니다. `package.json`을 직접 고친 뒤 평범한 `install`만 돌리면 hook은 이 경로를 보지 못합니다. 그래서 manifest diff도 확인해서 *새로 생긴* 항목마다 같은 메타데이터 규칙을 적용합니다.

같은 자료들이 권하는 보조 수단도 있습니다.

- lockfile을 고정하고 CI에서 해시를 검증합니다.
- 가능하면 agent가 사설 레지스트리나 허용 목록만 쓰게 합니다.
- 새 의존성이 승인되기 전까지는 샌드박스 안에서 스크립트를 끈 채(`--ignore-scripts`) 설치합니다.

## 이 방법이 맞지 않는 경우

프로젝트가 새 패키지에 정당하게 자주 의존한다면 이야기가 달라집니다. 팀이 직접 만든 패키지를 공개 레지스트리에 올리거나, 생태계가 빨리 움직여서 알맞은 라이브러리가 나온 지 2주밖에 안 됐을 수도 있습니다. 이럴 때 등록 기간 기준은 실제 작업을 막고, 결국 사람들이 차단 장치를 꺼 버립니다. 이 경우에는 모두에게 기준을 낮추지 말고 자기 조직의 scope나 아는 게시자를 허용 목록에 넣으세요. 꺼진 차단 장치는 아무것도 지켜 주지 못합니다.

## 한 줄로 정리하면

"패키지가 존재한다"는 결과는 공격자가 바라는 답입니다. 등록 기간, 게시자, 사용량을 기준으로 막고, 설치 명령과 manifest diff 양쪽에서 막으세요.

## Sources

- Cloud Security Alliance, slopsquatting 연구 노트(2026-04) — https://labs.cloudsecurityalliance.org/research/csa-research-note-slopsquatting-ai-supply-chain-20260419-csa/
- Trend Micro, "Slopsquatting: When AI Agents Hallucinate Malicious Packages" — https://www.trendmicro.com/vinfo/us/security/news/cybercrime-and-digital-threats/slopsquatting-when-ai-agents-hallucinate-malicious-packages
- Trend Micro slopsquatting 데이터셋 — https://github.com/trendmicro/slopsquatting
- Socket, "The Rise of Slopsquatting" — https://socket.dev/blog/slopsquatting-how-ai-hallucinations-are-fueling-a-new-class-of-supply-chain-attacks
- "We Have a Package for You!"(USENIX Security 2025) — 반복되는 가짜 이름. 위 정리 글을 통해 인용했습니다.
- arXiv 2606.13918, "Bayesian-Calibrated Detection of Hallucinated Package Imports in AI-Assisted Code" — https://arxiv.org/pdf/2606.13918
