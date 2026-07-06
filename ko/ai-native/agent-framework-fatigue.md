---
type: deep-dive
title: "Agent framework 피로: framework를 건너뛰고 raw API·vendor SDK를 쓸 때"
description: "LangGraph·CrewAI는 문제가 graph 모양이거나, cross-session이거나, 진짜 multi-agent일 때만 꺼낸다. 아니면 raw API나 vendor SDK가 더 빨리 나오고 lock-in도 적다."
tags: [agent-frameworks, langgraph, crewai, vendor-sdk, mcp, orchestration]
date: 2026-06-10
source: "외부 리포트 종합 (Sources 참고)"
relates: []
---

## 한 줄 요약

2026년 중반 들어 "framework 아예 안 쓴다" 쪽이 소수 취향에서 주류로 넘어왔습니다. framework(LangGraph, CrewAI, AutoGen)가 나빠서가 아닙니다. 팀이 문제 모양을 따지지 않고 *기본값*으로 framework부터 집어드는 게 문제죠. 그러고 나면 setup 비용, 업그레이드 churn, 머릿속 모델의 복잡도까지 다 떠안는데 정작 그만한 이득은 없습니다.

제 기본값은 이렇게 바뀌었습니다. **raw API나 vendor SDK에서 시작하고, 구체적인 벽에 부딪혔을 때만 framework 복잡도를 더한다.** 그 벽은 딱 세 가지 중 하나입니다. graph 모양의 control flow, cross-session state, 그리고 3개 이상 agent의 협업. 이 셋 중 아무것도 아니면, framework는 아키텍처인 척하는 overhead일 뿐입니다.

## 실패는 늘 같은 패턴으로 온다

함정이 뻔합니다. 팀이 데모 하나를 framework로 성공시키고, 그걸 집안 기본값으로 삼습니다. 그리고 production에 가서야, 정확히는 iteration 속도가 중요해지고 나서야 overhead를 발견하죠.

> "가지 하나 달린 선형 pipeline을 state machine framework로 감쌌더니, prompt 하나 손보거나 threshold 하나 조정할 때마다 type 정의, node signature, graph topology를 다 유지보수해야 했다. framework의 overhead가 실제 문제의 복잡도를 넘어섰다."

이 한 문장에 anti-framework 주장이 다 들어 있습니다. framework의 overhead가 문제의 복잡도를 넘어섰다는 것. framework는 문제가 *진짜로* framework 모양일 때만 값을 합니다. production에 나오는 agent 문제 대부분은 그렇지 않고요.

## 판단 heuristic: 세 가지 질문

framework를 집어들기 전에 이 셋에 답해 보세요. 셋 다 "아니오"면 framework는 필요 없습니다.

**1. control flow가 graph 모양인가?**
chatbot은 pipeline입니다. document processor도 pipeline이고, cron job도 pipeline이죠. control flow가 "graph 모양"이 되는 건, 진짜 조건 분기가 있거나, state를 이고 가는 loop가 있거나, 이질적인 agent들 사이를 동적으로 routing할 때뿐입니다. `if` 하나 붙은 pipeline은 여전히 pipeline입니다. LangGraph가 필요 없어요.

**2. cross-session state가 필요한가?**
agent가 하나의 context window 안에서 시작하고 끝나고, run 사이에 유지돼야 할 state가 없다면, framework의 persistence·checkpointing 기계는 필요 없습니다. raw API의 structured output만으로 충분합니다.

**3. 협업하는 agent가 2개를 넘는가?**
여기가 framework가 실제로 값을 하는 자리입니다. agent 1개 + tool → raw API나 vendor SDK. 핸드오프가 명확한 agent 2개 → 대체로 vendor SDK면 됩니다. topology가 진짜인 agent 3개 이상 → 이때부터 framework overhead가 스스로를 정당화하기 시작합니다.

## "framework 건너뛰기" 스택

- **agent 1개 + tool 1~2개** → raw API(Anthropic / OpenAI) + structured output. framework overhead가 0입니다.
- **single-model agent에 tool use** → vendor SDK(Claude Agent SDK / OpenAI Agents SDK). tool loop, tracing, MCP를 대신 처리해 줍니다.
- **structured workflow가 필요한 TypeScript 앱** → Vercel AI SDK. 되도록 hexagonal 경계 뒤에 둬서 LLM provider를 딱딱한 의존이 아니라 갈아끼울 수 있는 adapter로 만드세요.
- **Python인데 magic을 최소화하고 싶다** → smolagents(HuggingFace). 읽을 만한 코드 약 1,000줄이고, CodeAgent가 JSON tool call 대신 Python을 써서 LLM 호출을 ~30% 줄입니다. 대신 built-in checkpointing은 없습니다. 연구용 workflow나 HuggingFace 생태계 팀에 잘 맞습니다.

## framework가 *맞는* 선택인 경우

이 흐름은 *과용*에 대한 반작용이지, framework를 싸잡아 거부하는 게 아닙니다. 다음 경우엔 framework가 제 overhead 값을 합니다.

| 상황 | 맞는 선택 |
|---|---|
| checkpointing이 필요한 장시간(수 시간+) agentic 작업 | LangGraph |
| audit trail + rollback이 필수(규제 산업) | LangGraph |
| 동적 routing + shared state를 가진 agent 3개 이상 | LangGraph 또는 CrewAI |
| 분해가 명확한 role 기반 multi-agent | CrewAI |
| TypeScript 네이티브 full-stack agent 앱 | Mastra |
| Anthropic 네이티브, managed agent, MCP 위주 | Claude Agent SDK |

## vendor SDK의 부상이 진짜 구조 변화다

"framework 건너뛰기"가 실현 가능해진 건, vendor SDK가 production 등급 도구로 성숙했기 때문입니다.

- **OpenAI Agents SDK** — 2026년 3월 GA. handoff, guardrail, tracing, streaming. Swarm을 대체합니다.
- **Claude Agent SDK** — 2026년 4월 GA. Claude Code 내부를 돌리는 SDK고, MCP·A2A·hook·computer use를 first-class primitive로 다룹니다.
- **Google ADK** — 2026년 4월 GA. multimodal, Gemini 네이티브.

이 SDK들은 80% 케이스(agent 1개 + tool, 잘 정의된 작업)를 어떤 framework보다 낮은 setup 비용으로 처리합니다. "multi-agent 협업이나 graph 모양 control flow가 필요할 때만 CrewAI나 LangGraph를 꺼내라"는 말은 이제 삐딱한 소수 의견이 아니라 주류 조언입니다.

## MCP가 lock-in 논리를 녹여 없앤다

framework lock-in의 오래된 논리는 이랬습니다. "못 바꿔요, tool 통합이 전부 framework 전용이라." MCP(Model Context Protocol)가 이걸 무너뜨립니다. MCP server로 만든 tool 통합은 framework끼리도, vendor SDK끼리도 portable합니다. 한 번 만들면 어디서든 돌아가죠.

그래서 "vendor SDK에서 시작해서 복잡도가 정당화될 때 framework로 migration하는" 경로가 안전해집니다. 예전엔 framework를 바꾸면 모든 tool 통합을 다시 짜야 했지만, 이제는 tool이 migration을 살아남습니다. **처음부터 tool을 MCP server로 만들면** 그 optionality를 공짜로 챙깁니다.

## 데모에서는 안 보이는 overhead

- **LangGraph** — 학습 곡선이 가장 가파릅니다. node/edge/state schema를 *iteration마다* 유지보수해야 하고, 요구사항이 바뀌면 graph topology가 통째로 다시 짜입니다.
- **CrewAI** — built-in checkpointing이 없어서 run 도중 server가 재시작하면 전부 날아갑니다. production 기준 agent 성공률 약 80%, 비슷한 LangGraph 구현 대비 token overhead ~18%. 계층형 crew는 순환 위임에 빠질 수 있습니다.
- **AutoGen** — 4-agent × 5-round GroupChat이면 최소 20+ LLM 호출입니다. 새 작업 기준으로는 사실상 maintenance mode입니다.

## 솔직한 trade-off 표

| 접근 | setup 비용 | iteration 속도 | 복잡도 상한 | lock-in |
|---|---|---|---|---|
| raw API + structured output | 최저 | 최고 | 낮음 | 없음 |
| vendor SDK | 낮음 | 빠름 | 중간 | provider |
| smolagents | 낮음 | 빠름 | 중간 | 없음 |
| CrewAI | 중간 | 프로토타입은 빠름 | 중간 | framework |
| LangGraph | 높음 | 느림 | 높음 | LangChain 생태계 |
| Mastra | 중간 | 빠름(TS) | 높음 | framework |

## 새 프로젝트에 대한 제 권고

1. **raw API나 vendor SDK로 시작하세요.** 문제가 진짜인지부터 돌아가는 것으로 증명하고, 그다음에 설계합니다.
2. **구체적인 벽에 부딪혔을 때만 framework 복잡도를 더하세요.** checkpointing이 필요해졌거나, multi-agent 협업이 진짜로 어렵거나, control flow가 graph 모양일 때. 그 전엔 아닙니다.
3. **tool은 처음부터 MCP server로 만드세요.** 나중의 고통스러운 migration에 대한 가장 싼 보험입니다.
4. **속도 때문에 CrewAI로 시작했다면, LangGraph migration을 필요해지기 전에 계획해 두세요.** migration이 만만치 않아서, 마감에 쫓기며 그 사실을 깨닫는 게 최악의 실패 모드입니다.

## Sources

- [Why I Stopped Using LangGraph — DEV Community](https://dev.to/deadlocker/why-i-stopped-using-langgraph-4jo2)
- [LangGraph vs CrewAI vs AutoGen in 2026 — DEV Community](https://dev.to/cristian_iridon_286794874/langgraph-vs-crewai-vs-autogen-in-2026-pick-the-right-ai-agent-framework-or-4m2c)
- [Best AI Agent Frameworks 2026 (production rankings) — AliceLabs](https://alicelabs.ai/en/insights/best-ai-agent-frameworks-2026)
- [2026 on-device agents — Hacker News](https://news.ycombinator.com/item?id=46471524)
