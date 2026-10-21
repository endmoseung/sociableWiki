---
type: principle
title: "agent가 상황을 파악하는 단계도 코드 실행 단계입니다"
description: "coding agent는 신뢰 확인 창을 띄우기도 전에 상황 파악용 git 명령을 뒤에서 실행하고, git은 저장소 자체의 설정을 따릅니다. 그 설정에는 실행할 프로그램을 지정하는 키가 있으니, '저장소 읽기'는 아무도 막지 않는 실행 경로입니다."
tags: [agent-security, git, trust-boundary, sandboxing, hooks]
date: 2026-10-10
source: "External-derived — the GitSpawn disclosure (Manifold Security) and follow-up write-ups; see Sources."
relates: [ai-native/sandboxing-enables-autonomy, ai-native/eval-sandbox-attack-surface, ai-native/gate-outbound-channel-not-tool-call, ai-native/configured-is-not-effective]
---

# agent가 상황을 파악하는 단계도 코드 실행 단계입니다

coding agent는 뒤에서 `git status`와 `git diff`를 돌려 지금 저장소가 어떤 상태인지 파악합니다. 이 작업은 흔히 시작하자마자, 즉 작업 공간 신뢰 확인 창이 뜨기 **전에** 일어납니다. 또 tool별 승인 절차와 Bash sandbox **바깥**에서 돕니다. 모델이 tool을 호출하는 게 아니라 harness가 스스로 정찰하는 것이기 때문입니다.

그런데 git은 저장소 안의 `.git/config`를 그대로 따릅니다. 이 파일의 어떤 키는 git이 실행할 프로그램을 지정하고, git은 예를 들어 index를 새로 고칠 때 그 프로그램을 실행합니다. 둘을 합치면 "저장소를 읽어서 파악한다"는 더 이상 읽기가 아닙니다. 사용자 권한으로 코드를 실행하는 경로인데, 어떤 권한 규칙도 이 경로를 보지 못합니다. 신뢰 확인 창은 첫 코드 실행보다 *먼저*가 아니라 *나중에* 뜹니다.

## 문제가 구체적으로 드러난 사건

2026년 9월 Manifold Security가 "GitSpawn"을 공개했습니다. CLI coding agent 7개에서 찾은 문제 8건입니다. 기본 사례는 `core.fsmonitor`에 셸 명령을 넣어 둔 `.git/config`입니다. agent가 뒤에서 `git status`를 돌리면 git이 index를 새로 고치면서 fsmonitor hook을 확인하고, 그 명령을 실행합니다. git은 설계대로 움직였을 뿐이고, agent 쪽에서 git을 호출하기 전에 저장소 설정을 걷어 내지 않았던 겁니다.

공격이 성립하려면 전제 조건이 하나 있고, 내 노출 정도를 판단할 때 이 조건이 중요합니다. 디렉터리가 **`.git/`까지 포함한 파일 묶음으로** 들어와야 합니다. zip 파일, 공유 드라이브, 동기화 폴더, USB 같은 경로입니다. `clone`, `fetch`, `pull`은 `.git/config`를 옮기지 않으니, 악의적인 URL 하나만으로는 이 공격이 일어나지 않습니다. 공개 시점에는 실제 공격 사례가 보고되지 않았고, 영향받은 agent마다 수정 시기가 제각각이었습니다. 이런 글에 적힌 목록을 믿지 말고 각 vendor의 보안 공지를 직접 확인하세요.

## 바로 보이지 않는 결과 세 가지

**1. 키 하나를 막는 건 두더지 잡기입니다.** 공개된 내용 중에는 `core.fsmonitor` 경로를 이미 고친 agent에서 두 번째 문제가 나온 경우가 있었습니다. 내부의 다른 호출 경로가, 실행할 프로그램을 지정하는 *다른* 설정 키를 쓰고 있었습니다. 결함의 범주는 "fsmonitor"가 아니라 "저장소 설정을 물려받는 모든 백그라운드 git 호출"입니다. 그러니 키마다 막을 게 아니라 호출하는 자리마다 고쳐야 합니다. 상황 파악용 git 호출은 모두 설정을 덮어쓰는 옵션을 붙여 실행합니다. 예를 들면 이렇습니다.

```bash
git -c core.fsmonitor=false -c core.hooksPath=/dev/null status
```

**2. 널리 퍼진 사용자 쪽 해결책은 방향이 거꾸로입니다.** 여러 글이 `git config --global core.fsmonitor false`를 권했습니다. 하지만 git 문서에 나온 우선순위는 system < global < local(저장소) < worktree < 명령줄(`-c`, 또는 `GIT_CONFIG_COUNT` / `GIT_CONFIG_KEY_n` / `GIT_CONFIG_VALUE_n` 환경 변수 세트) 순서입니다. 저장소 안의 값이 내 global 값을 **덮어씁니다.** 공격자의 파일보다 위에 있는 건 명령줄이나 환경 변수로 넣은 설정뿐입니다. `safe.directory`도 도움이 안 됩니다. 압축을 푼 zip은 피해자 소유라서 소유권 검사를 그대로 통과하거든요. (이 우선순위 논리는 git 문서의 설정 순서에서 제가 추론한 것이고, 공개 자료에 적힌 내용은 아닙니다.)

**3. 내가 만든 harness도 호출하는 쪽입니다.** 이건 공개적으로 검증된 걸 본 적이 없는 가설입니다. 매 턴마다 `git status`를 돌리는 statusline 스크립트, HUD, hook은 같은 지점을 건드립니다. 그리고 이런 스크립트는 vendor가 만든 게 아니라서 어떤 vendor 패치도 이 부분을 고쳐 주지 않습니다. `git rev-parse`만 돌리는 hook은 index를 새로 고치지 않으니 fsmonitor 경로에는 해당하지 않습니다. 다만 프로그램을 지정하는 다른 키가 다른 하위 명령에 걸릴 수 있습니다. 짐작하지 말고 호출하는 자리를 하나씩 점검하세요.

## 제가 적용하는 방법

- **파일 묶음으로 받은 디렉터리를 여는 일은 신뢰할 수 없는 코드 실행으로 봅니다.** agent가 손대기 전에 `.git/config`에 프로그램을 지정하는 키가 있는지 확인합니다. `grep -nE 'fsmonitor|hooksPath|sshCommand|editor|pager|askpass' .git/config` 정도면 출발점은 되지만 빠짐없는 검사는 아닙니다. 아니면 sandbox나 VM 안에서 엽니다.
- **내가 관리하는 스크립트의 git 호출을 안전하게 바꿉니다.** 제 statusline과 hook 스크립트에서는 모든 git 호출에 `-c core.fsmonitor=false -c core.hooksPath=/dev/null`을 붙이거나, 스크립트 맨 위에서 `GIT_CONFIG_COUNT` 세트를 한 번 export합니다.
- **공격 경로 목록에 네 번째 항목을 더합니다.** 예전에는 agent의 공격 경로를 세 가지로 생각했습니다. 여는 저장소, 설치하는 패키지, 쓰는 설정입니다. 네 번째가 있습니다. **사람에게 무엇이든 묻기 전에 harness가 먼저 하는 정찰**입니다.

## 이 원칙이 틀리는 경우

agent가 이미 신뢰하는 곳에서 `git clone`으로 받은 저장소만 열고, harness 스크립트 어디에서도 index를 새로 고치는 git 명령을 부르지 않는다면, 공격의 전제 조건이 성립하지 않습니다. 그런 환경에서는 이 글이 소음에 가깝고, 설정을 덮어쓰는 옵션도 해는 없지만 꼭 필요하지는 않습니다.

## Sources

- Manifold Security, GitSpawn 공개 글(1차 자료): https://www.manifold.security/blog/ai-coding-agents-git-hijack
- Aviatrix의 CVE-2026-19592 위협 분석: https://aviatrix.ai/threat-research-center/malicious-git-configs-ai-agents-cve-2026-19592/
- Byteiota 요약 글. VS Code가 같은 유형의 버그를 2021년에 고쳤다는 내용이 있습니다: https://byteiota.com/gitspawn-ai-coding-agents-hit-by-git-config-rce-flaw/
- 결과 2의 우선순위 논리는 위 자료가 아니라 git 문서의 설정 파일 순서에서 가져왔습니다.
