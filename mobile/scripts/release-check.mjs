import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { loadEnv } from "vite";

const root = fileURLToPath(new URL("../", import.meta.url));
const read = name => readFileSync(path.join(root, name), "utf8");

export function validateRelease({ config, source, env, platform, hasAccountService, targetSdk }) {
  const issues = [];
  const need = (condition, message) => { if (!condition) issues.push(message); };
  const https = value => {
    try { const u = new URL(value); return u.protocol === "https:" && !u.username && !u.password && !["localhost", "example.com", "127.0.0.1"].includes(u.hostname); } catch { return false; }
  };
  need(["ios", "android", "all"].includes(platform), "대상 플랫폼은 ios, android 또는 all이어야 합니다.");
  need(Boolean(config.operatorName?.trim()), "운영자명을 등록하세요.");
  need(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(config.supportEmail || ""), "실제 고객지원 이메일을 등록하세요.");
  need(https(config.privacyUrl), "공개 HTTPS 개인정보 처리방침 URL이 필요합니다.");
  need(https(config.supportUrl), "공개 HTTPS 고객지원 URL이 필요합니다.");
  need(config.bundleIdConfirmed === true, "앱 식별자의 소유권과 스토어 등록 가능 여부를 확인하세요.");
  need(config.contentRightsVerified === true, "음원·커버의 배포 권리를 확인하세요.");
  need(config.privacyDisclosuresReviewed === true, "실제 데이터 흐름에 맞춰 App Privacy / Data safety와 개인정보 처리방침을 검토하세요.");
  need(config.ageRatingReviewed === true, "실제 콘텐츠를 기준으로 연령 등급 설문을 완료하세요.");
  need(config.moderationProcessVerified === true, "신고 검토 담당자·처리 절차·콘텐츠 조치 및 사용자 차단 운영을 확인하세요.");
  need(https(env.VITE_REPORTS_API_URL), "HTTPS 신고 저장 API가 연결되지 않았습니다.");
  need(!/로그인은 준비 중/.test(source), "작동하지 않는 소셜 로그인 버튼이 남아 있습니다. 실제 인증으로 연결하세요.");
  need(!source.includes("URL.createObjectURL(uploadFile)"), "업로드가 브라우저 임시 파일입니다. 서버 저장·권한 검증·검토 대기 처리를 구현하세요.");
  need(!source.includes("weeklyStreams:5840"), "예시 카탈로그·스트리밍 통계가 남아 있습니다. 실제 음원 매핑과 데이터로 교체하세요.");
  if (config.releaseScope === "full-service") {
    need(hasAccountService, "실제 인증 및 계정·관련 데이터 삭제 서비스가 구현되지 않았습니다.");
    need(https(config.accountDeletionUrl), "Google Play용 앱 외부 계정 삭제 요청 URL이 필요합니다.");
  } else {
    // Changing a setting must not make existing account UI exempt from checks.
    need(config.releaseScope === "guest-library", "출시 범위를 full-service 또는 guest-library로 지정하세요.");
    need(!/setLoginOpen\(true\)|submitUpload\(\)/.test(source), "비회원 출시를 선택해도 회원·업로드 기능이 남아 있으면 제출할 수 없습니다.");
  }
  const metadata = config.storeMetadata || {};
  need(Boolean(metadata.name) && [...metadata.name].length <= 30, "앱 이름은 1~30자여야 합니다.");
  need(Boolean(metadata.subtitle) && [...metadata.subtitle].length <= 30, "App Store 부제는 1~30자여야 합니다.");
  need(Boolean(metadata.shortDescription) && [...metadata.shortDescription].length <= 80, "Google Play 짧은 설명은 1~80자여야 합니다.");
  for (const current of platform === "all" ? ["ios", "android"] : [platform]) {
    need(config.physicalDeviceTested?.[current] === true, `${current}: 실기기 재생·공유·네트워크 오류·데이터 삭제를 검증하세요.`);
  }
  if (platform !== "ios") need(targetSdk >= 36, "Google Play: targetSdkVersion 36 이상이 필요합니다(2026-10-01 확인).");
  return issues;
}

export async function checkRelease(platform = "all", online = false) {
  const config = JSON.parse(read("store.config.json"));
  const env = { ...loadEnv("production", root, "VITE_"), ...process.env };
  const issues = validateRelease({ config, env, platform,
    source: read("../app/sori-app.tsx"),
    hasAccountService: existsSync(path.join(root, "src/account-service.ts")),
    targetSdk: Number(read("android/variables.gradle").match(/targetSdkVersion\s*=\s*(\d+)/)?.[1]),
  });
  if (!read("capacitor.config.ts").includes(`appId: "${config.bundleId}"`) ||
      !read("android/app/build.gradle").includes(`applicationId "${config.bundleId}"`) ||
      !read("ios/App/App.xcodeproj/project.pbxproj").includes(`PRODUCT_BUNDLE_IDENTIFIER = ${config.bundleId};`)) {
    issues.push("스토어 설정과 iOS/Android 앱 식별자가 일치하지 않습니다.");
  }
  if (online) {
    for (const key of ["privacyUrl", "supportUrl", ...(config.releaseScope === "full-service" ? ["accountDeletionUrl"] : [])]) {
      if (!config[key]) continue;
      try {
        const response = await fetch(config[key], { signal: AbortSignal.timeout(10000) });
        const body = await response.text();
        if (!response.ok || !response.headers.get("content-type")?.includes("text/html") || !body.includes(config.appName)) {
          issues.push(`${key}: 공개 HTML 페이지와 앱 이름을 확인하지 못했습니다.`);
        }
      } catch { issues.push(`${key}: 외부에서 페이지에 접속하지 못했습니다.`); }
    }
  }
  return issues;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const platform = process.argv.find(arg => arg.startsWith("--platform="))?.split("=")[1] || "all";
  const issues = await checkRelease(platform, process.argv.includes("--online"));
  if (issues.length) {
    console.error(`\n출시 빌드 중단: ${issues.length}개 미완료 항목\n` + issues.map(item => `- ${item}`).join("\n"));
    console.error("\n개발용 Debug 빌드는 가능합니다. 검사 통과는 스토어 승인 보장이 아닙니다.");
    process.exitCode = 1;
  } else {
    console.log("자동 점검 통과. 서명, 실기기 검증 기록 및 스토어 설문을 최종 확인하세요.");
  }
}
