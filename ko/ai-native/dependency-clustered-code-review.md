---
type: pattern
title: "큰 변경은 파일 수가 아니라 의존 관계로 묶어 리뷰한다"
description: "import, 호출, 공통 계약, 데이터 흐름을 기준으로 파일을 묶으면 각 리뷰어가 하나의 동작을 온전히 이해할 수 있다."
tags: [ai-native, code-review, subagents, dependency-graph, pull-requests]
date: 2026-07-16
source: original
relates: [ai-native/independent-verification-of-review-findings, ai-native/batch-pr-review-pipeline]
---

# 큰 변경은 파일 수가 아니라 의존 관계로 묶어 리뷰한다

큰 PR은 컨텍스트 배분 문제를 일으킨다. 변경 파일을 한 번에 읽으면 뒤쪽 파일일수록
검토가 얕아진다. 파일을 같은 개수로 나누면 분량 문제는 줄지만, 하나의 동작을 이루는
schema, adapter, consumer, test가 서로 다른 묶음으로 갈라질 수 있다.

리뷰 단위는 파일이나 디렉터리가 아니라 **dependency cluster**여야 한다. 하나의
동작을 판단할 때 함께 읽어야 하는 최소 파일 묶음을 뜻한다.

## 묶는 기준

변경 파일 사이에 다음 관계가 있으면 연결한다.

- 한 파일이 다른 파일을 import하거나 호출한다.
- 같은 type, schema, constant, generated client를 사용한다.
- 한쪽이 만든 데이터를 다른 쪽이 소비한다.
- 구현과 그 구현을 검증하는 test·fixture 관계다.
- 같은 acceptance criterion을 함께 구현한다.

연결된 파일을 첫 묶음으로 삼는다. 묶음이 여전히 크면 API contract, message boundary,
exported module처럼 실제 interface가 갈리는 지점에서 나눈다. 파일 개수를 맞추려고
억지로 자르지 않는다.

## 디렉터리 기준이 놓치는 것

기술 레이어는 함께 바뀌는 코드를 멀리 떨어뜨려 놓는다. database migration과 그
변경으로 깨지는 reader, route 정의와 URL을 만드는 UI, generated client와 응답 형태를
가정하는 feature가 서로 다른 폴더에 있을 수 있다.

디렉터리별 리뷰는 각 파일 안의 문제는 잘 찾지만 파일 사이에서 생기는 실패를 놓친다.
dependency cluster는 소유 구조의 깔끔함보다 동작의 완결성을 우선한다.

## 운영 방식

1. 변경 파일과 저장소 규칙을 수집한다.
2. dependency cluster 지도를 만들고 먼저 공유한다.
3. 각 묶음을 좁은 read-only 컨텍스트에서 검토한다.
4. 리뷰어는 파일 전체를 읽되 맡은 묶음 안에서만 지적한다.
5. 중복되거나 묶음 사이에 걸친 지적은 lead가 정리한다.

Test는 대상 구현과 같은 묶음에 둔다. Specification은 acceptance criterion을 구현하는
묶음에 붙인다. 홀로 떨어진 설정 파일은 실제 동작이 달라지는 묶음에 포함한다.

## 쓰지 말아야 할 때

작고 응집된 변경에는 쓰지 않는다. 조율 비용이 절감되는 컨텍스트보다 크다. Lead가
결과를 합칠 수 없다면 리뷰어 수만 늘려도 도움이 되지 않는다. 또한 병렬 검토가
정확성을 보장하지는 않는다. 묶음을 잘 나누면 컨텍스트 품질은 좋아지지만, 각 지적은
여전히 검증이 필요한 주장이다.

## 관련 스킬

sociableSkills의 `code-review-split`은 이 개념을 큰 PR 리뷰 절차로 실행한다.
