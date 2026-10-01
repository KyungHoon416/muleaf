import test from "node:test";
import assert from "node:assert/strict";
import { validateRelease, checkRelease } from "../scripts/release-check.mjs";

const input = {
  config: { operatorName: "테스트 운영자", supportEmail: "support@muleaf.test", privacyUrl: "https://muleaf.test/privacy", supportUrl: "https://muleaf.test/support", accountDeletionUrl: "https://muleaf.test/delete-account", bundleIdConfirmed: true, contentRightsVerified: true, privacyDisclosuresReviewed: true, ageRatingReviewed: true, moderationProcessVerified: true, physicalDeviceTested: { ios: true, android: true }, releaseScope: "full-service", storeMetadata: { name: "뮤리프", subtitle: "음악 탐색", shortDescription: "음악과 플레이리스트" } },
  env: { VITE_REPORTS_API_URL: "https://api.muleaf.test/reports" },
  source: "", platform: "all", hasAccountService: true, targetSdk: 36,
};

test("completed metadata cannot override unfinished implementation", () => {
  const issues = validateRelease({ ...input, source: "네이버 로그인은 준비 중 URL.createObjectURL(uploadFile) weeklyStreams:5840" });
  assert.equal(issues.length, 3);
});
test("guest flag alone cannot bypass account and upload checks", () => {
  const issues = validateRelease({ ...input, config: { ...input.config, releaseScope: "guest-library" }, source: "setLoginOpen(true); submitUpload()" });
  assert.ok(issues.some(issue => issue.includes("회원·업로드 기능")));
});
test("rejects HTTP legal pages, missing external deletion and outdated Android target", () => {
  const issues = validateRelease({ ...input, config: { ...input.config, privacyUrl: "http://muleaf.test/privacy", accountDeletionUrl: "" }, targetSdk: 35 });
  assert.equal(issues.length, 3);
});
test("current project remains blocked for release", async () => {
  const issues = await checkRelease();
  assert.ok(issues.some(issue => issue.includes("소셜 로그인")));
  assert.ok(issues.some(issue => issue.includes("서버 저장")));
  assert.ok(issues.some(issue => issue.includes("계정·관련 데이터 삭제")));
});
