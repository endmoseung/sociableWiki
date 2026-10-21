---
type: reference
title: "Electron 화면 캡처 앱의 함정: 증상, 원인, 해결"
description: "macOS용 화면 캡처 앱을 Electron으로 만들면 custom protocol, 패키징, 포커스 타이밍, OS 권한, 페이지가 돌려주는 데이터라는 몇 군데 경계에서 예측 가능하게 깨지고, 각각 알려진 해결책이 있습니다."
tags: [electron, macos, screen-capture, security, debugging]
date: 2026-08-13
source: original
relates: [dev-process/trace-cause-before-fixing]
---

# Electron 화면 캡처 앱의 함정: 증상, 원인, 해결

제가 직접 만든 macOS용 데스크톱 캡처 앱을 Electron으로 개발하면서 쌓은 기록입니다(2026년 중반, Electron 33 기준). 아래 항목 하나하나가 실제로 디버깅 한 바퀴씩을 잡아먹었습니다. 다음 세션이 저든 에이전트든 원인을 다시 추적하지 않고 바로 고칠 수 있도록 증상 → 원인 → 해결 순서로 정리했습니다.

공통점이 하나 있습니다. 이 버그들은 거의 다 제 로직 안에 있지 않았습니다. 모두 **경계**에 있었습니다. renderer와 main 프로세스 사이, 개발 빌드와 패키징된 앱 사이, 제 창과 OS 포커스 시스템 사이, 제 코드와 신뢰할 수 없는 웹 페이지 사이입니다. 캡처 도구가 이상하게 굴면 경계부터 확인합니다.

## sandbox된 renderer에 로컬 이미지 보여 주기

| 증상 | 원인 | 해결 |
|---|---|---|
| renderer에서 `file://` `<img>`가 막힘 | sandbox된 renderer는 `file://` 로드를 opaque origin 요청으로 취급함 | 권한을 준 custom protocol을 등록합니다(`protocol.registerSchemesAsPrivileged` + `protocol.handle`). `webSecurity: false`는 절대 쓰지 않습니다 |
| custom scheme 이미지가 **일부 경로에서만** 403이 나거나 깨짐 | "standard" scheme은 경로의 첫 마디를 URL host로 해석하고 소문자로 바꿈. `myapp-shot:///Volumes/Shots/a.png`의 host가 `volumes`가 되어 대소문자를 구분하는 경로 검사가 깨짐 | scheme URL에 절대 경로를 넣지 않습니다. 파일 이름만 보내고(`myapp-shot://shot/<encodeURIComponent(name)>`), main 프로세스가 고정된 루트 아래에 붙인 뒤 그 루트를 벗어나지 않는지 확인합니다(`/` 없음, `..` 없음, resolve한 경로가 `root + sep`로 시작) |
| 위 버그가 e2e 테스트를 통과함 | 테스트 fixture 경로가 전부 소문자라서 host 소문자화가 드러나지 않음 | 대소문자를 구분하는 경로 검사가 있다면 대문자가 섞인 경로에 fixture를 하나 두거나, 실제 데이터로 한 번은 확인합니다 |

## 프로세스와 패키징

| 증상 | 원인 | 해결 |
|---|---|---|
| preload 스크립트가 아예 로드되지 않음 | Electron 20부터 sandbox된 renderer는 CommonJS preload만 로드함 | preload만 `.cts`로 작성해 `.cjs`로 내보내고, 나머지는 ESM을 유지합니다 |
| 패키징된 앱에서 Node 보조 스크립트가 안 돌아감 | Finder로 실행한 앱의 `PATH`에는 `node`가 없음 | 앱 자신의 바이너리를 `ELECTRON_RUN_AS_NODE=1`로 띄웁니다 |
| 코드를 고쳤는데 앱이 예전 코드로 돎 | `npm run build`는 `dist/`만 갱신하고, 패키징된 `.app`은 자기 사본을 따로 들고 있음 | `.app`을 다시 실행하기 전에 패키징을 다시 돌립니다(예: `electron-builder --dir`) |
| `com.apple.quarantine`을 지운 뒤에도 DMG 검증 스크립트가 실행 실패를 보고함 | 스크립트가 격리된 사본을 일부러 한 번 실행하면, Gatekeeper가 그 앱 경로에 대한 거부를 캐시할 수 있음 | 격리 해제 후 실행 검사는 DMG에서 앱을 새 경로로 복사하고, 그 사본의 격리 속성을 지운 다음 거기서 실행합니다. Gatekeeper가 이미 거부한 경로는 다시 쓰지 않습니다 |

## 캡처 UX: 사용자 신뢰가 깨지는 순간들

| 증상 | 원인 | 해결 |
|---|---|---|
| 캡처에 내 앱이 찍히거나, "맨 앞 앱" 정보가 내 앱으로 기록됨 | 캡처를 시작하는 순간 내 창이 맨 앞에 있음 | 내 창을 전부 숨기고, macOS가 포커스를 넘길 때까지 300ms쯤 기다린 뒤 맨 앞 앱을 읽고 캡처합니다. 끝나면 창을 되돌립니다 |
| 첫 캡처에 배경화면만 찍힘 | 캡처를 호출한 프로세스에 macOS 화면 기록 권한이 없음 | 권한이 없는 상태를 감지해 사용자에게 알립니다. 이 권한은 앱 정체성 단위로 주어지므로, 개발용 셸과 패키징된 `.app`은 따로 허용받아야 합니다 |
| computer-use 도구로 QA를 돌리는 에이전트가 `screencapture -i`에서 드래그를 못 하고, 앱 상태를 읽으면 선택 오버레이가 닫힘 | macOS 선택 레이어는 일반적인 접근성 앱이 아닌데, computer-use 도구는 미리 살펴본 앱을 대상으로 삼아야 함 | 캡처를 시작하기 **전에** 무해한 앞쪽 앱을 먼저 살펴 둡니다. `screencapture -i`를 시작한 뒤에는 앱 상태를 읽지 말고, 미리 살펴 둔 대상에 좌표 드래그를 한 번만 보냅니다. 이 순서로 패키징된 앱에서 실제 원본 해상도 캡처를 얻었습니다 |
| 남은 프로세스 점검에서 상관없는 세션까지 걸림 | 앱이 CLI를 자식 프로세스로 띄우는데, 머신 전체에 `pgrep <cli>`를 돌리면 같은 CLI의 다른 세션까지 전부 잡힘 | 앱이 띄운 명령의 고유한 인자 조합과 패키징된 실행 파일 경로로 좁혀 찾고, 테스트용 사용자 데이터 폴더가 지워졌는지는 따로 확인합니다. 내가 띄우지 않은 프로세스는 절대 종료하지 않습니다 |
| 항상 위에 떠 있는 보조 막대를 사용자가 못 찾음 | 화면 맨 위에 따로 떨어진 막대는 시선 밖에 있음 | 부모 창에 붙입니다. `frame: false`로 만들고, 부모 창의 `move`·`resize` 때마다 위치를 다시 잡고, 눈에 띄는 버튼 스타일을 줍니다 |
| `osascript tell application "X"`가 X를 실행해 버림 | AppleScript `tell`은 실행 중이 아닌 앱을 띄움 | 지금 맨 앞에 있는 앱과 이름이 같은 브라우저에만 질의합니다 |
| 작은 대화상자에서 버튼이 잘림 | `BrowserWindow` 높이에 제목 표시줄이 포함됨 | `useContentSize: true`를 씁니다 |
| `<input list>`(datalist) 드롭다운이 스크롤되지 않음 | macOS Chromium의 datalist 제약 | 정해진 값은 기본 `<select>`로 받고, 옆에 자유 입력칸을 둡니다 |

## Playwright를 묶지 않고 전체 페이지 캡처하기

`webContents.debugger.attach("1.3")` 다음에 `Page.captureScreenshot({ format: "png", captureBeyondViewport: true })`를 호출하면 `BrowserWindow`의 스크롤 전체 높이를 담은 스크린샷을 base64로 받습니다. `Buffer`로 바꿔 쓰면 됩니다. attach가 실패하면 뷰포트만 찍는 `webContents.capturePage()`로 대신하되, 품질이 낮아졌다는 사실을 **사용자에게 알립니다**. 아무 말 없이 뷰포트만 찍으면 전체 페이지 캡처로 오해받습니다. 결과 너비는 `viewportWidth × devicePixelRatio`이므로 테스트에서 픽셀 너비를 정확한 값으로 단언하지 않습니다.

## 신뢰 경계: `executeJavaScript`는 페이지의 세계에서 돕니다

임의의 페이지에서 `webContents.executeJavaScript(script)`가 돌려준 값은 **공격자가 통제하는 값**입니다. 페이지가 `Array.prototype`이나 `String.prototype`을 덮어쓸 수 있으므로, 주입한 스크립트 안에서 건 개수 제한이나 자르기는 아무 효과가 없습니다. 정제는 매번 main 프로세스 쪽에서 합니다.

- 배열을 강제합니다. `Array.isArray(v)`가 거짓이면 `[]`로 바꿉니다.
- 문자열을 다시 자릅니다. `String(v)`로 바꾸고, 줄바꿈을 지우고, 길이를 제한합니다. 줄바꿈을 지우면 결과물에 가짜 markdown 제목을 끼워 넣는 공격도 막힙니다.
- 숫자 범위를 묶습니다. `level`이 터무니없이 크면 `"  ".repeat(level)`이 앱을 멈춰 세웁니다.

HTTP 요청 본문을 검증할 때와 같은 원칙입니다. 페이지는 클라이언트이고, 클라이언트는 거짓말을 합니다.

## 데이터 보기 창을 최신으로 유지하기

시작할 때 목록을 한 번만 불러오는 창은, 다른 창이 처음 데이터를 저장하는 순간 고장 난 것처럼 보입니다("저장했는데 안 보여요"). 싼 방법 두 가지면 해결됩니다. main 프로세스가 저장에 성공할 때마다 IPC 이벤트를 보내고, renderer는 창이 `focus`를 받을 때도 새로 불러옵니다. 후자는 외부에서 파일을 고쳤거나 `git pull`을 받은 경우까지 덮어 줍니다.

## 이 목록이 맞지 않을 때

여기 적은 항목은 macOS와 제가 쓴 Electron 세대에 묶여 있습니다. Windows와 Linux는 포커스, 권한, 격리 모델이 다르고, Electron의 protocol과 sandbox 기본값도 메이저 버전마다 바뀌어 왔습니다. 오래 가는 부분은 *원인* 쪽입니다. scheme의 host 정규화, 앱 정체성 단위로 묶인 OS 권한, 신뢰할 수 없는 페이지 반환값 같은 것들입니다. 구체적인 API 호출은 쓰는 Electron 버전에 맞춰 다시 확인합니다.
