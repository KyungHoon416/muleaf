# 스토어 심사 대응 현황

확인일: 2026-10-01. 현재 **출시 불가 / 내부 테스트 가능**. 웹사이트를 앱에 담는 것만으로 심사 기준을 충족한 것으로 처리하지 않습니다. 최종 승인은 각 스토어가 판단합니다.

## Apple App Store

| 항목 | 코드·설정 상태 | 남은 작업 |
| --- | --- | --- |
| 앱 완성도·정확한 설명 | Release 빌드에서 준비 중 로그인, 임시 업로드, 예시 카탈로그 검출 | 실제 서버와 운영 음원·통계로 교체 |
| 앱 고유 사용 경험 | 번들 미리듣기, 공유 시트, 기기 내 목록, 차단·삭제 | 실제 기기 검증. 최소 기능성은 심사 판단 대상 |
| 개인정보 | 앱 내 메뉴와 PrivacyInfo.xcprivacy 리소스 추가 | 운영자·공개 정책 URL·보관 기간 확정, 실제 수집 항목과 App Privacy 답변 일치 |
| 계정·로그인 | 실제 계정 연결 전 | 외부 로그인 제공 시 4.8의 동등 로그인 조건 검토, 앱 안에서 계정 및 관련 데이터 삭제 구현 |
| 이용자 콘텐츠 | 음원 신고 화면, 기기 내 차단·해제 구현 | 실제 신고 저장, 사용자 신고, 유해 콘텐츠 필터·검토·조치, 서버의 고정 사용자 ID로 차단 |
| SDK·서명 | 설치된 Xcode 27 / SDK 27로 Debug 검증, Release에서 SDK 26 이상 검사 | 개발자 Team·프로비저닝, 실기기·TestFlight, 최종 Archive |

공식 근거: [App Review Guidelines 1.2, 2.1, 2.3, 4.2, 4.8, 5.1.1](https://developer.apple.com/app-store/review/guidelines/), [2026-04-28부터 SDK 26 이상](https://developer.apple.com/news/?id=ueeok6yw).

## Google Play

| 항목 | 코드·설정 상태 | 남은 작업 |
| --- | --- | --- |
| 대상 API | targetSdkVersion / compileSdkVersion 36 | 제출 직전 최신 정책 재확인 |
| 네트워크·권한 | 평문 HTTP 차단, 시스템 인증서 사용, 외부 전체 저장소 공유 경로 제거 | 최종 서버 CORS·권한 및 실기기 오류 처리 검증 |
| 데이터 안전성 | 기기 내 저장·삭제와 서버 계정 삭제를 UI에서 구분 | 공개 개인정보 정책, 실제 서버 수집·공유·보유 기간에 맞는 Data safety 설문 |
| 계정 삭제 | 실제 계정 연결 전 | 앱 안의 삭제 요청과 앱을 재설치하지 않고 이용할 수 있는 웹 삭제 경로 |
| 이용자 콘텐츠 | 재생 차단·차단 해제, 신고 UI | 신고된 콘텐츠·사용자 검토, 규칙 동의, 서버 차단·조치 |
| 배포 파일 | Debug APK, 업로드 키 환경변수 기반 Release 서명 설정 | 개발자 업로드 키를 사용한 AAB, Play App Signing |
| 16 KB 페이지 | 최종 APK의 네이티브 .so 포함 여부 검사 가능 | 최종 산출물과 16 KB 기기/에뮬레이터 호환성 확인 |
| 테스트·등급 | 브라우저 통합 테스트와 네이티브 Debug 빌드 | 실기기, 콘텐츠 등급, 광고 여부·앱 접근 권한 설문, 계정 유형에 따른 테스트 |

공식 근거: [API 36 대상 수준](https://support.google.com/googleplay/android-developer/answer/11926878?hl=en-EN), [개인정보 정책](https://support.google.com/googleplay/android-developer/answer/10144311?hl=en-GB), [계정 삭제](https://support.google.com/googleplay/android-developer/answer/13327111), [UGC 정책](https://support.google.com/googleplay/android-developer/answer/9876937?hl=en-GB), [16 KB 요건](https://android-developers.googleblog.com/2025/05/prepare-play-apps-for-devices-with-16kb-page-size.html), [신규 개인 계정 테스트](https://support.google.com/googleplay/android-developer/answer/14151465).

## 현재 앱의 데이터 흐름

- 찜·플레이리스트·차단은 WebView localStorage. 기기 초기화 기능으로 삭제됩니다. 기기 내 차단은 현재 예시 카탈로그의 고유 표시명을 사용하며, 서버 사용자 차단으로 간주하지 않습니다.
- 기본 설정에서는 신고 API가 비어 있어 전송하지 않습니다. 설정 후 전송되는 신고 내용과 운영 로그는 개인정보 정책 및 설문에 반영해야 합니다.
- 앱 내 광고 슬롯은 빈 UI이며 광고/추적 SDK를 추가하지 않았습니다. 빈 광고 슬롯과 불필요한 미완성 UI는 출시 전 정리 대상입니다.
- 로그인, 업로드, 서버 계정 삭제, 결제 및 백그라운드 재생이 완성되었다고 홍보하거나 설문에 입력하지 않습니다. 결제 기능을 추가한다면 각 스토어의 디지털 콘텐츠 결제 규정을 별도로 적용합니다.

## 자동 검사 범위

`scripts/release-check.mjs`는 현재 알려진 미완성 코드와 필수 설정을 검사합니다. 서버 서비스 파일의 존재, 운영자가 입력한 확인값, 공개 URL의 응답 등은 서버의 실제 정상 작동이나 정책 준수를 증명하지 않습니다. 최종 QA와 운영 확인을 대신할 수 없습니다.

출시 준비에 필요한 사용자 정보: Firebase 프로젝트 ID, 운영자명·지원 이메일, 앱 식별자, 음원 배포 권리, 개발자 서명 설정. 현재 기능 범위는 회원·업로드를 포함하는 `full-service`로 유지했습니다. 비회원 범위로 바꿀 경우 실제 화면·코드·스토어 설명을 함께 변경해야 합니다.

## 이번 변경 검증 결과

- TypeScript 검사 통과
- 모바일 브라우저 통합 테스트 5개 통과: 미리듣기·저장 복원, 신고 실패 처리, 손상된 저장 데이터 복구, 차단·재생 중지·복원, 삭제 확인
- 출시 검사 테스트 4개 통과
- iOS / Android Debug 빌드 성공, iOS 앱 번들 안에 개인정보 매니페스트 포함 확인
- Android APK 안의 네이티브 `.so` 파일 없음 확인. 16 KB 실기기 테스트 완료를 뜻하지 않음
- Android `preReleaseBuild`와 Xcode Release 모두 미완료 항목으로 의도대로 중단됨

개발용 APK: `artifacts/muleaf-android-debug.apk`. 서명된 스토어 제출용 AAB/IPA는 생성하지 않았습니다.
