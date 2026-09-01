import { test, expect } from '@playwright/test';
import { seedApp, atNoon, addDays } from './helpers.js';

const BLOCK_START = '2026-01-05'; // lunes: día 1 de la semana 1 del bloque

const WEEK_CASES = [
  { weekInBlock: 1, dateStr: BLOCK_START, label: 'Base', type: 'Suave', target: '5 km · 5:50-6:30/km' },
  { weekInBlock: 2, dateStr: addDays(BLOCK_START, 7), label: 'Base', type: 'Suave', target: '5-5,5 km · 5:50-6:30/km' },
  { weekInBlock: 3, dateStr: addDays(BLOCK_START, 14), label: 'Pico', type: 'Suave', target: '5,5-6 km · 5:50-6:30/km' },
  { weekInBlock: 4, dateStr: addDays(BLOCK_START, 21), label: 'Deload', type: 'Suave', target: '4 km · 5:50-6:30/km' }
];

for (const { weekInBlock, dateStr, label, target } of WEEK_CASES) {
  test(`Hoy muestra Bloque 1 · Semana ${weekInBlock} de 4 · ${label}`, async ({ page }) => {
    await seedApp(page, { blockStart: BLOCK_START });
    await page.clock.install({ time: atNoon(dateStr) });
    await page.goto('/');

    await expect(page.locator('.today-block-info')).toHaveText(`Bloque 1 · Semana ${weekInBlock} de 4 · ${label}`);
    await expect(page.locator('.card--today h2')).toHaveText('Suave');
    await expect(page.locator('.today-target')).toContainText(target);
  });
}

test('el martes toca Series y el jueves Umbral, con sus objetivos', async ({ page }) => {
  await seedApp(page, { blockStart: BLOCK_START });

  await page.clock.install({ time: atNoon(addDays(BLOCK_START, 1)) }); // martes semana 1
  await page.goto('/');
  await expect(page.locator('.card--today h2')).toHaveText('Series');
  await expect(page.locator('.today-target')).toContainText('6-8 × 400 m · 3:50-4:10/km');

  await page.clock.setFixedTime(atNoon(addDays(BLOCK_START, 3))); // jueves semana 1
  await page.reload();
  await expect(page.locator('.card--today h2')).toHaveText('Umbral');
  await expect(page.locator('.today-target')).toContainText('4 km · 5:05-5:15/km');
});

test('el miércoles no toca carrera', async ({ page }) => {
  await seedApp(page, { blockStart: BLOCK_START });
  await page.clock.install({ time: atNoon(addDays(BLOCK_START, 2)) }); // miércoles
  await page.goto('/');
  await expect(page.getByText('Hoy no toca carrera')).toBeVisible();
});

test('entra en el bloque 2 tras 4 semanas', async ({ page }) => {
  await seedApp(page, { blockStart: BLOCK_START });
  await page.clock.install({ time: atNoon(addDays(BLOCK_START, 28)) }); // semana 1 del bloque 2
  await page.goto('/');
  await expect(page.locator('.today-block-info')).toHaveText('Bloque 2 · Semana 1 de 4 · Base');
});

test('el aviso de cambio de semana aparece el día exacto y no se repite', async ({ page }) => {
  const weekTwo = addDays(BLOCK_START, 7);
  await seedApp(page, { blockStart: BLOCK_START });
  await page.clock.install({ time: atNoon(weekTwo) });
  await page.goto('/');

  const banner = page.locator('.week-banner');
  await expect(banner).toBeVisible();
  await expect(banner).toContainText('Semana 2');

  await page.reload();
  await expect(page.locator('.week-banner')).toHaveCount(0);
});

test('el recuento de semana sobrevive al cambio de hora de primavera', async ({ page }) => {
  // Bloque arrancado antes del cambio de hora (29 marzo 2026 en España): al
  // restar fechas locales, esa hora perdida puede colar un día de menos y
  // desplazar para siempre el día en que cambia la semana.
  const dstStart = '2026-03-02'; // lunes
  const blockTwoStart = addDays(dstStart, 28); // 2026-03-30, tras el cambio de hora del día 29
  await seedApp(page, { blockStart: dstStart });
  await page.clock.install({ time: atNoon(blockTwoStart) });
  await page.goto('/');

  await expect(page.locator('.today-block-info')).toHaveText('Bloque 2 · Semana 1 de 4 · Base');
});
