# 뮤리프 · MULEAF

iOS·Android 개발용 앱 프로젝트와 Firebase Hosting 설정은 [mobile/README.md](mobile/README.md)에 있습니다. 네이티브 프로젝트는 생성되어 있으며, 운영 인증·업로드·신고 서버 및 스토어 서명·심사 제출은 별도 연결이 필요합니다.

AI 음악 탐색·미리듣기 웹 서비스의 GitHub 업로드용 소스입니다.
원본 커밋: 37d4e19b6ada2727694390b7d27c51f06f286e0c

## 로컬 실행

Node.js 22.13 이상, package.json에 지정된 pnpm 버전을 사용합니다.

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm dev
```

개발 서버: http://localhost:5173

```sh
pnpm exec tsc --noEmit
pnpm build
```

## GitHub에 올리기

ZIP을 압축 해제하고 muleaf 폴더에서 실행합니다. GitHub에서 빈 저장소를 먼저 만든 뒤 마지막 URL을 본인 저장소 URL로 바꿉니다.

```sh
git init -b main
git add .
git commit -m "Initial Muleaf source"
git remote add origin https://github.com/YOUR_ACCOUNT/muleaf.git
git push -u origin main
```

함께 제공하는 muleaf.bundle은 소스와 초기 커밋을 포함한 Git 저장소 파일입니다.

```sh
git clone muleaf.bundle muleaf
```

## 포함 기능

- 주간·월간 차트, 최근 등록 음악, 해시태그 검색, Mood Play
- 모바일 홈 / 검색 / 등록하기 / 찜 / 내정보 메뉴
- 비로그인 1분 미리듣기 파일과 로그인 안내
- 음원 상세의 전체 길이, 재생·일시정지 상태, 등록 확인서
- 간편로그인 화면: 네이버, 카카오, Google, Apple
- 음원 신고 API와 D1 마이그레이션
- 찜, 플레이리스트, 등록 폼, 대시보드 화면 및 광고 구좌

## 연결이 필요한 부분

Firestore 데이터베이스와 서버 전용 접근 규칙은 설정되었습니다. 자체 SNS OAuth 서버는 Cloud Functions 배포와 제공업체 키 연결이 남아 있습니다. Firebase Authentication은 사용하지 않습니다. 세부 설정은 [server/README.md](server/README.md)를 참고하세요. AdSense는 연결되지 않았습니다. 회원 전용 화면은 비로그인 시 로그인 화면으로 연결됩니다.
차트·통계는 초기 데이터이며, 찜과 플레이리스트 등은 브라우저 실행 상태입니다. 업로드는 서버 저장 연동이 필요합니다. 로그인 상태의 전체 듣기 분기는 구현되어 있으나 실제 인증 연동은 별도입니다. 원본 음원이 public에 있으므로 상용 서비스에서는 인증된 서버/서명 URL로 원본 전달을 제한해야 합니다.

등록 확인서는 서비스 등록 기록을 표시하며 법적 저작권 등록이나 NFT 발행 기능은 구현되어 있지 않습니다.

## 배포

현재 프로젝트는 Vinext + Cloudflare Workers/D1 기반입니다. `.openai/hosting.json`은 기존 Sites 프로젝트 식별자를 포함하므로 독립 사이트로 배포할 때 기존 프로젝트에 덮어쓰지 않도록 새 배포 설정을 사용하세요.
외부 배포 시 Cloudflare 계정, D1 데이터베이스와 `DB` 바인딩, drizzle 폴더의 마이그레이션 적용이 필요합니다. `vite.config.ts`의 데이터베이스 ID는 로컬 개발용 값이며 운영 ID로 설정해야 합니다. 단순 정적 호스팅만으로 신고 API는 작동하지 않습니다.

## 파일

- app/sori-app.tsx: 화면과 재생 동작
- app/globals.css: 스타일
- app/certificate-card.tsx: 등록 확인서
- app/api/reports/route.ts: 신고 API
- db/, drizzle/: 데이터베이스 코드와 마이그레이션
- public/: 커버, 브랜드 이미지, 원본·미리듣기 음원

비밀키, node_modules, 빌드 결과, 운영 DB 데이터, 기존 Git 인증정보는 포함하지 않습니다.
