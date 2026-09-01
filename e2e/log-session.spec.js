import { test, expect } from '@playwright/test';
import { seedApp, atNoon, addDays, fillPace } from './helpers.js';

const BLOCK_START = '2026-01-05';

test('registrar una sesión de umbral y verla reflejada en Hoy tras recargar', async ({ page }) => {
  await seedApp(page, { blockStart: BLOCK_START });
  await page.clock.install({ time: atNoon(addDays(BLOCK_START, 3)) }); // jueves, umbral
  await page.goto('/');

  await page.getByRole('button', { name: 'Registrar sesión' }).click();
  await expect(page.locator('h2')).toHaveText('Umbral');

  await page.fill('.field:has-text("Distancia") .text-input', '4.1');
  await fillPace(page.locator('.field:has-text("Ritmo medio")'), '5:10');
  await page.fill('.field:has-text("FC media") .text-input', '164');
  await page.fill('.field:has-text("FC máxima") .text-input', '171');
  await page.getByRole('button', { name: 'Exigente pero controlado' }).click();
  await page.getByRole('button', { name: 'Guardar' }).click();

  await expect(page).toHaveURL(/#\/today$/);
  await expect(page.locator('.status')).toHaveText('Registrada');

  await page.reload();
  await expect(page.locator('.status')).toHaveText('Registrada');
  await page.getByRole('button', { name: 'Editar registro' }).click();
  await expect(page.locator('.field:has-text("Distancia") .text-input')).toHaveValue('4.1');
  await expect(page.locator('.field:has-text("Ritmo medio") .pace-part').nth(0)).toHaveValue('5');
  await expect(page.locator('.field:has-text("Ritmo medio") .pace-part').nth(1)).toHaveValue('10');
});

test('registrar un día de series con repeticiones y ritmo de repetición', async ({ page }) => {
  await seedApp(page, { blockStart: BLOCK_START });
  await page.clock.install({ time: atNoon(addDays(BLOCK_START, 1)) }); // martes, series
  await page.goto('/');

  await page.getByRole('button', { name: 'Registrar sesión' }).click();
  await expect(page.locator('h2')).toHaveText('Series');

  // El día de series no pide distancia total.
  await expect(page.locator('.field:has-text("Distancia")')).toHaveCount(0);
  await page.fill('.field:has-text("Repeticiones hechas") .text-input', '7');
  await page.fill('.field:has-text("Metros por repetición") .text-input', '400');
  await fillPace(page.locator('.field:has-text("Ritmo medio de las repeticiones")'), '3:55');
  await page.getByRole('button', { name: 'Fácil', exact: true }).click();
  await page.getByRole('button', { name: 'Guardar' }).click();

  await expect(page.locator('.status')).toHaveText('Registrada');
  await page.getByRole('button', { name: 'Editar registro' }).click();
  await expect(page.locator('.field:has-text("Repeticiones hechas") .text-input')).toHaveValue('7');
  const repPace = page.locator('.field:has-text("Ritmo medio de las repeticiones") .pace-part');
  await expect(repPace.nth(0)).toHaveValue('3');
  await expect(repPace.nth(1)).toHaveValue('55');
});

test('el campo de segundos del ritmo se limita a 0-59', async ({ page }) => {
  await seedApp(page, { blockStart: BLOCK_START });
  await page.clock.install({ time: atNoon(addDays(BLOCK_START, 4)) }); // viernes, larga
  await page.goto('/');
  await page.getByRole('button', { name: 'Registrar sesión' }).click();

  const parts = page.locator('.field:has-text("Ritmo medio") .pace-part');
  await parts.nth(0).fill('5');
  await parts.nth(1).fill('99');
  await expect(parts.nth(1)).toHaveValue('59');

  await page.fill('.field:has-text("Distancia") .text-input', '10');
  await page.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.locator('.status')).toHaveText('Registrada');
});

test('eliminar una sesión registrada la deja como sin registrar', async ({ page }) => {
  await seedApp(page, { blockStart: BLOCK_START });
  await page.clock.install({ time: atNoon(BLOCK_START) }); // lunes, suave
  await page.goto('/');
  await page.getByRole('button', { name: 'Registrar sesión' }).click();
  await page.fill('.field:has-text("Distancia") .text-input', '5');
  await page.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.locator('.status')).toHaveText('Registrada');

  await page.getByRole('button', { name: 'Editar registro' }).click();
  await page.getByRole('button', { name: 'Eliminar sesión' }).click();
  await expect(page.locator('#modalOverlay')).toBeVisible();
  await page.locator('#modalOk').click();

  await expect(page.locator('.status')).toHaveText('Sin registrar');
});
