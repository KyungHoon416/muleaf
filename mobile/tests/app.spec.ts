import { test, expect } from "@playwright/test";

test("guest collection persists across restart and playback loads bundled preview", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/#track-1");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "음원 찜하기", exact: true }).click();
  await page.keyboard.press("Escape");
  await page.goto("/#library");
  await expect(page.getByRole("tab", { name: "찜한 음악 1" })).toBeVisible();
  await expect(page.locator("main").getByText("Beyond the Blue", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("tab", { name: "찜한 음악 1" })).toBeVisible();
  await page.getByRole("button", { name: "Beyond the Blue 재생", exact: true }).click();
  await expect.poll(() => page.locator("audio").evaluate((audio: HTMLAudioElement) => audio.currentTime)).toBeGreaterThan(0);
  expect(await page.locator("audio").getAttribute("src")).toContain("-preview.mp3");
  await page.screenshot({ path: "artifacts/mobile-library.png", fullPage: true });
  expect(errors).toEqual([]);
});

test("report without backend never shows a false receipt", async ({ page }) => {
  await page.goto("/#track-1");
  await page.getByRole("button", { name: "신고하기", exact: true }).click();
  await page.getByRole("radio").first().check();
  await page.getByRole("button", { name: "신고 접수", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("신고가 전송되지 않습니다");
  await expect(page.getByText("신고가 접수되었어요")).toHaveCount(0);
});

test("malformed local data recovers and home fits mobile viewport", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("muleaf-library-v1", "null"));
  await page.goto("/");
  await expect(page.locator("main")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "artifacts/mobile-home.png", fullPage: true });
});

test("blocking stops playback, hides the artist and persists across restart", async ({ page }) => {
  await page.goto("/#track-1");
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "재생", exact: true }).click();
  await expect.poll(() => page.locator("audio").evaluate((a: HTMLAudioElement) => a.currentTime)).toBeGreaterThan(0);
  await dialog.getByRole("button", { name: "아티스트 차단", exact: true }).click();
  await page.getByRole("button", { name: "차단 확인", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator("main").getByText("Beyond the Blue", { exact: true })).toHaveCount(0);
  await expect(page.locator("main").getByText("Neon Reverie", { exact: true })).toHaveCount(0);
  await expect.poll(() => page.locator("audio").evaluate((a: HTMLAudioElement) => a.paused)).toBe(true);
  await page.reload();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator("main").getByText("Beyond the Blue", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "개인정보 및 안전", exact: true }).first().click();
  await page.getByRole("button", { name: "LUNE 차단 해제" }).click();
  await page.keyboard.press("Escape");
  await expect(page.locator("main").getByText("Beyond the Blue", { exact: true }).first()).toBeVisible();
});

test("local data deletion requires confirmation and removes collections and blocks", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.setItem("muleaf-library-v1", JSON.stringify({ saved: [1, 3], playlist: [3], name: "나의 목록" }));
    localStorage.setItem("muleaf-blocked-artists-v1", JSON.stringify(["waveform"]));
  });
  await page.reload();
  await page.getByRole("button", { name: "개인정보 및 안전", exact: true }).first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("개인정보 처리 안내", { exact: true })).toBeVisible();
  await dialog.screenshot({ path: "artifacts/privacy-safety.png" });
  await dialog.getByRole("button", { name: "이 기기의 저장 데이터 삭제" }).click();
  await dialog.getByRole("button", { name: "취소", exact: true }).click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("muleaf-library-v1")!).saved)).toEqual([1, 3]);
  await dialog.getByRole("button", { name: "이 기기의 저장 데이터 삭제" }).click();
  await dialog.getByRole("button", { name: "삭제 확인", exact: true }).click();
  await expect(dialog.getByText("차단한 아티스트가 없습니다.")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.goto("/#library");
  await page.reload();
  await expect(page.getByRole("tab", { name: "찜한 음악 0" })).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("muleaf-library-v1")!).playlist)).toEqual([]);
  await page.screenshot({ path: "artifacts/empty-library-after-deletion.png" });
});
