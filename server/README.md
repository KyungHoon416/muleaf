# 뮤리프 자체 SNS 인증 서버

Firebase Authentication 없이 Google, 네이버, 카카오, Apple OAuth를 서버에서 직접 처리한다. 현재 코드는 로컬 검증까지 완료한 연결 준비 상태다. 제공업체 키와 실제 서버/도메인을 설정하기 전에는 운영 로그인이 활성화되지 않는다.

## 실행

Node.js 24 이상과 영구 디스크가 있는 단일 서버가 필요하다. SQLite DB와 암호화 키를 함께 백업한다. 영구 디스크가 없는 서버리스 환경에 이 구성을 그대로 배포하지 않는다. 여러 인스턴스로 확장하려면 DB와 요청 제한 저장소를 공유형으로 전환해야 한다.

```sh
cd server
npm ci
cp .env.example .env
# .env에 운영 주소, 키, 무작위 TOKEN_ENCRYPTION_KEY 입력
npm test
npm start
```

개발용 웹 환경: `SITE_ORIGIN=http://localhost:5173`, `AUTH_PUBLIC_ORIGIN=http://localhost:8080`. 프런트엔드 `mobile/.env.local`에는 `VITE_AUTH_ENABLED=true`, `VITE_AUTH_SERVER_ORIGIN=http://localhost:8080`을 설정한다. .env 및 .p8 키는 Git에 올리지 않는다.

운영 환경은 `NODE_ENV=production`과 HTTPS가 필수다. 권장 구조는 같은 origin의 `/api/auth/*`를 자체 서버로 프록시하는 구성이다. 다른 origin을 사용한다면 `app.example.com`과 `auth.example.com` 같은 동일 사이트의 HTTPS 도메인을 사용한다. `web.app`과 별개 도메인을 조합하면 브라우저의 제3자 쿠키 차단으로 세션이 작동하지 않을 수 있다. Firebase Hosting을 유지할 경우 사용자 지정 도메인/프록시 또는 적절한 서버 배포 구조를 확정한 후 활성화한다. 현재 `mobile/firebase.json`에는 가짜 API rewrite를 추가하지 않았다.

프록시가 Cookie, Set-Cookie, Origin, X-CSRF-Token을 유지해야 한다. 액세스 로그에서 OAuth 콜백 쿼리/본문, Cookie, Authorization을 기록하지 않는다. `__session` 쿠키는 HttpOnly, 운영 시 Secure이며 Apple form_post 처리를 위한 로그인 진행 중에만 SameSite=None이다. 완료 후 SameSite=Lax로 전환한다. 과도한 요청 차단은 단일 서버 기준이며 프록시 배포 시 실제 네트워크 구조에 맞게 제한을 조정한다.

## 제공업체 등록값

사이트 주소: 운영 웹사이트의 `SITE_ORIGIN`.

아래 콜백의 `AUTH_PUBLIC_ORIGIN`을 실제 공개 서버 주소로 대체한다. 로컬/운영 콜백은 각각 등록한다.

| 제공업체 | Redirect/Callback URL | 서버 환경변수 |
|---|---|---|
| Google | `AUTH_PUBLIC_ORIGIN/api/auth/callback/google` | GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET |
| 네이버 | `AUTH_PUBLIC_ORIGIN/api/auth/callback/naver` | NAVER_CLIENT_ID, NAVER_CLIENT_SECRET |
| 카카오 | `AUTH_PUBLIC_ORIGIN/api/auth/callback/kakao` | KAKAO_CLIENT_ID (REST API 키), KAKAO_CLIENT_SECRET |
| Apple | `AUTH_PUBLIC_ORIGIN/api/auth/callback/apple` | APPLE_CLIENT_ID (Services ID), APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_PRIVATE_KEY |

Google은 웹 애플리케이션 OAuth 클라이언트를 등록하고 앱 이름, 지원 이메일, 동의 화면, 테스트 사용자/게시 상태를 확인한다. 네이버는 로그인 사용 API 및 닉네임 항목, Callback URL과 서비스 검수를 확인한다. 카카오는 로그인 ON, Redirect URI, profile_nickname 동의항목, Client Secret 설정을 확인한다. Apple은 Sign in with Apple이 켜진 App ID에 Services ID와 도메인/Return URL을 연결하고 서버 전용 .p8 키를 사용한다.

## 처리 방식

- `/api/auth/start/:provider`: 10분짜리 일회성 state, 브라우저 쿠키 바인딩, Google PKCE, Google/Apple nonce.
- `/api/auth/callback/:provider`: 서버에서 코드 교환. Google/Apple은 jose로 공개키 서명·issuer·audience·만료·nonce 검증. 네이버/카카오는 제공업체 API에서 고유 ID 확인.
- 같은 이메일이어도 제공업체 고유 ID가 다르면 별개 회원이다. 자동 계정 병합을 하지 않는다.
- `/api/auth/session`: 사용자 표시 이름과 CSRF 토큰. 제공업체 액세스/리프레시 토큰은 브라우저로 반환하지 않는다.
- `/api/auth/logout`: Origin 및 CSRF 토큰 확인 후 서버 세션 삭제.
- `/api/auth/account`: 최근 15분 안에 로그인한 사용자만 삭제. 제공업체 연결 해제/토큰 폐기 성공 후 사용자와 모든 서버 세션 삭제. 실패 시 성공으로 표시하지 않는다.
- 제공업체 토큰은 AES-256-GCM 암호화 저장, 세션 쿠키 토큰은 해시 저장, 세션 만료는 7일.

## 배포 전 남은 작업

- 서버 위치, 실제 도메인, HTTPS/프록시, 영구 저장소 및 백업 확정.
- 4개 개발자 앱 등록/키 입력, 실제 계정별 로그인·취소·탈퇴 E2E 확인. 단위 테스트는 제공업체 응답을 모의하므로 실서비스 검수를 대체하지 않는다.
- 운영자, 지원 연락처, 수집 항목·보관 기간·국외 이전 등을 반영한 실제 개인정보 처리방침 확정.
- iOS/Android는 외부 시스템 브라우저, 앱 링크/Universal Link, 플랫폼 클라이언트와 안전한 일회성 세션 전달을 추가 구현해야 한다. 현재 WebView에서 웹 로그인으로 우회하지 않는다.
- Apple 계정 변경/취소 알림 및 제공업체별 운영 웹훅, 실패 재시도/복구 절차 검토.
- 다른 회원 데이터 저장소가 추가되면 회원탈퇴 트랜잭션/삭제 작업도 함께 확장한다.

프런트엔드 활성화는 위 설정을 마친 뒤 `VITE_AUTH_ENABLED=true`로 빌드한다. 현재 기본값은 false다. 기존 공개 사이트에는 실제 OAuth 서버가 아직 배포되지 않았다.

공식 문서:
- https://developers.google.com/identity/protocols/oauth2/web-server
- https://developers.naver.com/docs/login/api/api.md
- https://developers.kakao.com/docs/ko/kakaologin/rest-api
- https://developer.apple.com/documentation/signinwithapplerestapi
