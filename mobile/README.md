# 뮤리프 iOS / Android 앱

기존 `app/sori-app.tsx`를 공유하는 Capacitor 앱입니다. 화면, 커버와 1분 미리듣기를 앱에 포함합니다. 원본 음원은 복사하지 않습니다. 앱 공유는 실제 웹사이트의 곡 주소를 사용합니다.

현재 상태는 **개발·내부 테스트용**입니다. 로그인, 서버 업로드, 전체 듣기, 운영 신고 서버는 미연결이며 스토어에 제출하지 않았습니다. 기존 웹서비스의 예시 차트·통계·음원 매핑도 유지되어 있습니다. 실제 출시 카탈로그로 교체해야 합니다.

2026-10-01 기준 스토어별 점검 결과와 남은 작업은 [STORE-READINESS.md](STORE-READINESS.md)에 있습니다. 개인정보·안전 메뉴, 기기 데이터 삭제, 아티스트 차단을 추가했고, 미완료 항목이 있는 동안 Android Release와 Xcode Release 빌드가 중단됩니다. Debug 빌드는 계속 가능합니다.

## 실행과 빌드

Node.js 22 이상, Xcode, Android SDK 36, Java 21을 사용합니다. 이 폴더는 루트 웹 프로젝트와 별도 npm 패키지이며 `package-lock.json`으로 버전을 고정합니다.

```sh
cd mobile
npm ci
npm run check
npm run sync
npm run ios
npm run android
```

`npm run check`는 타입 검사, 웹 번들 빌드, 설치된 Google Chrome에서 모바일 동작 테스트를 실행합니다. `npm run icons`는 `resources/icon.svg`를 플랫폼별 아이콘·시작 화면 규격으로 변환합니다. Xcode 프로젝트는 `ios/App/App.xcodeproj`, Android 프로젝트는 `android/`입니다.

안드로이드 테스트 APK:

```sh
cd android
./gradlew assembleDebug
```

결과는 `android/app/build/outputs/apk/debug/app-debug.apk`입니다. Android SDK 경로는 `ANDROID_HOME` 또는 로컬 `local.properties`에 설정합니다. 스토어용 AAB에는 개발자 소유의 업로드 키가 필요하며 키 파일은 저장소에 넣지 않습니다.

아이폰 시뮬레이터 빌드:

```sh
xcodebuild -project ios/App/App.xcodeproj -scheme App \
  -sdk iphonesimulator -configuration Debug \
  -derivedDataPath artifacts/ios CODE_SIGNING_ALLOWED=NO build
```

기기/TestFlight 빌드는 Xcode Signing & Capabilities에서 본인 Team을 선택하고, 등록할 Bundle ID를 확정한 후 Archive합니다. 현재 `com.muleaf.app`은 임시 식별자입니다. 식별자를 바꿀 때 Capacitor 설정뿐 아니라 Xcode Bundle ID와 Android applicationId/namespace도 함께 변경해야 합니다.

## 구현한 앱 동작

- 기기에 포함된 미리듣기와 기존 모바일 화면
- 회원가입 없이 기기 내 찜·플레이리스트 저장 및 재실행 복원
- iOS/Android 공유 시트와 실제 사이트 곡 링크
- 오프라인 안내, 안전영역 대응, 안드로이드 뒤로가기
- 앱이 백그라운드로 가면 재생 일시정지. 백그라운드 재생은 지원하지 않음
- 신고 서버가 없을 때 접수 성공으로 표시하지 않음
- 개인정보·안전 메뉴에서 현재 데이터 처리 안내, 커뮤니티 규칙, 고객지원 정보 확인
- 확인 후 기기 내 찜·플레이리스트·차단 데이터 삭제(서버 계정 삭제와 구분)
- 아티스트 차단 시 목록과 재생에서 제외, 재실행 유지, 설정에서 해제

찜·플레이리스트는 WebView localStorage에 저장합니다. 서버 동기화되지 않으며 앱 데이터 삭제 시 사라집니다. 설정된 로그인은 없고 광고 SDK, 분석 SDK, 푸시 SDK도 추가하지 않았습니다.

## Firebase Hosting

운영 주소: https://muleaf-ed246.web.app

이 폴더에서 `npm run deploy:hosting`을 실행하면 타입 검사·웹 빌드 후 지정된 Hosting 사이트에 배포합니다. Firebase CLI 로그인이 필요합니다.

`.env.example`을 `.env.local`로 복사해 사이트 주소와 신고 API를 설정합니다. 클라이언트 환경변수에는 비밀키를 넣지 않습니다. 연결 프로젝트는 `muleaf-ed246`, Hosting 사이트는 `muleaf-ed246`입니다. 기본 공유 주소는 https://muleaf-ed246.web.app 입니다. 저장소 루트의 `.firebaserc`와 `firebase.json`에 통합 배포 대상을 명시했습니다.

```sh
npm run build
firebase hosting:channel:deploy muleaf-preview --config ../firebase.json --project muleaf-ed246
# 프리뷰 확인 후 운영 배포
firebase deploy --config ../firebase.json --only hosting --project muleaf-ed246
```

루트 `firebase.json`은 Hosting, 자체 OAuth Cloud Functions, Firestore 설정을 포함합니다. `/api/auth/**`는 서울 리전의 `socialAuth` 함수로 연결되므로 함수 배포 후 Hosting을 배포합니다. **루트의 Cloudflare D1 신고 API를 배포하는 설정이 아닙니다.** Firebase 전환 시 신고 저장 API, 인증, Storage 업로드와 접근 제어를 별도로 연결해야 합니다. `VITE_REPORTS_API_URL`을 설정하지 않으면 앱은 신고를 전송하지 않고 오류를 표시합니다. API는 `POST {id, trackId, reason, detail}`을 받아 실제 저장 후 `{id}`를 반환해야 하며, 입력 검증·남용 방지와 운영 검토 절차가 필요합니다. 허용 origin은 운영 웹사이트, `capacitor://localhost`(iOS), `https://localhost`(Android)로 제한합니다. 현재 웹사이트의 API는 동일 origin만 허용하므로 주소만 넣어 사용할 수 없습니다.

## 심사 제출 전 필요한 항목

1. 운영자명, 고객지원 이메일, 최종 앱 식별자 확인(Firebase Hosting 프로젝트: `muleaf-ed246`)
2. 실제 로그인·서버 업로드·음원 권한 제어 구현, 예시 데이터를 운영 카탈로그로 교체
3. 회원 기능을 제공한다면 계정 삭제, 개인정보 처리방침·이용약관·지원 URL 마련
4. 음원 배포 권리 확인, 신고 저장·운영 검토·사용자 차단 등 업로드 콘텐츠 운영 기능 완성
5. 실제 기기 재생·네트워크 오류·공유·외부 로그인 복귀 검증
6. 개발자 계정 서명, 앱 아이콘·실기기 스크린샷, 콘텐츠 등급·개인정보 설문·심사 계정 입력
7. TestFlight / Play 내부 테스트 후 심사 제출. 대상 Google 개인 계정은 별도 비공개 테스트 요건 확인

현재 상태에서 제출 가능·심사 통과를 보장하지 않습니다. 위 미연결 항목은 코드만으로 완료했다고 표시하지 않습니다.

## 스토어별 출시 검사

운영자·연락처·공개 정책 URL·스토어 메타데이터는 `store.config.json`에서 관리합니다. 비밀키는 이 파일에 넣지 않습니다. `physicalDeviceTested`, 권리 확인 등의 항목은 실제 확인 후에만 변경하세요.

```sh
npm run release:check
npm run release:check:online
npm run test:release
npm run build:store
```

검사는 이미 확인된 미완성 코드, 설정 누락과 API 수준을 찾는 보조 장치입니다. 모든 정책 준수나 보안·서버 동작을 자동 인증하지 않습니다. 현재 미연결 기능이 남아 있으므로 실패가 정상이며, 플래그 변경만으로 해결하지 않습니다. 개인정보 안내도 운영자와 보유·삭제 정책 확인 전에는 초안입니다.

Xcode Release 검사에서 Node가 보이지 않으면 `NODE_BINARY`에 Node 실행 파일 절대 경로를 지정하세요. iOS 개인정보 매니페스트는 현재 로컬 기능만 있는 빌드의 기본값이며, 로그인·신고·분석 등 데이터 전송을 연결할 때 실제 수집 항목 및 SDK와 함께 다시 작성해야 합니다.

Android Release 서명은 `MULEAF_KEYSTORE_PATH`, `MULEAF_KEYSTORE_PASSWORD`, `MULEAF_KEY_ALIAS`, `MULEAF_KEY_PASSWORD` 환경변수를 사용합니다. 본인 업로드 키를 지정하며 저장소나 채팅에 비밀번호를 남기지 않습니다. 검사 통과 후 `./gradlew bundleRelease`로 서명 AAB를 생성합니다.

공식 참고: [Capacitor](https://capacitorjs.com/docs/getting-started), [Firebase Hosting](https://firebase.google.com/docs/hosting/full-config), [Apple 심사 지침](https://developer.apple.com/app-store/review/guidelines/), [Google Play 테스트 요건](https://support.google.com/googleplay/android-developer/answer/14151465).
