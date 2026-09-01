import { test, expect } from '@playwright/test';
import { seedApp, atNoon, addDays } from './helpers.js';

const BLOCK_START = '2026-01-05';

test('la pestaña Plan muestra, de solo lectura, qué toca cada día del bloque y semana actual', async ({ page }) => {
  await seedApp(page, { blockStart: BLOCK_START });
  await page.clock.install({ time: atNoon(addDays(BLOCK_START, 15)) }); // semana 3 (pico)
  await page.goto('/');

  await page.getByRole('button', { name: 'Plan' }).click();
  await expect(page).toHaveURL(/#\/plan$/);
  await expect(page.locator('.today-block-info')).toHaveText('Bloque 1 · Semana 3 de 4 · Pico');

  const days = page.locator('.plan-day');
  await expect(days).toHaveCount(4);
  // orden por día de la semana: lunes suave, martes series, jueves umbral, viernes larga
  await expect(days.nth(0)).toContainText('Lunes');
  await expect(days.nth(0)).toContainText('Suave');
  await expect(days.nth(1)).toContainText('Series');
  await expect(days.nth(1)).toContainText('8-10 × 400 m · 3:45-4:05/km'); // objetivo de la semana 3
  await expect(days.nth(2)).toContainText('Umbral');
  await expect(days.nth(3)).toContainText('Larga');

  // no hay nada que registrar desde aquí
  await expect(page.getByRole('button', { name: 'Registrar sesión' })).toHaveCount(0);
});

test('el selector de semana deja mirar otras semanas del bloque sin salir de Plan', async ({ page }) => {
  await seedApp(page, { blockStart: BLOCK_START });
  await page.clock.install({ time: atNoon(BLOCK_START) }); // semana 1
  await page.goto('/#/plan');

  await expect(page.locator('.plan-day').nth(1)).toContainText('6-8 × 400 m · 3:50-4:10/km');
  await page.getByRole('button', { name: 'Sem 4' }).click();
  await expect(page.locator('.today-block-info')).toContainText('Semana 4 de 4 · Deload');
  await expect(page.locator('.plan-day').nth(1)).toContainText('4-5 × 400 m');
});
