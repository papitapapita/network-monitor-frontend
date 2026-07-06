import { test } from '@playwright/test';

test('colombia pin screenshot', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('http://localhost:3001/login');
  await page.fill('input[type="email"]', 'admin@example.com');
  await page.fill('input[type="password"]', 'changeme');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/');
  await page.goto('http://localhost:3001/map');
  await page.waitForTimeout(4000);
  await page.screenshot({ path: '/tmp/colombia-overview.png' });

  const markers = page.locator('.leaflet-marker-icon');
  const count = await markers.count();
  console.log('Markers:', count);

  for (let i = 0; i < count; i++) {
    try {
      await markers.nth(i).click({ force: true });
      await page.waitForTimeout(600);
      const popupText = await page.locator('.leaflet-popup-content').textContent().catch(() => '');
      if (popupText && (popupText.includes('Colombia') || popupText.includes('Torreo'))) {
        console.log(`Found at index ${i}: "${popupText.trim().slice(0, 120)}"`);
        await page.waitForTimeout(2500);
        await page.screenshot({ path: '/tmp/colombia-zoomed.png' });
        break;
      }
    } catch(e) {}
  }
});
