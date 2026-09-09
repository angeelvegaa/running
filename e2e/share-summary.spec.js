import { test, expect } from '@playwright/test';
import { seedApp, atNoon, addDays, buildSession, buildBlock1 } from './helpers.js';

const BLOCK_START = '2026-08-31'; // lunes
const TODAY = '2026-09-09';
const B1 = buildBlock1();

function seedRealisticSessions(page) {
  const sessions = [
    buildSession(addDays(TODAY, -5), 'umbral', 1, 1, B1.weeks[1].umbral, {
      distanceKm: 4, paceSecPerKm: 308, hrAvg: 165, hrMax: 172, effort: 'controlado'
    }),
    buildSession(addDays(TODAY, -2), 'larga', 1, 1, B1.weeks[1].larga, {
      distanceKm: 10, paceSecPerKm: 372, hrAvg: 144, effort: 'facil'
    })
  ];
  return seedApp(page, { blockStart: BLOCK_START, sessions });
}

test('el botón "Compartir resumen" aparece en Ajustes', async ({ page }) => {
  await seedRealisticSessions(page);
  await page.clock.install({ time: atNoon(TODAY) });
  await page.goto('/#/settings');

  const card = page.locator('.card', { hasText: 'Compartir resumen' });
  await expect(card).toBeVisible();
  await expect(card.getByRole('button', { name: 'Compartir resumen' })).toBeVisible();
});

test('genera el texto correcto con la fecha AAAA-MM-DD delante y llama a navigator.share', async ({ page }) => {
  await page.addInitScript(() => {
    window.__share = [];
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: (data) => { window.__share.push(data); return Promise.resolve(); }
    });
  });
  await seedRealisticSessions(page);
  await page.clock.install({ time: atNoon(TODAY) });
  await page.goto('/#/settings');

  await page.locator('.card', { hasText: 'Compartir resumen' })
    .getByRole('button', { name: 'Compartir resumen' }).click();

  await expect.poll(() => page.evaluate(() => window.__share.length)).toBe(1);
  const shared = await page.evaluate(() => window.__share[0]);

  const lines = shared.text.split('\n');
  expect(lines[0]).toBe(TODAY);                    // primera línea: solo la fecha
  expect(lines[0]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  expect(shared.text).toContain('RESUMEN MENSUAL DE ENTRENAMIENTO DE CARRERA');
  expect(shared.text).toContain('== PLAN ACTUAL ==');
  expect(shared.text).toContain('== SESIONES (cronológico) ==');
  expect(shared.text).toContain(`${addDays(TODAY, -5)} · Umbral · B1S1`);
  expect(shared.text).toContain(`${addDays(TODAY, -2)} · Larga · B1S1`);
});

test('sin navigator.share, copia al portapapeles y avisa', async ({ page }) => {
  await page.addInitScript(() => {
    window.__clip = [];
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: (t) => { window.__clip.push(t); return Promise.resolve(); } }
    });
  });
  await seedRealisticSessions(page);
  await page.clock.install({ time: atNoon(TODAY) });
  await page.goto('/#/settings');

  await page.locator('.card', { hasText: 'Compartir resumen' })
    .getByRole('button', { name: 'Compartir resumen' }).click();

  await expect.poll(() => page.evaluate(() => window.__clip.length)).toBe(1);
  const copied = await page.evaluate(() => window.__clip[0]);
  expect(copied.split('\n')[0]).toBe(TODAY);
  expect(copied).toContain('RESUMEN MENSUAL DE ENTRENAMIENTO DE CARRERA');
  await expect(page.locator('.toast')).toContainText('portapapeles');
});

test('?autoexport=1 sigue funcionando y también lleva la fecha delante', async ({ page }) => {
  await seedRealisticSessions(page);
  await page.clock.install({ time: atNoon(TODAY) });
  await page.goto('/?autoexport=1');

  const pre = page.locator('pre#autoexport');
  await expect(pre).toBeVisible();
  const text = await pre.textContent();
  expect(text.split('\n')[0]).toBe(TODAY);
  expect(text).toContain('RESUMEN MENSUAL DE ENTRENAMIENTO DE CARRERA');
});
