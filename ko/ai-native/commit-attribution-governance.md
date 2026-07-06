---
type: deep-dive
title: "커밋 기여자 표기는 공유 히스토리에 남기는 기록이지, 크레딧 한 줄이 아니다"
description: "어떤 trailer를 쓸지(Co-Authored-By / Assisted-by / Generated-by)는 git 히스토리를 누가 읽느냐로 판단하는 레포별 거버넌스 결정이며, 진짜 위험은 trailer 자체가 아니라 기본값으로 켜진 자동 기록이다."
tags: [commit-attribution, provenance, co-authored-by, git-blame, governance, ai-native]
date: 2026-06-20
source: "외부 자료 종합 — Sources 참고"
relates: []
---

# 커밋 기여자 표기는 공유 히스토리에 남기는 기록이지, 크레딧 한 줄이 아니다

## 한 줄 요약

에이전트가 코드를 짰을 때 *git에 누구를 author로 남기느냐*는 "그 코드를 받아들일지"나
"애초에 이 코드가 있어야 하는지"와는 별개의 결정입니다. 두 판단이 끝난 다음에 오는 문제이고,
따로 짚어볼 값어치가 있습니다. 여기서 우리가 쓰는 건 잠깐 스치는 크레딧이 아니라 영구히
공유되는 기록이니까요.

제가 단단하게 붙잡게 된 세 가지는 이렇습니다.

1. **`Co-Authored-By:`는 잘못 쓰이고 있습니다.** 원래 사람끼리 초안을 주고받은 경우를 위해
   만들어진 필드입니다. 여기에 도구 이름과 모델 이름을 욱여넣으면 필드의 형식 규약이 깨지고,
   이 필드를 먹고 사는 데이터(기여 그래프, `git blame`, 아바타 목록)까지 오염됩니다. 그래서
   `Assisted-by:`, `Generated-by:`, `AI-assistant:` 같은 목적에 맞게 만든 trailer 쪽으로
   갈라지는 중입니다.
2. **위험한 건 trailer가 아니라 *기본값으로 켜진 자동 기록*입니다.** 도구가 커밋할 때마다
   조용히 공유 히스토리에 붙여버리는 것 — 커밋하는 사람이 커밋마다 직접 고르는 게 아니라 —
   이게 진짜 실패 지점입니다. VS Code가 딱 이걸 내놨다가 되돌렸습니다.
3. **trailer는 거친 신호이고, 줄 단위 provenance가 더 정밀한 신호입니다.** 커밋 trailer는
   "이 커밋에 AI가 손댔다"까지만 말합니다. *어느 줄인지*는 못 말합니다. 그래서 trailer가 답
   못 하는 `git blame` 질문을 메우려는 두 번째 도구 계층(squash에도 안 지워지는 줄 단위 표기)이
   생겨나고 있습니다.

핵심을 다시 잡으면 이렇습니다. trailer는 **여러 사람과 도구가 읽는, 추가만 되고 감사되는 공유
기록에 남기는 write**이지 예의상 붙이는 크레딧이 아닙니다. 그러니 "AI한테 크레딧을 줘야 하나"로
따지지 말고, *그 기록을 누가 읽는지*, 그리고 *잘못 쓰였을 때 뭐가 망가지는지*로 결정을 매기세요.

## 왜 이게 intake나 review와 별개의 결정인가

AI 도움을 받은 코드 이야기는 보통 *만드는 쪽*(에이전트가 어떻게 짜고 테스트하고 스스로
고치는가)과 *받는 쪽*(이 PR을 큐에 넣기는 할 건가, 이 코드가 존재하기는 해야 하는가)을 다룹니다.
기여자 표기는 그 둘 **뒤**에 옵니다. 코드는 받아들여졌고 존재해야 한다 — 이제 *그 출처를 영구
기록에 어떻게 남기느냐*의 문제죠.

그 기록을 읽는 쪽은 이렇습니다. 나중에 장애가 났을 때 돌려보는 `git blame`, 호스트의 기여
그래프, 릴리스 provenance 도구, 그리고 규제가 빡센 조직이라면 감사관. 읽는 쪽마다 노이즈를
견디는 정도가 다르고 필요로 하는 신호도 다릅니다. 그래서 정답이 하나로 딱 떨어지지 않습니다 —
*읽는 쪽마다* 정답이 따로 있을 뿐입니다.

## 네 가지 trailer 관례와 각자 노리는 것

아래는 관례와 블로그/재단 정책 수준입니다. 실무자 근거이지 측정된 결과는 아닙니다.

| Trailer | 의미 | 노리는 것 | 깨지는 지점 |
|---|---|---|---|
| `Co-Authored-By: Name <email>` | "이 주체가 공동 저자다" — 사람끼리 페어 프로그래밍한 출처 | 새 도구 필요 없음. GitHub/GitLab/Bitbucket이 이미 렌더링해 줌 | 기여 그래프 오염(봇을 기여자로 카운트), `<email>` 자리에 가짜 주소를 억지로 넣게 됨, *도구*와 *저자*를 뭉뚱그림 |
| `Assisted-by: <tool>` | 저자는 사람이고 AI는 거들어준 도구 | 대부분의 AI 보조 작업의 실제 모습과 맞음. 기여자 수를 부풀리지 않음 | 아직 호스트가 특별히 렌더링해 주지 않음. *어느* 모델인지 담을 표준 필드가 없음 |
| `Generated-by: <token>` | 릴리스 도구가 기계로 파싱하는 provenance 토큰 | 하위 릴리스 provenance 파일(예: Apache의 `Tooling-Provenance`) | 무겁고, 릴리스 자동화용이지 일상 blame용이 아님 |
| `AI-assistant: tool vN (model)` | 도구+모델을 한 필드에 | 단일 필드로 단순함 | 자꾸 욱여넣게 됨. 경계하는 시각은 "단순하게 유지 안 하면 썩는다" |

**결정 지름길:** 읽는 쪽이 *blame/크레딧을 보는 사람*이라면 저자는 사람이고 AI는 도구이니
→ `Assisted-by:` 방식(또는 아예 안 붙이기). 읽는 쪽이 *릴리스/감사 자동화*라면 파싱 가능한
토큰이 필요하니 → `Generated-by:` 계열. "도구가 기본으로 그걸 쓰니까"라며 `Co-Authored-By:`에
손이 가는 건 *읽는 쪽*이 아니라 *쓰는 비용*으로 고르는 겁니다. 도구가 만들기 쉬운 코드 주석을
쓰고, 정작 읽는 사람이 필요로 하는 주석은 안 쓰는 것과 똑같은 안티패턴이죠.

## 진짜 위험: 공유 히스토리에 기본값으로 켜진 자동 기록

가장 날카로웠던 신호는 어느 trailer가 옳으냐 논쟁이 아니었습니다 — VS Code가 "AI 공동저자 추가"
설정을 off에서 `all`로 기본값을 뒤집은 일(PM이 올린 PR, 2026년 4월경)이었습니다. 그 결과
**AI가 전혀 안 붙은 커밋에까지** `Co-authored-by: Copilot`이 붙었습니다. 벤더는 반발이 커지자
되돌렸습니다. 남은 교훈은 이겁니다. AI provenance 자체는 합리적인 거버넌스 목표지만, 그 구현이
**기여자 표기를 명시적이고 커밋마다 검토 가능한 결정이 아니라, git 히스토리에 대한 기본값 자동
기록으로 만들어버린 게 선을 넘은 지점**이었다는 것.

이게 넘겨쓸 수 있는 규칙이고, trailer를 넘어 일반화됩니다. 에이전트 하네스가 공유되고 감사되는
기록에 남기는 *어떤* 메타데이터든(커밋 trailer, PR 푸터, 모델 이름, 프로바이더 태그)
**opt-in이거나 커밋마다 검토 가능해야** 합니다. 어떤 레포는 git 히스토리 + 레포 마크다운을
*유일한* 정본 기록으로 취급해서, 런타임/프로바이더 메타데이터가 거기 조용히 새어드는 걸
못 견디기 때문입니다. 에이전트가 부산물을 하나 만들었을 때의 모습과 똑같습니다. 기본값이 영구
기록에 새어들게 두지 말고, *경계에서 누군가 그 부산물의 운명을 결정해야* 합니다.

도구가 설정 가능하게 안 만들어줄 때 팀들이 실제로 쓰는 임시 방편은 이렇습니다.
AI/프로바이더/모델 표기를 금지하는 레포 지침 **더하기** 그 패턴을 거부하는 로컬 `commit-msg`
훅. 프롬프트 수준 지침만 믿지 말고 훅에서 강제하세요. 프롬프트는 요청이고, 훅이 게이트입니다.

## trailer는 거칠다 — `git blame` 질문엔 더 정밀한 층이 필요하다

커밋 trailer는 *커밋 전체*를 표시합니다. "**이 줄**을 누가 썼는가"는 답 못 합니다 — 장애 때
실제로 궁금한 건 이건데요. 에이전트가 커밋의 더 많은 부분을 작성할수록 `git blame`은 무뎌집니다.
blame된 줄이 모델이 쓴 건지, 사람이 쓴 건지, 봇이 머지한 건지 trailer로는 구분이 안 됩니다.
이걸 메우려고 두 번째 도구 층이 형성되는 중입니다 — **squash에도 안 지워지는**(squash/rebase를
견디는, 순진한 커밋 trailer provenance는 여기서 날아갑니다) 줄 단위 AI 표기죠. "줄 단위
provenance가 필요한가"는 "어느 커밋 trailer를 쓸까"와 *별개* 결정으로 두세요. 대부분의 팀은 둘 다
필요 없고, 규제가 빡센 팀은 둘 다 필요할 수 있으며, 이 둘은 서로 대체재가 아닙니다.

## 이 시점의 도구 기본값 (무엇을 덮어쓰는지 알고 있으라고)

- **Claude Code** — 커밋에 `Co-Authored-By:` trailer **더하기** PR 설명 푸터, 둘 다
  **기본값 on**이고 trailer에 모델 이름이 들어갑니다. 위에서 말한 위험대로, 이게 *기본값
  자동 기록*이라는 걸 알아둘 값어치가 있습니다.
- **OpenAI Codex CLI** — `Co-authored-by:`를 git 훅이 아니라 **프롬프트 주입**(모델한테
  trailer를 쓰라고 시킴)으로 추가했고, 2026년 2월경 배포됐습니다. 프롬프트 수준이라 훅과 달리
  보장되지 않습니다.
- **Aider** — author 이름에 `(aider)`를 붙이고 모델을 공동저자로 답니다.
- **GitHub Copilot, Cursor** — 예전부터 자동 표기 **없음**(위의 VS Code 설정은 호스트 에디터
  층이라 Copilot 자체와는 별개입니다).

보편 표준은 없습니다. 실용적인 자세는 이렇습니다. **당신의 git 히스토리를 누가 읽는지로 trailer를
고르고, 명시적으로 설정하고, 조용한 기본값으로는 절대 두지 마세요** — 그런 다음 줄 단위
provenance가 두 번째 도구를 들일 만한지는 따로 판단하세요.

## 이 노트가 틀렸다고 판명될 조건

호스트(GitHub/GitLab)가 기여 그래프를 오염시키지 않는 *전용* AI trailer를 일급으로 렌더링해
준다면, "`Co-Authored-By:`는 오용이다"라는 마찰이 사라지고 결정은 "표준 걸 써라"로 쪼그라듭니다.
2026년 중반 기준으로는 아직 그런 일이 없습니다. 그전까지 trailer 선택은 레포별 거버넌스
결정으로 남습니다.

## Sources

전부 실무자 / 정책 수준입니다(블로그, 재단 지침, 벤더 문서, GitHub 이슈). 기여자 표기 trailer의
ROI를 측정한 연구는 아직 없으니, 여기 있는 무엇도 벤치마크급으로 취급하지 마세요.

- fabiorehm.com — "Our coding agent commits deserve better than Co-Authored-By" (2026-03)
- allthingsopen.org — "Assisted-by: how open source projects are drawing the line on AI contributions"
- Apache Software Foundation Generative Tooling Guidance (`Generated-by:`, `Tooling-Provenance`); Fedora AI-Assisted Contribution Policy (`Assisted-by:`)
- microsoft/vscode #297204 + `git.addAICoAuthor` 기본값 뒤집기 철회; penligent.ai 보안 관점
- openai/codex #19799 + Codex CLI `commit_attribution` (PR #11617, 2026-02-17경)
- Claude Code git attribution 가이드 (deployhq); jvt.me "How and why I attribute LLM-derived code" (2026-02)
- Agent Blame (mesa-dot-dev/agentblame), Git AI (usegitai) — 줄 단위 squash-safe provenance 도구
- openclaude #1326 — "AI 커밋 표기를 opt-in / 설정 가능하게" 기능 요청
