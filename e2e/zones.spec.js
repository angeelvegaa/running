import { test, expect } from '@playwright/test';
import { seedApp } from './helpers.js';

const BLOCK_START = '2026-01-05';

test('Mis zonas muestra la tabla del documento por defecto', async ({ page }) => {
  await seedApp(page, { blockStart: BLOCK_START });
  await page.goto('/#/zones');

  const rows = page.locator('.zrow');
  await expect(rows).toHaveCount(5);
  await expect(rows.nth(0)).toContainText('119-133');
  await expect(rows.nth(1)).toContainText('133-147');
  await expect(rows.nth(3)).toContainText('162-177');
  await expect(rows.nth(4)).toContainText('177-190');
});

test('cambiar FCmáx/FCreposo en Ajustes recalcula las 5 zonas por Karvonen', async ({ page }) => {
  await seedApp(page, { blockStart: BLOCK_START });
  await page.goto('/#/settings');

  const hrInputs = page.locator('.card:has-text("FC máxima") .text-input');
  await hrInputs.nth(0).fill('200');
  await hrInputs.nth(1).fill('50');
  await page.getByRole('button', { name: 'Recalcular zonas con Karvonen' }).click();
  await expect(page.locator('.toast')).toContainText('recalculadas');

  await page.goto('/#/zones');
  // Karvonen con 200/50: Z2 = 50 + 0.60*150 a 50 + 0.70*150 = 140-155.
  await expect(page.locator('.zrow').nth(1)).toContainText('140-155');
});
