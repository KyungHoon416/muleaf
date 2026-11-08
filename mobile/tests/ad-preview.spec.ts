import { test, expect } from '@playwright/test';

test('review build keeps a labelled local sample and never requests network ads', async ({ page }) => {
  const adRequests: string[] = [];
  page.on('request', request => {
    if (/googlesyndication|doubleclick/.test(request.url())) adRequests.push(request.url());
  });
  await page.goto('/');
  await expect(page.getByRole('complementary', { name: '테스트 광고 미리보기' })).toBeVisible();
  await expect(page.getByText('테스트 광고 · 실제 광고 아님', { exact: true })).toBeVisible();
  await expect(page.locator('ins.adsbygoogle')).toHaveCount(0);
  await expect(page.locator('script[src*="adsbygoogle"]')).toHaveCount(0);
  await page.goto('/#library');
  await expect(page.getByRole('complementary', { name: '테스트 광고 미리보기' })).toHaveCount(0);
  await page.goto('/#charts');
  await expect(page.getByRole('complementary', { name: '테스트 광고 미리보기' })).toHaveCount(0);
  expect(adRequests).toEqual([]);
});
