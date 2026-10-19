import { test, expect } from '@playwright/test';
import { buildSession, buildBlock1, atNoon, addDays } from './helpers.js';

const BLOCK_START = '2026-01-05'; // lunes
const BLOCK1 = buildBlock1();

// Ajustes tal como los dejó la versión de 4 sesiones: sin suaveEnabled.
async function seedLegacy(page, sessions = []) {
  await page.addInitScript(([settings, blocks, sess]) => {
    if (localStorage.getItem('run.settings') != null) return;
    localStorage.setItem('run.settings', JSON.stringify(settings));
    localStorage.setItem('run.blocks', JSON.stringify({ schemaVersion: 1, blocks }));
    localStorage.setItem('run.sessions', JSON.stringify({ schemaVersion: 1, sessions: sess }));
  }, [{
    schemaVersion: 1, blockStart: BLOCK_START,
    weekdays: { suave: 1, series: 2, umbral: 4, larga: 5 },
    hrMax: 190, hrRest: 48, zonePaceNotes: {}, zones: []
  }, { 1: BLOCK1 }, Object.fromEntries(sessions)]);
}

test('ajustes antiguos migran a 3 sesiones sin perder el historial de Suave', async ({ page }) => {
  const suave = buildSession(BLOCK_START, 'suave', 1, 1, BLOCK1.weeks[1].suave, { distanceKm: 5, paceSecPerKm: 370 });
  await seedLegacy(page, [suave]);
  await page.clock.install({ time: atNoon(BLOCK_START) }); // lunes
  await page.goto('/');
  await expect(page.locator('.card--today h2')).toHaveText('Series');

  const stored = await page.evaluate(() => ({
    s: JSON.parse(localStorage.getItem('run.settings')),
    sess: JSON.parse(localStorage.getItem('run.sessions'))
  }));
  expect(stored.s.suaveEnabled).toBe(false);
  expect(stored.s.weekdays).toEqual({ suave: 1, series: 1, umbral: 3, larga: 5 });
  expect(stored.sess.sessions[`${BLOCK_START}_suave`].distanceKm).toBe(5);

  await page.goto('/#/history/2026-01/1-1');
  await page.getByRole('button', { name: /Suave/ }).click();
  await expect(page.locator('h2')).toHaveText('Suave');
});

test('Plan muestra solo 3 sesiones: lunes Series, miércoles Umbral, viernes Larga', async ({ page }) => {
  await seedLegacy(page);
  await page.clock.install({ time: atNoon(BLOCK_START) });
  await page.goto('/#/plan');
  const days = page.locator('.plan-day');
  await expect(days).toHaveCount(3);
  await expect(days.nth(0)).toContainText('Lunes');
  await expect(days.nth(0)).toContainText('Series');
  await expect(days.nth(1)).toContainText('Miércoles');
  await expect(days.nth(1)).toContainText('Umbral');
  await expect(days.nth(2)).toContainText('Viernes');
  await expect(days.nth(2)).toContainText('Larga');
});

test('sin Suave, ningún día aparece como no realizado y el resumen se genera', async ({ page }) => {
  await seedLegacy(page);
  await page.clock.install({ time: atNoon(addDays(BLOCK_START, 8)) }); // martes
  await page.goto('/');
  await expect(page.getByText('Hoy no toca carrera')).toBeVisible();
  const sessions = await page.evaluate(() => JSON.parse(localStorage.getItem('run.sessions')).sessions);
  expect(Object.values(sessions).filter(s => s.status === 'skipped')).toHaveLength(0);

  await page.goto('/?autoexport=1');
  const text = await page.locator('pre#autoexport').textContent();
  expect(text).toContain('sesiones por semana: 3');
  expect(text).toContain('  - Series:');
  expect(text).not.toContain('  - Suave:');
});

test('reactivar la Suave devuelve el plan de 4 sesiones', async ({ page }) => {
  await seedLegacy(page);
  await page.clock.install({ time: atNoon(BLOCK_START) });
  await page.goto('/#/settings');
  await page.locator('#suaveEnabled').check();
  await page.goto('/#/plan');
  await expect(page.locator('.plan-day')).toHaveCount(4);
  await expect(page.locator('.plan-day').nth(0)).toContainText('Suave');
  await page.goto('/');
  await expect(page.locator('.card--today h2')).toHaveText('Suave');
});

test('proponer bloque nuevo funciona con 3 sesiones y conserva los objetivos de Suave', async ({ page }) => {
  await seedLegacy(page);
  await page.clock.install({ time: atNoon(BLOCK_START) });
  await page.goto('/#/block-editor/propose');
  await expect(page.locator('.editor-target-row')).toHaveCount(12); // 3 tipos x 4 semanas
  await page.getByRole('button', { name: 'Guardar bloque' }).click();
  await page.getByRole('button', { name: 'Aceptar' }).click();
  await expect(page).toHaveURL(/#\/settings$/);
  const b2 = await page.evaluate(() => JSON.parse(localStorage.getItem('run.blocks')).blocks[2]);
  expect(b2.weeks[1].suave).toBeTruthy();
  expect(b2.weeks[1].larga).toBeTruthy();
});
