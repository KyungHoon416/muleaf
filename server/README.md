# 뮤리프 자체 SNS 인증 — Firestore + Cloud Functions

Firebase Authentication 없이 Google·네이버·카카오·Apple OAuth를 직접 처리한다.

- Firebase Hosting: 웹 화면과 동일 origin의 `/api/auth/**` 프록시.
- Cloud Functions 2세대 `socialAuth`: OAuth 코드 교환, 세션 확인, 로그아웃과 탈퇴. Node.js 22, 서울 `asia-northeast3`, 최소 인스턴스 0 / 최대 3.
- Cloud Firestore `(default)`: 회원, 암호화된 제공업체 토큰, 세션, 일회성 로그인 요청, 요청 제한. SQLite나 로컬 영구 디스크를 사용하지 않는다.
- Secret Manager `MULEAF_OAUTH_CONFIG`: 토큰 암호화 키와 제공업체 비밀키를 담는 서버 전용 JSON.

## 현재 상태 (2026-10-02)

Firestore는 muleaf-ed246의 서울 리전에 생성했고 삭제 보호를 켰다. 클라이언트의 모든 직접 읽기·쓰기를 차단하는 규칙을 배포했다. Cloud Functions/Hosting API 연결은 아직 배포하지 않았다. 현재 Spark 요금제이므로 함수 배포 전에 사용자가 Blaze 결제 설정을 완료해야 한다. 제공업체 키도 아직 연결되지 않았다. Firestore TTL 색인 설정은 저장소에 준비되어 있고 아직 배포하지 않았다.

## 데이터와 접근

`muleaf_auth_users`, `muleaf_auth_sessions`, `muleaf_auth_flows`, `muleaf_auth_rates` 컬렉션을 사용한다. 문서는 실제 로그인 요청 시 생성되며 불필요한 샘플 회원은 운영 DB에 넣지 않는다. Admin SDK는 실행 환경의 서비스 계정/IAM으로 접근한다. 클라이언트용 Firebase SDK나 Firebase Auth 토큰은 필요하지 않다.

OAuth state 소모, 회원 중복 생성 방지, 세션 발급, 요청 제한은 Firestore 트랜잭션으로 처리한다. 세션 토큰은 해시로 저장하고 제공업체 토큰은 AES-256-GCM으로 암호화한다. 같은 이메일만으로 계정을 병합하지 않는다. 회원 삭제 중에는 로그인과 기존 세션 사용을 막고 제공업체 연결 해제 후 세션 문서와 회원 문서를 삭제한다. 외부 연결 해제 이후 DB 정리에 장애가 나면 삭제 중 상태를 유지하므로 운영자가 작업을 재개해야 한다.

`expireAt` TTL은 만료 데이터 정리용이며 즉시 삭제를 보장하지 않는다. 서버가 만료 시간을 별도로 검사하므로 TTL 처리가 늦어져도 만료 세션/로그인 요청이 허용되지 않는다. DB 백업과 암호화 키의 보존·복구 정책은 운영 전에 확정한다.

## 로컬 검증

Node.js 22 이상, Java 21, Firebase CLI가 필요하다. 운영 DB에서 테스트하지 않는다.

```sh
npm --prefix server ci
firebase emulators:exec --only firestore --project demo-muleaf-firestore 'npm --prefix server test'
```

테스트는 `FIRESTORE_EMULATOR_HOST=127.0.0.1:8085`가 아니면 실행을 거부한다. Firestore 동시 콜백, state 바인딩/재사용/만료, CSRF, 서버 세션, 탈퇴, 암호화, Apple rawBody, 클라이언트 접근 규칙을 검증한다. 제공업체 응답은 모의하므로 실제 SNS 계정별 E2E 검증은 별도다.

로컬 서버는 `.env.example`을 `server/.env`로 복사해 값을 입력하고 `npm --prefix server start`로 실행한다. 로컬 Firestore 에뮬레이터 주소와 demo 프로젝트를 지정한다. 운영에서는 서비스 계정 JSON을 저장소에 넣지 않고 실행 환경의 기본 자격 증명을 사용한다.

## 제공업체 등록

사이트: `https://muleaf-ed246.web.app`

| 제공업체 | Callback / Redirect URL | 비밀 설정의 키 |
|---|---|---|
| Google | `https://muleaf-ed246.web.app/api/auth/callback/google` | GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET |
| 네이버 | `https://muleaf-ed246.web.app/api/auth/callback/naver` | NAVER_CLIENT_ID, NAVER_CLIENT_SECRET |
| 카카오 | `https://muleaf-ed246.web.app/api/auth/callback/kakao` | KAKAO_CLIENT_ID (REST API 키), KAKAO_CLIENT_SECRET |
| Apple | `https://muleaf-ed246.web.app/api/auth/callback/apple` | APPLE_CLIENT_ID (Services ID), APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_PRIVATE_KEY |

Google은 웹 OAuth 클라이언트와 동의 화면/공개 상태를 설정한다. 네이버는 닉네임 항목과 서비스 검수를 확인한다. 카카오는 로그인 ON, Redirect URI, profile_nickname 동의항목과 Client Secret을 설정한다. Apple은 App ID의 Sign in with Apple, Services ID, 도메인 및 Return URL을 연결하고 서버 전용 .p8 키를 사용한다. 비밀키를 채팅·Git·프런트엔드 환경변수로 공유하지 않는다.

## 배포 순서

1. 사용자가 Firebase 프로젝트의 Blaze 결제 설정을 완료한다. 최대 인스턴스 제한은 지출 상한선이 아니며 사용량에 따라 요금이 발생할 수 있다.
2. Secret Manager의 `MULEAF_OAUTH_CONFIG`에 JSON 객체를 저장한다. `TOKEN_ENCRYPTION_KEY`는 암호학적으로 생성한 32바이트를 base64로 인코딩한다. 위 제공업체 설정은 같은 JSON에 넣는다. 키가 없는 제공업체는 비활성 상태로 남는다. 실제 원본 JSON은 저장소 밖의 보호된 파일에서 입력한다.
3. 루트에서 `firebase deploy --only firestore,functions --project muleaf-ed246`로 규칙·TTL·함수를 배포한다. Admin SDK 실행 계정에 대상 DB 접근 권한과 해당 비밀 읽기 권한이 있는지 확인한다.
4. `mobile/.env.local`에 `VITE_AUTH_ENABLED=true`를 설정한다. `VITE_AUTH_SERVER_ORIGIN`은 빈 값(동일 origin)으로 둔다. `npm --prefix mobile run build` 후 루트에서 `firebase deploy --only hosting --project muleaf-ed246`.
5. 실제 계정별 로그인·취소·새로고침·로그아웃·탈퇴를 확인한다. 운영자/개인정보 처리방침도 활성화 전에 확정한다.

`__session`만 쿠키로 사용하므로 Firebase Hosting의 쿠키 전달 규칙과 호환된다. Apple form_post를 위해 로그인 진행 중 쿠키는 Secure/SameSite=None, 완료 후 SameSite=Lax다. 함수 요청 로그에 OAuth 코드가 담길 수 있으므로 운영 로깅 정책에서 콜백 쿼리/본문과 개인정보 수집을 점검한다.

iOS/Android 시스템 브라우저와 앱 링크, 플랫폼별 클라이언트 및 일회성 앱 세션 전달은 별도 구현이 남아 있다. 현재 네이티브 WebView 로그인은 활성화하지 않는다. 음원 업로드/신고/정산 DB 연결과 스토어 심사 완료를 의미하지 않는다.

공식 문서:
- https://firebase.google.com/docs/hosting/functions
- https://firebase.google.com/docs/firestore/manage-data/transactions
- https://firebase.google.com/docs/firestore/ttl
- https://developers.google.com/identity/protocols/oauth2/web-server
- https://developers.naver.com/docs/login/api/api.md
- https://developers.kakao.com/docs/ko/kakaologin/rest-api
- https://developer.apple.com/documentation/signinwithapplerestapi
