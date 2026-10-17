import { test, expect } from '@playwright/test';

test('all supplied legal documents are reachable and preserve draft disclosures', async ({ page }) => {
  await page.route('**/*googlesyndication.com/**', route => route.abort());
  await page.goto('/');
  const titles = ['서비스 이용약관', '개인정보처리방침', '광고성 정보 수신 동의서 (선택)', '마케팅 목적 개인정보 이용 동의서 (선택)'];
  for (const title of titles) {
    await page.getByRole('navigation', { name: '약관 및 개인정보 안내' }).getByRole('button', { name: title, exact: true }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: title, exact: true })).toBeVisible();
    await expect(dialog.getByText('검토 중인 초안', { exact: true })).toBeVisible();
    await expect(dialog).toContainText('539-09-02396');
    if (title === '개인정보처리방침') {
      await expect(dialog.getByRole('table')).toHaveCount(5);
      await expect(dialog).toContainText('제14조 개인정보처리방침의 변경');
    }
    if (title === '서비스 이용약관') await expect(dialog).toContainText('제15조 손해배상 분쟁 해결 및 연락처');
    await page.keyboard.press('Escape');
  }
});
