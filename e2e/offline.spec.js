import { test, expect } from '@playwright/test';
import { seedApp } from './helpers.js';

const BLOCK_START = '2026-01-05';

test('el service worker cachea el shell y la app abre sin red', async ({ page, context, browserName }) => {
  test.skip(browserName !== 'chromium', 'El control de red offline determinista solo se prueba en Chromium.');

  await seedApp(page, { blockStart: BLOCK_START });
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready);
  // Da tiempo a que el evento install/activate termine de cachear el shell.
  await page.waitForFunction(async () => {
    const keys = await caches.keys();
    if (!keys.length) return false;
    const cache = await caches.open(keys[0]);
    return (await cache.match('./index.html')) != null;
  });

  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('.app-title')).toHaveText('Running');
  await expect(page.locator('.bottom-nav')).toBeVisible();

  await context.setOffline(false);
});
