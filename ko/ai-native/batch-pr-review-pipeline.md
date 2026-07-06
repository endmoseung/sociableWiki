---
type: pattern
title: 병렬 서브에이전트 파이프라인으로 여러 PR 한 번에 리뷰하기
description: PR당 서브에이전트 1개로 여러 PR을 병렬 리뷰하되, 인라인 코멘트 라인은 pr-diff가 아니라 files API의 patch로 계산해야 GitHub이 거부하지 않는다.
tags: [ai-native, code-review, subagents, github-api, automation, inline-comments]
date: 2026-06-15
source: original
relates: []
---

# 병렬 서브에이전트 파이프라인으로 여러 PR 한 번에 리뷰하기

열린 PR 10여 개에 한 번에 코드 리뷰를 달아야 했을 때 만든 파이프라인이다. PR당
read-only 서브에이전트 1개가 분석을 맡고, lead 프로세스 하나가 라인 매핑과 게시를
담당한다. 잘 굴러갔지만, 그 과정에서 GitHub 인라인 코멘트 API의 함정 두 개를 밟았다.
틀리기 쉽고 디버깅이 까다로운 지점이다. 절차와 함정 모두 어떤 GitHub 리뷰 자동화에도
그대로 옮겨간다.

## 핵심 결론 (먼저)

1. **인라인 코멘트의 라인 번호는 `gh api .../pulls/N/files`의 `patch`를 기준으로
   계산한다.** `gh pr diff`가 보여주는 라인을 믿으면 `422 "Line could not be resolved"`로
   터진다. 둘이 base를 다르게 잡아서 라인 번호가 어긋나기 때문이다.
2. **코드 anchor 텍스트로 라인을 찾을 땐 anchor를 충분히 구체적으로 잡는다.**
   `Suspense`, 텍스트 입력 컴포넌트, 쿼리 훅 같은 일반 토큰은 의도한 JSX보다
   파일 상단 `import { ... }` 줄에 먼저 매칭돼서 코멘트가 엉뚱한 줄에 달린다.
3. PR당 서브에이전트 1개로 **병렬 read-only 리뷰 → 구조화된 결과 반환 → lead가 라인
   매핑 + 언어 게이트 + 일괄 게시**가 깔끔하게 확장됐다.
4. **본인이 author인 PR은 approve/request-changes를 못 한다.** `event: "COMMENT"`만
   된다. 게시 전에 `gh api user --jq .login`으로 로그인 계정을 먼저 확인한다.

## 함정 1 — `gh pr diff`가 세는 줄 번호와 GitHub API 인라인 줄 번호가 다르다 (★ 핵심 델타)

인라인 코멘트는 GitHub이 diff에 실제로 표시한 라인에만 달린다. 그런데
`gh pr diff N`이 출력하는 unified diff의 라인 번호와, 리뷰 API
(`POST .../pulls/N/reviews`의 `comments[].line`)가 인식하는 파일 라인이 어긋날 수 있다.

실측한 예: 새로 추가한 파일 하나를 `gh pr diff`는 hunk 헤더 `@@ -0,0 +1,285 @@`로
(285줄) 보여줬는데, `gh api .../files`의 `patch`는 `@@ -0,0 +1,224 @@`로(224줄)
보여줬다. `gh pr diff` 번호로 계산한 `line: 218`은
`422 Unprocessable Entity / "Line could not be resolved"`로 거부됐고, files API
patch로 다시 센 `line: 159`가 정상 수용됐다. (둘이 다른 이유: base/merge-base를
다르게 잡거나, `gh pr diff`가 다른 파일 블록을 합쳐서 보여주는 경우가 있어서다.)

→ **규칙:** 인라인 라인은 항상 files API로 계산한다.

```bash
gh api repos/<owner>/<repo>/pulls/<N>/files --paginate \
  --jq '.[] | select(.filename | test("<file>$")) | .patch' > /tmp/file.patch
# patch의 @@ 헤더에서 +시작 라인을 읽고, +/context 라인을 세서 RIGHT-side 파일 라인을 구한다.
```

라인 계산 로직(unified diff → 새 파일 라인): `@@ ... +S,n @@`에서 시작값 `S`를 잡고,
`+`(추가)·` `(context) 라인마다 +1, `-`(삭제) 라인은 새 파일 라인을 증가시키지 않는다.

리뷰 게시 payload(인라인 + 본문 + COMMENT):

```bash
# payload.json: {commit_id, event:"COMMENT", body:"<요약>", comments:[{path,line,side:"RIGHT",body}]}
gh api repos/<owner>/<repo>/pulls/<N>/reviews -X POST --input payload.json \
  --jq '.state + " " + .html_url'
```

`side: "RIGHT"`를 명시해두면 모호함이 줄어든다. 이 PR이 건드리지 않은 라인에는
인라인이 안 달리니, 그런 지적은 리뷰 **본문**에 `파일:맥락`으로 녹여서 fallback한다.

## 함정 2 — anchor가 너무 일반적이면 import 줄에 매칭된다

서브에이전트가 "이 라인을 지적"이라고 줄 때, 라인 번호 대신 **코드 텍스트(anchor)**로
받고 lead가 diff에서 그 텍스트의 라인을 찾는 방식이 견고하다(서브에이전트가 본
라인 번호는 누적 diff 기준이라 못 믿는다). 단, anchor가 `Suspense`, 텍스트 입력
컴포넌트 이름, 쿼리 훅처럼 파일 상단 `import { ... }`에도 등장하는 일반 토큰이면
**import 줄에 먼저 걸려서** 코멘트가 엉뚱한 줄에 달린다(실측 3건).

→ **규칙:** anchor는 그 줄에서만 나오는 형태로 구체화한다. 예: 쿼리 훅 이름만
쓰면(❌, import에도 있음) → 그 훅 이름에 호출 인자까지 붙이면(✅). 매칭 우선순위도
`+`(추가) 라인 → context 순으로 둬서 import 블록을 가급적 피하게 한다.

## 파이프라인 (여러 PR을 한 번에)

```
1. 대상 확정   gh pr list --state open --json number,title,author,isDraft
              + gh api user(.login)로 셀프-author 판별
              + 이미 리뷰한 PR 제외(.../pulls/N/reviews에 내 login 있나)
2. 병렬 리뷰   PR당 서브에이전트 1개(general-purpose), READ-ONLY.
              프롬프트에 repo 룰(아키텍처·타입세이프·디자인 토큰·리뷰 voice) +
              diff 성격별 의심 포인트를 실어준다. 결과는 고정 스키마로:
              { verdict, summary, inline:[{path, anchor, severity, body}], VERIFIED }
3. 라인 매핑   lead가 anchor → files API patch 라인으로 변환(함정 1·2 적용).
              못 찾으면 본문 fallback.
4. 게이트      사람이 읽을 output이니 언어 품질 게이트를 통과시킨다.
5. 일괄 게시   PR마다 reviews API로 event:COMMENT. 작은 PR 1개로 먼저 시범 게시해
              라인 수용을 검증한 뒤 나머지를 일괄 게시한다.
```

서브에이전트는 **분석만, 게시는 lead가** 한다. 잘못된 라인으로 헛 API 콜이 나가는 걸
막고, 언어 게이트와 중복 검사를 한 곳에서 통제하기 위해서다. (서브에이전트에
`git branch -D` 같은 정리 명령을 맡기면 deny 룰에 걸려 경고가 뜬다 — read-only로
못박을 것.)

## 부수 교훈

- **서브에이전트에게 의심을 코드로 검증하게 시킨다.** "deep 객체 변환이 id-keyed
  map을 망가뜨리나?"를 `node -e`로 재현시키니 거짓 양성과 진짜 신호가 갈렸다.
  프롬프트에 "claim하기 전에 실제 코드·인터셉터·타입을 읽어 확인하라"를 박는다.
- **로컬 working tree ≠ PR HEAD.** 다른 브랜치를 잡고 있으면 `yarn test` 결과가
  stale하다. 리뷰는 `git show <PR-SHA>:<path>` / `gh pr diff` 기준으로 한다.
- **verdict 분포로 우선순위가 보인다.** 이번 배치에서 진짜 블로커는 딱 1개였고
  (중첩 camelCase 키 미변환 + 응답 envelope 누락), 나머지는 낮은 심각도였다.
  블로커 PR엔 "선행 PR 머지로 해소되니 순서를 맞추라"는 의존성 메모까지 같이 남겨서
  작성자가 바로 움직이게 했다.

## 출처

- 직접 실측: 열린 PR 약 13개에 리뷰를 게시한 세션(2026-06-15).
  `422 Line could not be resolved` 재현은 새로 추가한 모달 파일에서 나왔다 —
  `gh pr diff`는 285줄, files API는 224줄로 보여줬다.
- GitHub REST: `POST /repos/{o}/{r}/pulls/{n}/reviews`(`comments[].line`/`side`),
  `GET .../pulls/{n}/files`.
