---
type: reference
title: "Claude Code 플러그인 저작 체크리스트: 로컬 테스트가 놓치는 것들 (경로 · 버전 · 트리거 · publish receipt)"
description: 로컬 .claude/ 폴더에서 잘 돌던 플러그인이 배포·설치되는 순간 조용히 깨질 수 있다. 경로·버전·트리거와 revision-bound publish receipt가 그 대부분을 잡아낸다.
tags: [claude-code, plugins, packaging, distribution, checklist, verification]
date: 2026-06-24
source: original
relates: []
---

# Claude Code 플러그인 저작 체크리스트: 로컬 테스트가 놓치는 것들

## 한 줄 요약

로컬 `.claude/` 폴더에서 완벽하게 돌던 플러그인이, 마켓플레이스로 배포돼 설치되는 순간
**조용히** 깨질 수 있습니다. 에러 하나 없이 그냥 안 걸립니다. 설치 쪽 문제 대부분은 세 축이
잡습니다. **경로, 버전, 트리거.** 마지막 순간의 거짓말은 네 번째 게이트가 잡습니다.
정확한 revision/worktree에 묶인 **publish receipt**입니다. 이건 *만드는 동안* 보는
체크리스트입니다. 플러그인을 작성한 바로 그 폴더에서 테스트할 때는 절대 드러나지 않는 부분이죠.

각 체크는 같은 모양입니다. **왜 깨지나 → 규칙 → 셀프 체크.**

## 1. 경로 / 이식성 — 절대 경로는 다른 머신에서 죽는다

- **왜 깨지나:** 설치된 사본은 여러분이 작성한 그 자리에 있지 않습니다.
  `~/.claude/plugins/cache/<marketplace>/<plugin>/<version>/...` 에 놓이는데, 이 경로는
  머신마다 다르고 버전마다도 다릅니다. dev 체크아웃에서 잘 돌던 하드코딩된
  `/Users/<you>/...` 나 `~/Documents/...` 는 동료 머신에서는 아무 데도 안 가리킵니다.
- **규칙:** 플러그인 자기 자산(스킬·에이전트·hook이 읽는 `lib`, `template`, 설정 파일 등
  모든 리소스)은 **`${CLAUDE_PLUGIN_ROOT}/...`** 로 참조하세요. 플러그인 hook이나 스킬이
  실행될 때 Claude Code가 이 env var에 설치 루트를 주입해 주기 때문에, 플러그인이 실제로
  어디에 떨어졌든 올바르게 풀립니다.
- **코드와 상태의 분리:** 플러그인 **코드**는 `${CLAUDE_PLUGIN_ROOT}` 아래에 살고, 실행 중에
  생기는 **출력/상태**는 *대상* 레포의 `$PWD` 아래에 씁니다. 플러그인 디렉토리로 되돌려
  쓰면 안 됩니다. 플러그인에 함께 실린 hook이라면, 자산은 플러그인 루트에서 읽되 작업 상태는
  지금 조작 중인 프로젝트 안에 쓰는 게 맞습니다.
- **셀프 체크:** `grep -rE '/Users/|/home/|/Volumes/' <플러그인-디렉토리>/` → 결과가 0이어야
  합니다(문서·예제는 제외). hook 커맨드 문자열 안의 맨 `~/` 도 같은 함정입니다.

## 2. 버전 / 동기화 — 안 올리면 내 수정이 설치된 쪽에 영영 안 닿는다

- **왜 깨지나:** 설치된 쪽은 오직 `plugin.json` / `marketplace.json` 안의 `version` 으로만
  업데이트를 인식합니다. 코드를 고쳐 놓고 *버전 올리는 걸 깜빡하면* → 설치한 사용자는 계속
  옛날 버전을 돌리고, "main에선 고쳐졌어요"는 이미 설치한 모두에게 거짓말이 됩니다.
- **규칙 — 동작이 바뀌면 반드시 bump:** 동작을 바꾸는 PR(코드, worker prompt, hook, 설정/상태
  파일)은 **반드시** 버전을 올립니다. 버그픽스·하드닝 = **patch**, 새 기능 = **minor**,
  breaking change = **major**.
- **규칙 — 두 파일을 항상 맞춘다:** `<플러그인-디렉토리>/.claude-plugin/plugin.json` 의
  `version` 과, **루트** `.claude-plugin/marketplace.json` 안 그 플러그인의 버전은 **항상
  같아야** 합니다. (레이아웃 함정 하나: `plugin.json` 은 플러그인 디렉토리 바로 아래가 아니라
  `.claude-plugin/` 아래에 있습니다.)
- **예외:** 문서·README만 바꾼 PR은 bump가 필요 없습니다. 다만 같은 변경 세트에 동작 변경이
  섞여 있으면 함께 올리세요. 수정과 그 버전을 갈라놓지 마세요.
- **셀프 체크(PR 열기 전):** "이거 동작 바뀌었나? bump 했나? 두 파일 값이 같나?"
  `jq -r .version <플러그인-디렉토리>/.claude-plugin/plugin.json` 결과를 루트
  `marketplace.json` 의 해당 항목과 비교합니다.
- **뼈아프게 배운 경험:** 제 플러그인 하나에서, 연속된 두 PR이 동작은 바꿔 놓고 bump를
  건너뛴 적이 있습니다. 그 바람에 배포된 origin은 옛 버전에 그대로 핀 박혀 있었고, 두 번째
  PR의 수정은 설치한 누구에게도 닿지 않았습니다. 결국 *오직 버전 bump만* 하는 세 번째 PR을
  따로 올려서야 풀렸습니다. 번호가 움직이기 전까지는 main의 수정은 아무 의미가 없었습니다.

## 3. 트리거 / 네이밍 — 설치는 커맨드 이름도, 경쟁 상대도 바꾼다

- **왜 깨지나(이름):** 로컬의 `/foo` 는 설치되면 `/plugin-name:foo` 가 됩니다(namespace가
  붙음). 트리거 표에 하드코딩된 **맨 `/foo`**, 혹은 다른 스킬 안의 "그다음 `/foo` 호출"은
  조용히 stale해집니다. 에러 없이 그냥 안 걸리죠. 깨지는 지점이 스킬 본문이 아니라 *호출부*라,
  스킬 파일 diff만 봐서는 못 잡습니다.
- **왜 깨지나(경쟁):** 이제 스킬의 `description:` 은 **함께 설치된 번들 형제들과 같은 매칭
  풀**에서 경쟁합니다. 여러분은 경쟁자 적은 풀에서 스킬 하나를 작성·테스트하지만, 설치는
  번들 안 형제 전부를 끌고 들어오고 각자 자기 `description:` 을 갖고 있습니다. 큰 번들 +
  겹치는 description → 스킬마다 auto-fire 확률이 떨어집니다(shadowing). 번들은 **작고
  응집력 있게** 유지하세요. 번들 크기는 단순한 패키징 편의가 아니라 *트리거 확률에 대한
  결정*입니다.
- **일반 규칙:** *테스트하는 단위가 배포하는 단위와 같아야 한다.* 로컬 스킬 하나를
  테스트하고 플러그인을 배포하는 건 이 규칙을 어깁니다. **설치된 번들** 기준으로 auto-fire를
  다시 테스트하세요. namespace 붙은 커맨드와 형제 `description:` 풀 전체를 포함해서요.
- **셀프 체크:** 패키징 전에 트리거·커맨드·README에서 맨 `/name` 을 전부 grep 하세요(각각
  `/plugin-name:name` 이나 명시적 alias로 바뀌어야 합니다). 설치 후에는 대표 프롬프트 하나로
  auto-fire가 실제로 한 번 걸리는지 확인하세요. 로컬 통과가 그대로 이어질 거라 가정하지 마세요.

## 4. Publish verification / receipt — 마지막 수정은 이전 증거를 stale하게 만든다

- **왜 깨지나:** PR이나 publish 직전의 마지막 변경은 흔히 "문서만", "manifest만", "install import만"
  입니다. 하지만 그 변경은 build/smoke 증거를 모은 뒤 package artifact, command name, model routing,
  loaded context를 바꿀 수 있습니다. 이전 worktree 상태에서 나온 green receipt는 현재 publish 후보를
  더 이상 증명하지 않습니다.
- **규칙:** 마지막 수정은 그 산출물에 대한 이전 증거를 무효화합니다. publish 직전 마지막 receipt는
  실제로 ship할 revision과 worktree fingerprint에 묶여야 합니다. 최소한 `git rev-parse HEAD`,
  dirty worktree 요약, command, exit status, timestamp를 남기세요. 의도적으로 dirty worktree를
  ship 후보로 다룬다면 receipt에 변경 파일을 적어야 합니다. commit hash만으로 산출물을 식별했다고
  말하면 안 됩니다.
- **Build/MCP 셀프 체크:** 마지막 수정 뒤 같은 worktree에서 build와 MCP smoke를 다시 돌립니다.
  sociableWiki 같은 플러그인은 영어와 한국어 read를 둘 다 smoke하세요. `list_topics`가 새 concept를
  보고, `read_doc`이 영어 정본을 돌려주고, `lang: "ko"`를 준 `read_doc`이 한국어 mirror를 돌려줘야
  합니다. receipt에는 그 관측이 어느 revision/worktree에서 나왔는지 적습니다.
- **Behavioral QA 셀프 체크:** 사용자가 만질 surface로 설치 동작을 실제로 몰아보세요. installer라면
  임시 대상 프로젝트가 필요합니다. 한 번 설치해 managed file import를 확인하고, 다시 설치해
  idempotency를 확인하고, 충돌하는 managed file을 만들어 prompt/failure semantics를 확인합니다.
  unit test는 도움이 되지만, QA 주장은 관측한 설치 행동이어야 합니다.

## 왜 하필 이 체크들인가, "그냥 더 테스트해"가 아니라

네 체크 아래 깔린 함정은 다 같습니다. **내가 테스트하는 것이 사용자가 실행하는 것과 다르다.**
사용자에게는 없을 절대 경로에서, 사용자는 볼 수 없는 버전 번호로, 설치가 끌고 들어올 형제들이
빠진 매칭 풀에서, 또는 더 이상 publish 후보가 아닌 worktree revision에서 테스트하는 거죠. 로컬
테스트가 틀린 게 아닙니다. 그냥 엉뚱한 산출물을 테스트하고 있는 겁니다. 해법은 "더 열심히
테스트해"가 아니라, 둘이 갈라질 수 있는 지점마다 테스트 산출물을 배포 산출물과 같게 만드는
것입니다. 이식 가능한 경로, 동작이 바뀔 때 함께 움직이는 버전, 설치된 번들 아래서 다시 돌리는
auto-fire 재테스트, 그리고 실제로 ship할 revision/worktree에 묶인 final receipt입니다.
