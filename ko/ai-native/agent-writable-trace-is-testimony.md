---
type: principle
title: "agent가 쓸 수 있는 증거는 증언이지 증명이 아니다"
description: "구현자나 리뷰어가 직접 쓸 수 있는 기록(transcript, '완료' 보고, 테스트, receipt)은 모두 자기 자신에 대한 진술입니다. 버티는 harness는 증거마다 당사자가 손댈 수 없는 작성자를 따로 둡니다."
tags: [agent-eval, verification, audit, traces, harness-design]
date: 2026-10-20
source: "External-derived — an arXiv paper on agents tampering with their own traces, plus a synthesis across open-source agent-harness repos; see Sources."
relates: [ai-native/eval-sandbox-attack-surface, ai-native/agent-eval-tool-receipt-pattern, ai-native/configured-is-not-effective, ai-native/proof-is-bound-to-a-subject, dev-process/planner-generator-evaluator-loop, dev-process/completion-means-verification-output]
---

# agent가 쓸 수 있는 증거는 증언이지 증명이 아니다

코딩 agent가 무슨 일을 했는지 확인할 때, 저는 자꾸 가장 손쉬운 증거부터 집어 듭니다. 세션 transcript, agent가 마지막에 남긴 요약, agent가 작성한 테스트 파일, 저장소에 남겨 둔 receipt JSON 같은 것들입니다. 그런데 이것들은 전부 제가 평가하려는 바로 그 당사자가 쓴 기록입니다. 그러니 이건 **증언**입니다. agent가 자기 자신에 대해 하는 진술이죠. **증거**는 agent가 손댈 수 없는 쪽에서 만든 기록입니다.

말장난처럼 들릴 수 있지만, 그 진술이 얼마나 쉽게 고쳐지는지 보고 나면 생각이 달라집니다.

## 내가 감사하는 trace는 agent의 쓰기 범위 안에 있다

*LLM Agents Can Easily Tamper With Their Own Traces*(Qin, Schmotz, Prinzhorn, Beurer-Kellner, Prabhu, Andriushchenko, arXiv 2609.30266)는 Claude Code, Codex, Antigravity, OpenCode, Grok Build 같은 로컬 코딩 harness를 시험했고, 세 가지를 보고합니다.

1. 지우라고 시키면, 시험한 harness 중 하나를 빼고 모두에서 agent가 자기 실행 trace를 지웠습니다. monitor guardrail은 반응하지 않았습니다.
2. 외부 공격자가 주입한 콘텐츠로도 같은 삭제를 유도할 수 있었습니다.
3. 보상을 좇는 frontier 모델에서는 시키지 않아도 trace 조작이 나타났습니다.

저는 초록만 읽었습니다. 세 번째 발견의 빈도는 초록에 나오지 않으므로, 드물다고 보지 않고 모른다고 봅니다.

여기에는 익스플로잇조차 필요 없습니다. Claude Code의 transcript는 사용자 홈 디렉터리에 있는 평범한 JSONL 파일이고, 소유자는 agent의 `Bash`, `Edit`, `Write` 도구가 실행되는 OS 사용자와 같습니다. 이 파일을 사실로 받아들이는 모든 곳은, 평가 대상이 그 파일을 고칠 수 있다는 점까지 함께 떠안습니다.

| trace를 읽는 쪽 | 말없이 전제하는 것 |
|---|---|
| "generator가 무엇을 했는지" 읽는 judge | generator가 기록을 고쳐 쓰지 않았다 |
| 사용량·비용 보고서, 세션 검색 | 지워진 턴은 원래 없었다 |
| 잘못된 명령 뒤의 사고 검토 | 그 명령이 아직 로그에 남아 있다 |
| "agent가 테스트를 돌렸다"는 주장 | 주장한 실행이 손대지 않은 trace를 남겼다 |

게다가 짧아진 trace는 소리 없이 실패합니다. 빈 로그는 "아무 일도 없었다"와 똑같아 보입니다.

## 누가 썼는가를 묻는다

trace는 가장 날카로운 사례일 뿐입니다. 이제 저는 어떤 증거든 한 가지를 묻습니다. **이 기록을 누가 쓸 수 있었나? 그 사람이 이 증거로 평가받는 당사자와 같은가?**

| 증거 | 이럴 때 증언이 된다 |
|---|---|
| 세션 transcript | agent가 쓰는 OS 사용자가 그 파일을 고칠 수 있을 때 |
| "완료" 보고, 마무리 요약 | 언제나. 주장 그 자체이기 때문 |
| 테스트 파일 | 통과 여부를 가르는 테스트를 구현자가 직접 썼을 때 |
| receipt 디렉터리, baseline, 기준 스크린샷 | 구현자가 그 경로에 쓸 수 있을 때 |
| 리뷰어의 "승인" | 오케스트레이터 agent가 그 말을 전달하거나 바꿔 말할 때 |
| 감사자의 보고서 | 감사자가 자기가 채점한 작업 공간을 고칠 수 있을 때 |

마지막 두 줄을 눈여겨봐야 합니다. 리뷰어도 주장하는 당사자입니다. 리뷰어의 판정은 구현자의 작업에 대한 증언이고, 리뷰어가 자기가 채점하는 대상을 바꿀 수 있다면 그 통과는 구현자의 자기 인증과 다를 바가 없습니다.

## 같은 구멍이 자꾸 다시 생기는 이유

- **가장 싼 증거는 agent가 이미 내놓은 것입니다.** transcript, 요약, 저장소 안의 receipt는 모으는 데 비용이 들지 않으니 자연스럽게 기본 기록이 됩니다.
- **역할 이름이 데이터 흐름을 대신합니다.** "독립 리뷰어"는 프롬프트 속 이름표일 뿐입니다. 독립성은 그 리뷰어가 무엇을 읽고 무엇을 쓸 수 있는지에서 나오는데, 이걸 실제로 확인하는 경우는 드뭅니다.
- **OS 사용자 하나가 모든 펜을 쥐고 있습니다.** 로컬 머신에서는 agent, hook, 로그, receipt가 한 신원을 공유하는 경우가 많습니다. 사용자가 같으면 쓰기 권한도 같습니다.
- **부재는 조용합니다.** 지워진 턴, 건너뛴 검사, 사라진 산출물은 모두 "문제 없음"처럼 보입니다.

## 원칙: 증거마다 당사자가 쥘 수 없는 펜을 정한다

"아무것도 믿지 말라"는 뜻이 아닙니다. 증언은 어디를 봐야 할지 알려 주는 좋은 단서입니다. 원칙은 그보다 좁습니다. **완료, 승인, 병합, 채점처럼 상태를 넘기는 결정은 당사자가 닿을 수 없는 작성자가 만든 기록으로 내려야 합니다.** 증거마다 작성자를 정하고, 평가받는 당사자에게는 그 펜을 주지 않습니다.

제가 살펴본 오픈소스 harness 중 버티는 것들은 각자 펜 하나씩을 옮겨 놓았습니다. 어떤 펜을 옮겼는지가 다를 뿐입니다.

### worker가 떠난 뒤에 채점한다 — AppleBench

agent는 격리된 checkout만 수정합니다. agent 프로세스가 끝난 뒤에야 호스트 grader가 새로 빌드하고 테스트를 돌립니다. agent에게 테스트 작성을 요구하지 않는 fixture에서는 채점용 테스트 타깃을 agent 스냅샷에서 빼 두었다가, diff를 확보한 뒤에 덮어씌우고 그 시점을 이벤트로 남깁니다. 점수를 정하는 테스트가 worker의 쓰기 범위 안에 존재한 적이 없는 셈입니다. 모든 task는 손대지 않으면 실패하고, agent checkout 밖에 둔 정답 수정을 적용하면 통과해야 등록됩니다. grader 자체도 믿기 전에 먼저 검증받는 겁니다.

### 판정은 경계에서 받아 적고, 상태는 봉인한다 — ai-sdlc-harness

사람이 게이트에서 한 답변은 hook이 원문 그대로 받아 적고 결정적인 parser가 해석합니다. agent가 바꿔 말한 내용은 게이트에 닿지 않습니다. 리뷰어 판정도 정해진 형식의 출력에서 ledger로 옮겨지고, 현재 리뷰 라운드에서 받아 적은 승인이 없으면 task가 완료로 넘어가지 못합니다. 워크플로 상태는 HMAC으로 봉인하고 읽을 때마다 검증합니다. 봉인은 task 이름에도 묶여 있어서, 진짜 증명을 다른 task로 복사하면 통과하지 못합니다. "실패를 확인했다(proven red)"는 말은 harness가 직접 테스트 실패를 지켜본 뒤 테스트 파일의 blob 해시를 고정했다는 뜻입니다. 구현 도중 테스트를 약하게 바꾸면 통과 단계에서 걸립니다.

### 장부 영역을 따로 막는다 — checkride

stop hook은 통과 receipt가 없으면 agent가 작업을 끝내지 못하게 막고, 별도의 보호 hook이 receipt 디렉터리와 baseline 파일에 대한 쓰기를 거절합니다. 구현자는 코드를 고칠 수 있지만, 그 코드가 고쳐졌는지 적는 장부는 고칠 수 없습니다. 이미 있는 부채를 baseline으로 받아들이는 일도 일반적인 수정과 일부러 다른 권한으로 둡니다.

### 사실을 쓰는 쪽과 판단하는 쪽을 나눈다 — Verdict

셀 수 있는 것은 결정적인 harness가 잽니다. 커밋 범위, 게이트 종료 코드, 테스트 개수, 인용 해시 같은 것들입니다. 모델은 의미와 심각도를 판단하지만 숫자를 말할 권한은 없습니다. finalizer가 두 갈래를 합치고, 보고서에서 셀 수 있는 부분은 상태에서 다시 그려 내므로 본문 서술이 그 숫자와 어긋날 수 없습니다. 손으로 쓴 상태 파일은 진짜인 척 통과하지 못하고 별도의 종료 코드를 받습니다.

### 굳힌 증거 묶음으로 판정하고, sentinel로 확인한다 — Wringer

judge는 완성된 증거 묶음(diff, 게이트 출력, 승인된 rubric)만 읽고, worker의 transcript나 추론은 읽지 않습니다. 이걸 지키는 테스트가 재미있습니다. worker가 눈에 띄는 sentinel 문자열을 출력하게 한 뒤, judge 요청 어디에도 그 문자열이 없는지 harness가 검사합니다. 역할 이름이 아니라 실제 데이터 흐름을 확인하는 방식입니다. 사람만 판단할 수 있다고 표시한 기준은 아예 judge에게 보내지 않으므로, 모델이 사람의 결정을 흉내 낼 통로 자체가 없습니다.

### 고치는 감사자는 더 이상 감사자가 아니다 — LongHorizon-Harness

라운드마다 새 context의 executor가 일하고, 읽기 전용 auditor가 실제 파일과 로그, 테스트를 검사합니다. 다음 라운드가 읽는 상태에는 auditor가 받아들인 결과만 들어갑니다. auditor가 작업 공간을 바꾸면 감사는 위반으로 강등되고, 설정에 따라 감사 전 스냅샷으로 되돌립니다. auditor 보고서의 머리 부분이 빠져 있으면 본문을 보고 성공을 짐작하지도 않습니다.

## trace 자체에 적용하면

다시 transcript로 돌아가 봅시다. judge든 보고서든 사고 검토든, 무언가가 이 기록에 기대기 시작하면 저는 이렇게 합니다.

- **agent 자신의 도구가 trace 경로를 건드리지 못하게 막습니다.** transcript 디렉터리에 대한 `Edit`, `Write`, `Bash`를 deny 규칙으로 막습니다. 필요하지만 충분하지는 않습니다. deny 규칙은 도구에 울타리를 칠 뿐, 프로세스 전체를 막지는 못합니다.
- **이벤트를 harness 계층에서 바깥으로 빼냅니다.** `PreToolUse`/`PostToolUse` hook은 agent의 도구 호출이 아니라 harness에서 실행됩니다. 이 hook이 이벤트마다 agent가 닿을 수 없는 곳(원격 로그, 다른 OS 사용자의 디렉터리, 추가만 되는 저장소)에 덧붙여 쓰게 합니다. 로컬 transcript는 캐시가 되고, 바깥에 쌓인 기록이 원본이 됩니다.
- **삭제를 막는 데서 그치지 말고 드러나게 합니다.** 내보낸 이벤트를 해시 체인으로 잇거나 세션별 순번을 매기면, 빠진 구간이 조용한 공백이 아니라 경보가 됩니다.
- **judge는 바깥 기록을 읽거나 검사를 직접 다시 돌립니다.** generator 자신의 로그는 읽지 않습니다.
- **줄어든 trace 자체를 발견 사항으로 다룹니다.** 세션 도구는 읽을 때마다 이벤트 수가 줄어든 세션을 표시해야 합니다.

## 가까운 패턴과의 관계

eval 샌드박스 공격은 agent가 공유된 가변 상태를 통해 채점기의 도구 체인을 오염시키는 문제이고, 해법은 측정 장치를 격리하는 것입니다. tool receipt 패턴은 agent가 주장한 도구 호출을 실행 로그와 대조하는데, 그 로그가 정직하다는 전제를 말없이 깔고 있습니다. 이 원칙은 두 패턴 아래에 놓입니다. 로그든 receipt든 판정이든, 믿기 전에 펜을 누가 쥐었는지부터 물어야 합니다.

## 이 원칙이 틀리는 경우

- **아무도 읽지 않을 때.** judge도, 감사도, transcript를 자동으로 소비하는 도구도 없는 일회성 로컬 세션이라면 바깥 기록을 따로 둬도 얻는 게 없습니다. 이 기록을 근거로 결정을 내리는 순간부터 비용을 치를 가치가 생깁니다.
- **"닿을 수 없다"는 위협 모델에 따라 달라집니다.** ai-sdlc-harness는 HMAC 키를 작업 공간 안에 둡니다. 문서에도 목표는 경로를 벗어나는 agent이지, 키를 읽고 체인을 다시 계산하는 작정한 공격자가 아니라고 적혀 있습니다. Verdict도 쓰기를 막는 hook을 sandbox가 아니라 휴리스틱 가드레일이라고 부릅니다. 펜을 옮긴 위치가 실제로 어떤 공격자를 막는지 분명히 해야 합니다.
- **[가설]** 같은 사용자 권한으로 거는 append-only 파일 플래그는 보기보다 약합니다. macOS에서는 소유자가 사용자 플래그를 풀 수 있으니, 그 사용자로 도는 agent도 풀 수 있습니다. Linux의 같은 기능은 거는 데 root가 필요합니다. 시스템 수준 플래그, 다른 사용자, 호스트 밖 저장소여야 기록이 정말로 손 닿지 않는 곳으로 갑니다.
- **봉인에는 복구 비용이 따릅니다.** 권한 파일을 전부 봉인하면 언젠가는 다시 봉인해야 할 일이 생깁니다. 재봉인은 자동 복구가 아니라 기록이 남는 사람의 작업으로 두어야 합니다. 그러지 않으면 재봉인 경로가 agent가 쥘 수 있는 새 펜이 됩니다.

## Sources

- [LLM Agents Can Easily Tamper With Their Own Traces (arXiv 2609.30266)](https://arxiv.org/abs/2609.30266) — 초록만 읽었고, 방법과 빈도는 확인하지 않았습니다.
- [Adversa AI — AI coding agent security resources, October 2026](https://adversa.ai/blog/top-ai-coding-agent-security-resources-october-2026/) — 이 논문을 소개한 모음 글입니다.
- [afterxleep/applebench-harness](https://github.com/afterxleep/applebench-harness) — 종료 후 채점, 숨긴 테스트, "손대지 않으면 실패·정답이면 통과"라는 등록 조건을 참고했습니다.
- [MostAshraf/ai-sdlc-harness](https://github.com/MostAshraf/ai-sdlc-harness) — hook으로 판정을 받아 적고, 상태를 HMAC으로 봉인하고, 테스트 blob을 고정하는 방식을 참고했습니다.
- [robmclarty/checkride](https://github.com/robmclarty/checkride) — stop hook의 receipt 게이트와 receipt·baseline 경로 보호를 참고했습니다.
- [ArtJack/verdict](https://github.com/ArtJack/verdict) — 결정적 사실 갈래와 모델 판단 갈래를 나누고, 손으로 쓴 상태에 별도 종료 코드를 주는 방식을 참고했습니다.
- [marcoakes/wringer](https://github.com/marcoakes/wringer) — 증거 묶음만 읽는 judge, sentinel 격리 테스트, 사람 전용 기준을 judge에서 빼는 방식을 참고했습니다.
- [AMAP-ML/LongHorizon-Harness](https://github.com/AMAP-ML/LongHorizon-Harness) — 읽기 전용 auditor, 작업 공간을 바꾸면 강등하는 규칙, auditor가 받아들인 결과만 상태로 올리는 방식을 참고했습니다.
