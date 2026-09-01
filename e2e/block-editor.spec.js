import { test, expect } from '@playwright/test';
import { seedApp, atNoon, addDays, buildSession, buildBlock1 } from './helpers.js';

const BLOCK_START = '2026-01-05';
const BLOCK1 = buildBlock1();

test('proponer el bloque 2 parte del pico del bloque 1 y se puede guardar', async ({ page }) => {
  await seedApp(page, { blockStart: BLOCK_START });
  await page.goto('/#/settings');

  await page.getByRole('button', { name: 'Proponer bloque 2' }).click();
  await expect(page.locator('h2')).toHaveText('Bloque 2 propuesto');

  // Semana 1 del bloque 2 = pico (semana 3) del bloque 1 para series: 8-10 reps.
  const seriesWeek1 = page.locator('.editor-target-row', { hasText: 'Series' }).first();
  await expect(seriesWeek1.locator('.editor-num').first()).toHaveValue('8');
  await expect(seriesWeek1.locator('.editor-num').nth(1)).toHaveValue('10');

  await page.getByRole('button', { name: 'Guardar bloque' }).click();
  await page.locator('#modalOk').click();
  await expect(page.locator('.toast')).toContainText('Bloque 2 guardado');

  await expect(page.getByText('Bloque configurado más alto: 2.')).toBeVisible();
});

test('el botón Aplicar de una sugerencia mueve el objetivo y persiste', async ({ page }) => {
  const THU = { 1: addDays(BLOCK_START, 3), 2: addDays(BLOCK_START, 10), 3: addDays(BLOCK_START, 17) };
  const sessions = [1, 2, 3].map(w => buildSession(THU[w], 'umbral', 1, w, BLOCK1.weeks[w].umbral, {
    distanceKm: BLOCK1.weeks[w].umbral.distanceKm[0], paceSecPerKm: 295, effort: 'controlado'
  }));
  await seedApp(page, { blockStart: BLOCK_START, sessions });
  // Jueves de la semana 1 del bloque 2 (sin configurar todavía: usa el
  // objetivo del bloque 1 como respaldo, con ritmo 5:05-5:15).
  await page.clock.install({ time: atNoon(addDays(BLOCK_START, 31)) });
  await page.goto('/');

  await expect(page.locator('.today-target')).toContainText('5:05-5:15');
  await page.getByRole('button', { name: 'Aplicar' }).click();
  await page.locator('#modalOk').click();
  await expect(page.locator('.toast')).toContainText('actualizado');
  // El objetivo de hoy (bloque 2, todavía sin guardar de forma explícita)
  // refleja el cambio en cuanto se vuelve a pintar Hoy.
  await expect(page.locator('.today-target')).toContainText('5:00-5:10');

  // Aplicar el cambio creó el bloque 2 (copia ajustada del respaldo), así
  // que ahora es el bloque configurado más alto.
  await page.getByRole('button', { name: 'Ajustes' }).click();
  await expect(page.getByText('Bloque configurado más alto: 2.')).toBeVisible();
  await page.getByRole('button', { name: 'Editar bloque 2' }).click();
  const week1Umbral = page.locator('.editor-target-row', { hasText: 'Umbral' }).first();
  await expect(week1Umbral.locator('.editor-pace').first()).toHaveValue('5:00');
  await expect(week1Umbral.locator('.editor-pace').nth(1)).toHaveValue('5:10');
});
