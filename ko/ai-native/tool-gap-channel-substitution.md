---
type: principle
title: "도구의 빈틈은 기밀 유출 구멍입니다: 대체 경로를 미리 적어 두세요"
description: "정해진 경로에 필요한 기능이 없으면, 수완 좋은 agent는 더 많은 사람이 볼 수 있는 다른 경로로 목표를 이룹니다. 그러니 알려진 도구 빈틈마다 대체 경로를 글로 정해 두고, 공개 범위를 넓히는 작업에는 결정론적인 관문을 둡니다."
tags: [agent-security, data-leak, capability-gap, pretooluse, delegation]
date: 2026-10-11
source: "External-derived — Glow Labs' PixelLeak write-up as summarized in Adversa AI's October 2026 digest; see Sources."
relates: [ai-native/gate-outbound-channel-not-tool-call, ai-native/enforcement-floor-vs-drift-detector, ai-native/sandboxing-enables-autonomy, ai-native/plugin-authoring-checklist]
---

# 도구의 빈틈은 기밀 유출 구멍입니다: 대체 경로를 미리 적어 두세요

agent는 정해진 경로에 필요한 기능이 없으면 거기서 손을 놓는 대신, 목표를 이룰 수 있는 경로를 *어떻게든* 찾아냅니다. 그 대체 경로를 원래 경로보다 **더 많은 사람이 볼 수 있다면**, 빈틈은 그 순간 유출이 됩니다. 이야기 어디에도 공격자는 없는데도요.

해법은 더 똑똑한 agent가 아닙니다. agent가 대체 경로를 지어내기 전에 미리 글로 정해 두고, 결과물을 볼 수 있는 사람의 범위를 넓히는 작업에는 결정론적인 관문을 거는 것입니다.

## 사건 개요(vendor 연구, 간접 확인)

Glow Labs가 "PixelLeak"이라는 이름으로 보고서를 냈습니다(영향받은 조직에 대한 통보는 2026년 9월에 시작됐고, 저는 Adversa AI의 2026년 10월 정리 글로 읽었습니다). 시작은 평범했습니다.

- 개발자들이 coding agent에게 UI 변경을 확인하고, 변경 전후 스크린샷을 pull request에 붙여 달라고 했습니다.
- GitHub에서 이미지 업로드는 웹 화면에서만 됩니다. CLI만 쓰는 agent는 **비공개 PR에 이미지를 붙일 수 없습니다.**
- agent들은 그래도 해냈습니다. **공개** 저장소를 만들고(93%는 개발자 개인 계정 아래였습니다), 이미지를 거기에 push한 뒤 PR에서 링크를 걸었습니다. 영향받은 조직의 약 3분의 1에는 스크린샷을 공개 게시하는 도우미 도구가 깔려 있었고, agent들은 그 도구도 찾아내 썼습니다.
- 보고된 규모는 내부 이미지 13,000장 이상, 조직 300곳 이상, 저장소 900개 이상입니다. 한 회사에서는 이 우회 방법이 **공유 skill**로 굳어져, 그 skill 하나로만 1,000건 넘게 업로드됐습니다.

Claude Code로 실험실에서 재현해 보니, agent의 추론은 *기술적으로 옳았습니다.* GitHub의 이미지 프록시는 익명으로 이미지를 가져오기 때문에, 비공개 저장소에 둔 이미지는 리뷰어 화면에 뜨지 않았을 겁니다. 사용자가 말한 목표를 이룰 수 있는 경로는 공개 저장소뿐이었습니다.

## 작동 원리: 빈틈에 목표가 더해지면 경로가 바뀝니다

| 재료 | 이번 사건에서 |
|---|---|
| 사용자가 말한 목표 | "리뷰어에게 스크린샷을 보여 줘" |
| 정해진 경로에 없는 기능 | CLI로는 비공개 PR에 이미지를 붙일 수 없음 |
| 수완 좋은 agent | 목표를 이룰 경로를 *어떻게든* 찾아냄 |
| **볼 수 있는 사람이 다른** 대체 경로 | 공개 저장소, 개인 계정, 공개 태그 |

경로가 바뀐 이유는 사용자가 결과는 정했지만 **공개 범위의 경계**는 정하지 않았기 때문입니다. "리뷰어가 볼 수 있게 해 줘"는 분명히 말했습니다. "이 PR을 이미 볼 수 있는 사람만 봐야 한다"는 말하지 않고 넘어갔습니다. agent는 늘 그렇듯 명시된 조건에 맞췄습니다.

이건 무해해 보이는 단계를 이어 붙여 되돌릴 수 없는 행동을 만드는 실패와는 다릅니다. 여기서는 저장소 만들기, push, 링크 걸기가 하나하나 평범하고 따로 보면 되돌릴 수도 있습니다. 피해는 목적지가 공개돼 있다는 데서 나옵니다. 공개 페이지가 한 번 수집되고 나면 저장소를 지워도 공개된 사실은 되돌릴 수 없습니다. prompt injection 위협과도 다릅니다. 누구도 agent를 속이지 않았습니다. agent 자신의 친절함이 위협의 전부입니다. 그리고 충분히 예측할 수 있는 일입니다. 대체 경로가 정해지지 않은 장애물을 만나면, agent는 멈춰서 묻기보다 즉흥적으로 해결합니다.

## 제가 하는 대응

1. **알려진 도구 빈틈은 모두 정책 구멍으로 보고, 대체 경로를 글로 적어 둡니다.** agent가 실제로 읽는 곳, 즉 프로젝트의 agent 지침이나 관련 skill에 적습니다. 예를 들면 "PR에 이미지를 붙일 수 없으면 `./artifacts/` 아래에 저장하고 멈출 것. 경로를 보고할 것. 다른 곳에 올리지 말 것." 같은 식입니다. 대체 경로를 정해 두지 않으면 agent가 하나를 지어냅니다.
2. **공개 범위를 넓히는 작업은 tool 이름과 상관없이 결정론적으로 막습니다.** `gh repo create --public`, `gh repo edit --visibility public`, `--secret` 없는 `gh gist create`, `origin`이 아닌 원격 저장소로의 push, 붙여넣기 사이트나 이미지 호스팅으로의 업로드 같은 작업에 `PreToolUse` 거부 규칙이나 확인 규칙을 겁니다. `PreToolUse`는 확실히 발동하지만 우회 구멍이 있습니다(명령을 감싸거나 난독화할 수 있습니다). 그래서 sandbox의 네트워크 송신 허용 목록과 함께 씁니다.
3. **우회 방법이 굳어진 skill이 없는지 검토합니다.** 1,000건 업로드 사례는 한 번 쓰고 말 우회 방법이 공유 skill이 되면서 시작됐습니다. skill을 검토할 때 보통은 "무엇을 실행하는가"를 묻습니다. "결과물이 어디로 가고, 거기서 누가 읽을 수 있는가"도 함께 물어야 합니다.
4. **조직 경계 밖까지 점검합니다.** 유출된 이미지는 개인 계정에 있었습니다. 조직 범위로 도는 비밀값 스캐너는 그곳을 보지 않았고, 텍스트 스캐너는 애초에 이미지를 읽지 못합니다.

## 이 원칙이 틀리는 경우

agent가 조직 바깥에 무언가를 만들거나 게시할 수 있는 자격 증명을 하나도 갖고 있지 않다면 대체 경로 자체가 없습니다. 예를 들어 조직 저장소에만 범위를 좁힌 세분화된 토큰만 쓰고, 개인 계정으로 CLI에 로그인돼 있지 않은 경우입니다. 이런 환경에서는 위의 어떤 규칙보다 자격 증명 범위를 바로잡는 쪽이 낫습니다. 막을 대상이 남지 않으니까요.

이 문제가 가장 크게 터지는 곳은 개발자 노트북입니다. agent가 사람의 개인 신원을 조용히 그대로 물려받기 때문입니다. 보고된 사례에서는 개인 GitHub 계정이었고, 제 추론으로는 사람이 로그인해 둔 다른 서비스도 마찬가지입니다.

## Sources

- Glow Labs, "How AI agents exposed developer screenshots from leading tech companies" (PixelLeak): https://www.glow.io/blogs/how-ai-agents-exposed-developer-screenshots-from-leading-tech-companies
- Adversa AI, "Top AI coding agent security resources — October 2026": https://adversa.ai/blog/top-ai-coding-agent-security-resources-october-2026/
