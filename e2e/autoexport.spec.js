import { test, expect } from '@playwright/test';
import { seedApp, atNoon, addDays, buildSession, buildBlock1 } from './helpers.js';

const BLOCK_START = '2026-01-05';
const BLOCK1 = buildBlock1();
// Un jueves de la semana 3 del bloque 1: hay sesiones dentro de la ventana de 5 semanas.
const TODAY = addDays(BLOCK_START, 17);
const THU = { 1: addDays(BLOCK_START, 3), 2: addDays(BLOCK_START, 10) };

function seedWithSessions(page) {
  const sessions = [
    buildSession(THU[1], 'umbral', 1, 1, BLOCK1.weeks[1].umbral, {
      distanceKm: 4, paceSecPerKm: 308, hrAvg: 165, hrMax: 172, effort: 'controlado'
    }),
    buildSession(THU[2], 'umbral', 1, 2, BLOCK1.weeks[2].umbral, {
      status: 'skipped', reason: 'viaje'
    })
  ];
  return seedApp(page, { blockStart: BLOCK_START, sessions });
}

test('sin el parámetro la app se comporta igual que siempre', async ({ page }) => {
  await seedWithSessions(page);
  await page.clock.install({ time: atNoon(TODAY) });
  await page.goto('/');

  await expect(page.locator('.app-title')).toHaveText('Running');
  await expect(page.locator('.bottom-nav')).toBeVisible();
  await expect(page.locator('#view')).toBeVisible();
  await expect(page.locator('#autoexport')).toHaveCount(0);
});

test('con ?autoexport=1 se ve solo el texto plano, sin interfaz', async ({ page }) => {
  await seedWithSessions(page);
  await page.clock.install({ time: atNoon(TODAY) });
  await page.goto('/?autoexport=1');

  const pre = page.locator('pre#autoexport');
  await expect(pre).toBeVisible();

  // La interfaz normal no se monta.
  await expect(page.locator('.bottom-nav')).toHaveCount(0);
  await expect(page.locator('#view')).toHaveCount(0);

  const text = await pre.textContent();
  expect(text).toContain('RESUMEN MENSUAL DE ENTRENAMIENTO DE CARRERA');
  expect(text).toContain('== PLAN ACTUAL ==');
  expect(text).toContain('== ZONAS DE FRECUENCIA CARDIACA ==');
  expect(text).toContain('== ACTIVIDAD EN LA VENTANA ==');
  expect(text).toContain('== SESIONES (cronológico) ==');
  expect(text).toContain('== TENDENCIA Y SUGERENCIAS');
  // Datos reales de las sesiones sembradas.
  expect(text).toContain(`${THU[1]} · Umbral · B1S1`);
  expect(text).toContain('5:08/km');
  expect(text).toContain(`${THU[2]} · Umbral · B1S2 · NO REALIZADA (viaje)`);
  expect(text).not.toContain('<');
});

test('autoexport es solo lectura: no crea ni modifica claves de localStorage', async ({ page }) => {
  // Sembramos SOLo ajustes + sesiones, sin run.blocks: la app normal lo crearía,
  // autoexport no debe tocarlo.
  await page.addInitScript(() => {
    if (localStorage.getItem('run.settings') == null) {
      localStorage.setItem('run.settings', JSON.stringify({
        schemaVersion: 1,
        blockStart: '2026-01-05',
        weekdays: { suave: 1, series: 2, umbral: 4, larga: 5 },
        hrMax: 190, hrRest: 48, zonePaceNotes: {}, zones: []
      }));
    }
    if (localStorage.getItem('run.sessions') == null) {
      localStorage.setItem('run.sessions', JSON.stringify({ schemaVersion: 1, sessions: {} }));
    }
  });
  await page.clock.install({ time: atNoon(TODAY) });
  await page.goto('/?autoexport=1');
  await expect(page.locator('pre#autoexport')).toBeVisible();

  const keys = await page.evaluate(() => ({
    blocks: localStorage.getItem('run.blocks'),
    sessions: localStorage.getItem('run.sessions')
  }));
  expect(keys.blocks).toBeNull();
  expect(keys.sessions).toBe(JSON.stringify({ schemaVersion: 1, sessions: {} }));
});

test('autoexport no hace ninguna llamada de red externa', async ({ page }) => {
  const external = [];
  page.on('request', req => {
    const url = new URL(req.url());
    if (url.origin !== 'http://localhost:8137') external.push(req.url());
  });

  await seedWithSessions(page);
  await page.clock.install({ time: atNoon(TODAY) });
  await page.goto('/?autoexport=1');
  await expect(page.locator('pre#autoexport')).toBeVisible();
  await page.waitForTimeout(500);

  expect(external).toEqual([]);
});
