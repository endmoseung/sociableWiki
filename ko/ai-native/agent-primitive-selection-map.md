---
type: reference
title: "코딩 에이전트 primitive 선택 지도 — CLAUDE.md vs Skill vs Subagent vs Hook vs MCP"
description: "재사용할 행동을 Claude Code의 어느 primitive에 담을지, 우선순위 순서로 정하는 라우팅 표."
tags: [claude-code, skills, subagents, hooks, mcp]
date: 2026-06-07
source: "original — Claude Code 공식 문서와 두 편의 커뮤니티 글을 정리 (하단 Sources 참고)"
relates: []
---

# 코딩 에이전트 primitive 선택 지도

코딩 에이전트에게 어떤 일을 *반복해서, 제대로* 시키고 싶을 때는 그 행동을 담을
**primitive**를 하나 고르게 됩니다. 2026년 중반에 Claude Code 스택은 primitive
다섯 개로 정리됐는데, 여기서 엉뚱한 걸 고르는 게 "재사용하려고 만든" 워크플로가
썩어버리는 가장 흔한 이유입니다. 이 글은 각 primitive를 어떻게 작성하느냐가
아니라, **어떤 걸 집어야 하느냐**를 정리한 선택 지도입니다.

한 단계 아래에는 *"subagent를 띄울까, 아니면 한 context에 머물까?"* 라는 더 좁은
질문이 있습니다. 그건 이미 "이 행동은 에이전트가 실행하는 절차다"라고 결론난
뒤에야 의미가 있어요. 이 지도는 그보다 한 단계 위에 있습니다. *이 행동은 애초에
어느 primitive에 속하나?*

이 지도는 **의미(semantics)로 찾아보는** *행동별* 라우팅 표입니다. 행동 하나를
찾으면 그게 어디에 사는지 알려주는 식이죠. 이건 **부트스트랩 순서가 아닙니다.**
"빈 `.claude/`에서 뭘 먼저 만들지?"는 비용 순으로 정렬되는 완전히 다른 축입니다
(작성 비용이 싼 것부터: Skill → Hook → Subagent). 이 지도의 위에서 아래 순서를
도입 순서로 잘못 읽는 게, 하네스가 쓸모 있는 일을 하기도 전에 과하게 부풀려지는
전형적인 경로입니다.

## 2026년의 구조 변화 (무엇이 바뀌었나)

- **Command가 Skill로 합쳐졌습니다.** 옛 `.claude/commands/`는 레거시 경로로
  아직 동작하지만, 이제 정본은 `.claude/skills/`(프로젝트)와
  `~/.claude/skills/`(개인)입니다. "슬래시 커맨드"는 이름으로 호출하는 skill일
  뿐입니다.
- **Skill이 스스로 발동할 수 있습니다.** skill의 `description:`은 에이전트가
  현재 작업과 대조해 그 skill을 알아서 켤지 판단하는 근거입니다. 수동 호출만
  되던 옛 command와 갈리는 결정적 지점이에요.

## 다섯 primitive — 한 줄 요약

| Primitive | 정체 | 이럴 때 집는다 |
|-----------|------|----------------|
| **CLAUDE.md** | 항상 로드되는 프로젝트 context | *매* 턴 유지돼야 하는 정적 사실 — 아키텍처, 컨벤션, "승인 전엔 커밋 금지" |
| **Skill** | **main context**에서 도는 재사용 프롬프트·절차 | 이름이나 작업 매칭으로 부르고 싶은 반복 *워크플로*(배포, 스타일 점검, 문서 생성) |
| **Subagent** | **격리된 context 창**에서 도는 작업 핸들러 | 로그·검색 덤프로 main context를 채워버릴 무거운 곁일 — 요약만 돌려받는다 |
| **Hook** | 하네스가 발동하는 이벤트 기반 셸 | 라이프사이클 이벤트에 대한 자동 반응(수정 후 lint, bash 명령 차단). 에이전트가 아니라 *하네스*가 실행한다 |
| **MCP** | 외부 시스템 연동 | DB·API·SaaS(이슈 트래커, 디자인 툴, GitHub)를 네이티브 도구로 붙일 때 |

## 결정 순서

1. **트리거 없이 매 턴 유지돼야 하나?** → CLAUDE.md. (항상 context 예산을
   먹으니 가볍게 유지하세요.)
2. **이벤트에 대한 자동 반응이고, 에이전트가 "깜빡해도" 반드시 돌아야 하나?**
   → Hook. 메모리나 선호 설정으론 이걸 보장 못 합니다. 실행을 보장할 수 있는 건
   하네스뿐이에요.
3. **외부 시스템에 닿나?** → MCP — *다만 이 트리거는 과발동합니다.* 더 싼
   기본값은 CLI 호출을 Skill로 감싸는 것이고, MCP는 실제 문턱을 넘어야 합니다
   (예: 일회성 셸 명령이 아니라 타입이 잡힌 도구와 상시 연결이 필요할 때).
   서버 값을 치르기 전에 그 문턱을 통과시키세요.
4. **에이전트가 수행하는 반복 절차인가?** → Skill(기본값) — 5번에 걸리지 않는
   한.
5. **그 절차가 버려질 출력(검색, 로그, 파일 덤프)으로 main context를
   범람시키나?** → Subagent, 또는 `context: fork`를 단 Skill.

## 핵심 skill frontmatter (같은 파일이 행동을 바꾸는 법)

| 필드 | 효과 |
|------|------|
| `description` | 자동 발동 트리거 — 에이전트가 작업과 대조한다 |
| `disable-model-invocation: true` | 수동 전용(`/name`). 되돌릴 수 없는 동작에 쓴다 — 에이전트가 절대 알아서 쏘면 안 되는 `/deploy` 같은 것 |
| `user-invocable: false` | 반대 — 에이전트는 읽고 자동 발동할 수 있지만 `/` 메뉴에는 숨겨진다 |
| `context: fork` | 이 skill을 main context가 아니라 격리된 subagent에서 실행(선택적으로 `agent:` 타입 지정) |
| `allowed-tools` | 도구 범위 제한, 예: `Bash(npm:*)` |
| `paths` | skill이 자동 로드되는 조건을 glob으로 제한 |

그래서 **Skill과 Subagent가 늘 다른 파일인 건 아닙니다.** `context: fork` 한 줄이
skill을 subagent 격리 작업으로 바꿔줍니다. primitive를 고르는 질문은 부분적으로
frontmatter 질문인 셈이에요.

## 하드 제약 (설계할 때 이걸 피해서 짠다)

- **Subagent는 subagent를 못 띄웁니다.** 중첩 위임이 필요하면 main 대화에서
  체인으로 잇거나 Skill을 쓰세요. 오케스트레이션 로직이 최상위에 머무는 이유 중
  하나입니다.
- **Subagent는 깨끗하게 격리된 context에서 시작합니다.** 당신의 히스토리도,
  당신이 부른 skill도, 이미 읽은 파일도 못 봅니다. 위임 메시지에 필요한 걸 전부
  담아야 해요. 물론 이게 바로 그들의 가치이기도 합니다 — context 격리.
- **MCP 서버는 명시적으로 부여하지 않는 한** 네이티브 Read/Write/Bash를 물려받지
  않습니다.
- **Worktree 격리(2026):** fork된 subagent에 전용 git worktree를 줘서 병렬 수정이
  충돌하지 않게 할 수 있습니다 — 비싸니, 에이전트가 실제로 파일을 동시에 고칠
  때만 씁니다.

## 실무에서 챙길 교훈

- **줄 수가 많다고 더 좋은 지시가 아닙니다.** Skill과 subagent는 *포괄적*이 아니라
  *유지보수 가능*해야 합니다 — 규칙을 벽처럼 쌓기보다 간결하고 잘 구조화된 안내가
  낫습니다.
- **프로젝트 skill(`.claude/skills/`)은 커밋하세요.** 그래야 팀 전체가 같은
  커맨드·기준·단축을 공유합니다 — 집단 지성을 재사용 가능한 primitive로 굳히는
  일이에요.
- **Plugin**은 skill + subagent + hook + MCP를 하나의 배포 단위로 묶습니다 —
  팀 간 공유에 씁니다.

## TL;DR

primitive 다섯 개, 우선순위 순으로 고릅니다: **항상 유지될 사실 → CLAUDE.md;
보장된 이벤트 반응 → Hook; 외부 시스템 → MCP; 반복 절차 → Skill; context를
범람시키는 곁일 → Subagent(또는 `context: fork`).** skill 대 subagent 경계는
별도 파일이 아니라 frontmatter 플래그 한 줄인 경우가 많습니다. 그리고 그 벽을
기억하세요 — subagent는 subagent를 못 띄우니, 오케스트레이션은 최상위에
남습니다.

## Sources

- [Claude Code sub-agents 공식 문서](https://code.claude.com/docs/en/sub-agents)
- [alexop.dev — Understanding the Claude Code full stack](https://alexop.dev/posts/understanding-claude-code-full-stack/)
- [BSWEN — Subagents & Skills in Claude Code](https://docs.bswen.com/blog/2026-04-09-subagents-skills-claude-code/)
