import { test, expect } from '@playwright/test';
import { seedApp, atNoon } from './helpers.js';

const BLOCK_START = '2026-01-05';

test('un día de montaña oculta el campo de ritmo y avisa', async ({ page }) => {
  await seedApp(page, { blockStart: BLOCK_START });
  await page.clock.install({ time: atNoon(BLOCK_START) }); // lunes, suave
  await page.goto('/');
  await page.getByRole('button', { name: 'Registrar sesión' }).click();

  await page.getByRole('button', { name: 'Montaña' }).click();
  await expect(page.getByText('el terreno invalida el ritmo')).toBeVisible();
  await expect(page.locator('.field:has-text("Ritmo medio")')).toHaveCount(0);

  await page.fill('.field:has-text("Distancia") .text-input', '6');
  await page.fill('.field:has-text("FC media") .text-input', '140');
  await page.getByRole('button', { name: 'Guardar' }).click();

  await expect(page.locator('.status')).toContainText('Montaña');
});

test('una sesión de montaña se ve marcada en el Historial y no aparece en la línea de ritmo', async ({ page }) => {
  await seedApp(page, { blockStart: BLOCK_START });
  await page.clock.install({ time: atNoon(BLOCK_START) });
  await page.goto('/');
  await page.getByRole('button', { name: 'Registrar sesión' }).click();
  await page.getByRole('button', { name: 'Montaña' }).click();
  await page.fill('.field:has-text("Distancia") .text-input', '6');
  await page.getByRole('button', { name: 'Guardar' }).click();

  await page.getByRole('button', { name: 'Historial' }).click();
  await page.getByRole('button', { name: /Enero 2026/ }).click();
  await page.getByRole('button', { name: /Semana 1 de 4/ }).click();
  await expect(page.locator('.badge--montana')).toHaveText('Montaña');
});
