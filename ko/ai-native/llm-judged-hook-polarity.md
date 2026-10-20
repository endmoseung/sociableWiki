---
type: pattern
title: "LLM이 판정하는 hook의 방향은 규칙이 아니라 해석입니다"
description: "prompt·agent hook의 정책은 모델이 읽고 ok:true/false로 옮기는 영어 문장이라 판정 방향이 소리 없이 뒤집힐 수 있습니다. 판정 조건으로 쓰고, canary로 확인하고, 되돌릴 수 없는 차단은 부수 효과가 일어나기 전에 코드로 막습니다."
tags: [hooks, prompt-hooks, gates, fail-open, canary, claude-code]
date: 2026-10-11
source: "External-derived — Claude Code changelog and hooks docs (October 2026); see Sources."
relates: [ai-native/enforcement-floor-vs-drift-detector, ai-native/configured-is-not-effective, ai-native/green-must-be-non-vacuous, ai-native/gate-outbound-channel-not-tool-call, ai-native/harness-self-knowledge-version-skew]
---

## 한 줄 요약

`command` hook의 정책은 코드입니다. `exit 2`는 차단이고, 누가 다시 해석하지 않습니다. 반면 `prompt`·`agent` hook의 정책은 **모델이 읽고 `{ "ok": true | false }`로 옮기는 영어 문장**입니다. 이 옮기는 과정이 추론이라서 방향이 뒤집힐 수 있습니다. 거꾸로 동작하는 gate는 조용히 통과하는 gate와 겉보기에 똑같습니다. 막으려던 일이 이미 벌어진 뒤에야 알게 됩니다.

그래서 저는 이렇게 합니다. **정책은 명령문이 아니라 판정 조건으로 쓰고, 차단용 hook마다 canary를 두고, 되돌릴 수 없는 일은 부수 효과가 일어나기 전에 코드가 판단하게 합니다.**

## 근거: 하네스가 이 문제를 계속 고쳐 왔습니다

2026년 10월 초 Claude Code changelog에 이 문제가 그대로 적혀 있습니다.

- **2.1.294**에서 "Block commands that…"처럼 지시문으로 쓴 `prompt`·`agent` hook이 막아야 할 것을 *허용하던* 문제를 고쳤습니다.
- 같은 버전에서 "Carry on if the build is broken"처럼 지시문으로 쓴 `Stop`·`SubagentStop` prompt hook의 판정 방식을 바꿔, 에이전트가 일찍 멈추는 일을 줄였습니다.

즉 그 버전 전까지는 작성자가 떠올릴 수 있는 가장 자연스러운 문장이 의도와 정반대로 동작했습니다. 이번 수정으로 버그의 범위는 줄었지만 구조는 그대로입니다. LLM이 판정하는 hook의 방향은 판정 모델이 그 문장을 어떻게 읽느냐에 달려 있고, 그 해석은 버전마다 바뀔 수 있습니다.

## 명령문이 함정인 이유

판정 모델이 받는 요청은 "이 지시를 따르라"가 아닙니다. *hook 입력*에 대한 판정을 내놓으라는 요청입니다. 명령문으로 쓰면 모델은 두 단계를 거쳐야 합니다.

1. 작성자가 원하는 행동을 파악합니다("X를 막아라").
2. 그 행동을 판정 어휘로 바꿉니다("막는다"를 `ok: false`로).

방향이 깨지는 곳은 2단계입니다. 같은 `ok: false`라도 이벤트마다 뜻이 다르기 때문입니다.

| 이벤트 | `ok: false`의 뜻 | 함정 |
|---|---|---|
| `PreToolUse` | tool 호출을 거부합니다 | "X를 막아라"가 `false`가 되어야 합니다 |
| `Stop`·`SubagentStop` | **계속 일합니다**(이유가 에이전트에게 전달됩니다) | "빌드가 깨졌으면 계속하라"는 `false`가 되어야 하는데, "계속하라"가 승인처럼 들립니다 |
| `UserPromptSubmit`·`PostToolUse` | 턴을 끝냅니다 | — |

"계속하라"를 "진행해도 좋다, 곧 ok"로 받아들인 판정 모델은 `ok: true`를 돌려주고, 에이전트는 빌드가 깨진 채로 멈춥니다.

## 버티는 정책 문장 쓰기

1. **판정 조건으로 씁니다.** 두 결과를 판정 어휘 그대로 적습니다.
   - 약한 문장: `Block commands that touch production.`
   - 강한 문장: `Return ok:false if the command reads or writes a production host or credential; otherwise ok:true.`
   - Stop hook: `Return ok:false (keep working) if the last build or test run in the transcript failed or never ran; return ok:true only if a passing run is visible.`
2. **애매할 때의 기본값을 적습니다.** 안전용 gate라면 "확실하지 않으면 ok:false"라고 적어 두어야 애매한 입력이 통과가 아니라 차단으로 떨어집니다.
3. **canary를 둡니다.** hook마다 반드시 걸려야 하는 입력을 하나씩 준비합니다(가짜 파괴 명령, 실패한 테스트로 끝나는 transcript). 하네스를 올리거나 정책을 고칠 때마다 이 입력이 `ok: false`를 내는지 확인합니다. 한 번도 걸리는 걸 본 적 없는 gate는 검증되지 않은 gate입니다.
4. **판단이 기계적으로 가능하면 `command`를 씁니다.** 정규식이나 경로 검사로 정할 수 있는 규칙이라면 모델을 거쳐 봐야 방향이 뒤집힐 위험과 지연만 늘어납니다. LLM 판정 hook은 정말 판단이 필요한 규칙에만 씁니다.

## 두 번째 빈틈: 부수 효과 뒤에 오는 거부

같은 달 Claude Code의 TypeScript 플러그인 hook("mod")에서도 비슷한 함정이 드러났습니다. mod hook은 미들웨어처럼 동작합니다. 이벤트 `e`와 다음 단계로 넘기는 `next(e)`를 함께 받습니다. 이 구조 때문에 "거부"에 두 가지 뜻이 생깁니다.

| 거부를 둔 위치 | 실제 동작 | 정체 |
|---|---|---|
| `next(e)` **전**(아예 호출하지 않음) | 호출 자체가 실행되지 않습니다 | **gate**입니다. 부수 효과를 막습니다 |
| `next(e)` **후** | 호출은 이미 실행됐고, 돌아오는 결과를 감추거나 바꿀 수만 있습니다 | **필터**입니다. 결과는 가리지만 효과는 되돌리지 못합니다 |

changelog는 일주일에 걸쳐 이 둘을 갈라놓았습니다. 2.1.290부터는 자식 프로세스가 이미 실행된 뒤에 프로세스 실행을 거부하면 "호출은 실행됐고 플러그인이 결과를 감췄다"고 알립니다. 2.1.292부터는 config·state·env·agent 생성 hook이 `next(e)` 뒤에 거부하면 정상적인 거부가 아니라 hook *실패*로 보고합니다. 같은 버전에서, `next(e)`를 부른 뒤 중단된 턴에서 실패한 hook이 호출을 그대로 통과시키던 문제도 고쳤습니다. 하네스 스스로 "뒤늦은 거부는 차단에 성공한 것이 아니라 고장 난 hook"이라고 말하는 셈입니다.

앞의 교훈과 같은 이야기입니다. 코드로는 차단처럼 *보이는* 것이 실제로는 이미 일어난 일에 대한 보고일 수 있습니다. 그래서 이렇게 정리합니다.

- 비밀값 유출, 파괴적인 shell 명령, 프로세스 생성처럼 **막아야 하는** 일이라면 `next(e)`를 부르기 **전에** 판단하고 거부합니다. `next(e)` 뒤의 거부는 가림 처리일 뿐 보호 장치로 치지 않습니다.
- 읽기 전용이거나 몇 번 실행해도 결과가 같은 작업이라면 `next(e)` 뒤의 필터로 충분합니다. gate와 필터의 구분은 호출에 부수 효과가 있을 때만 의미가 있습니다.

## 같은 지점에 걸린 다른 변경(2026년 10월 기준)

- 2.1.295에서 **command·HTTP** hook에 `onFailure: "block"`이 생겼습니다. hook이 시작하지 못하거나 시간이 초과되면 통과시키지 않고 막습니다. 이 항목에는 `prompt`·`agent` hook 이야기가 없습니다. 같은 장치가 이 hook들에도 생겼는지는 확인하지 못했고, 지금은 여전히 판정 모델이 판정을 돌려주느냐에 기대고 있다고 가정합니다.
- 2.1.296에서 호출은 거부했지만 턴은 끝내지 않던 managed `prompt` hook을 고쳤습니다. "hook이 거부했다"와 "작성자가 기대한 결과"가 어긋난 또 하나의 사례입니다.

이 동작들은 일주일 사이에 여러 번 바뀌었습니다. 검증한 버전을 고정해 두고, 업그레이드할 때마다 canary를 다시 돌립니다.

## 이 판단이 틀리는 경우

prompt hook이 자유 문장 대신 `deny_if`·`allow_if` 같은 구조화된 정책 필드로 바뀌면 방향을 해석하는 단계가 사라집니다. 그러면 "판정 조건으로 쓰라"는 조언도 필요 없어집니다. 그전까지 저는 자유 문장으로 쓴 hook 정책을 모두 검증되지 않은 분류기로 취급합니다.

## Sources

- Claude Code changelog, 2.1.288–2.1.296 항목 — https://code.claude.com/docs/en/changelog (2026년 10월 확인)
- Claude Code hooks 문서, prompt 기반·agent 기반 hook 절(이벤트별 `ok`·`reason` 의미)
