import { test, expect } from '@playwright/test';
import { seedApp, atNoon, addDays, buildSession, buildBlock1 } from './helpers.js';

const BLOCK_START = '2026-01-05';
const BLOCK1 = buildBlock1();
const THU = { 1: addDays(BLOCK_START, 3), 2: addDays(BLOCK_START, 10), 3: addDays(BLOCK_START, 17) };
const TUE = { 1: addDays(BLOCK_START, 1), 2: addDays(BLOCK_START, 8) };
const TODAY_BLOCK2_WEEK1_THU = addDays(BLOCK_START, 31);

test('R1: 3 sesiones de umbral seguidas más rápidas y controladas sugieren bajar el objetivo', async ({ page }) => {
  const sessions = [1, 2, 3].map(w => buildSession(THU[w], 'umbral', 1, w, BLOCK1.weeks[w].umbral, {
    distanceKm: BLOCK1.weeks[w].umbral.distanceKm[0],
    paceSecPerKm: 295,
    effort: 'controlado'
  }));
  await seedApp(page, { blockStart: BLOCK_START, sessions });
  await page.clock.install({ time: atNoon(TODAY_BLOCK2_WEEK1_THU) });
  await page.goto('/');

  const card = page.locator('.card', { hasText: 'Antes de la sesión' });
  await expect(card).toContainText('3 sesiones seguidas más rápido que el objetivo');
  await expect(card).toContainText('Baja el objetivo de 5:05-5:15/km a 5:00-5:10/km');
  await expect(card.getByRole('button', { name: 'Aplicar' })).toBeVisible();
});

test('R2a: FC disparada dos sesiones seguidas de umbral sugiere no subir', async ({ page }) => {
  const sessions = [1, 2].map(w => buildSession(THU[w], 'umbral', 1, w, BLOCK1.weeks[w].umbral, {
    distanceKm: BLOCK1.weeks[w].umbral.distanceKm[0],
    paceSecPerKm: BLOCK1.weeks[w].umbral.paceSecPerKm[0],
    effort: 'controlado',
    hrAvg: w === 1 ? 176 : 178
  }));
  await seedApp(page, { blockStart: BLOCK_START, sessions });
  await page.clock.install({ time: atNoon(THU[3]) });
  await page.goto('/');

  const card = page.locator('.card', { hasText: 'Antes de la sesión' });
  await expect(card).toContainText('No subas el ritmo objetivo de umbral');
  await expect(card).toContainText('FC media 176 y 178');
  await expect(card).toContainText('157-170');
});

test('R2b: dos sesiones de series "muy duro" sugieren no subir, aunque la FC no se mire en series', async ({ page }) => {
  const sessions = [1, 2].map(w => buildSession(TUE[w], 'series', 1, w, BLOCK1.weeks[w].series, {
    repsDone: BLOCK1.weeks[w].series.reps[0],
    repPaceSecPerKm: BLOCK1.weeks[w].series.paceSecPerKm[0],
    effort: 'muy_duro',
    hrAvg: 150 // dentro de rango, para probar que R2b no depende de la FC
  }));
  await seedApp(page, { blockStart: BLOCK_START, sessions });
  await page.clock.install({ time: atNoon(addDays(BLOCK_START, 15)) }); // martes semana 3
  await page.goto('/');

  const card = page.locator('.card', { hasText: 'Antes de la sesión' });
  await expect(card).toContainText('Dos sesiones seguidas de series en "muy duro"');
});

test('supresión: si R2 dispara, R1 no se muestra aunque las 3 sesiones también lo cumplieran', async ({ page }) => {
  const sessions = [1, 2, 3].map(w => buildSession(THU[w], 'umbral', 1, w, BLOCK1.weeks[w].umbral, {
    distanceKm: BLOCK1.weeks[w].umbral.distanceKm[0],
    paceSecPerKm: 295,
    effort: 'controlado',
    hrAvg: w >= 2 ? (w === 2 ? 176 : 178) : null // FC disparada en las 2 últimas
  }));
  await seedApp(page, { blockStart: BLOCK_START, sessions });
  await page.clock.install({ time: atNoon(TODAY_BLOCK2_WEEK1_THU) });
  await page.goto('/');

  const card = page.locator('.card', { hasText: 'Antes de la sesión' });
  await expect(card).toContainText('No subas el ritmo objetivo');
  await expect(card).not.toContainText('Baja el objetivo');
});

test('un día no realizado en medio corta la racha: no compara sesiones no consecutivas', async ({ page }) => {
  const qualifying = [1, 2, 3].map(w => buildSession(THU[w], 'umbral', 1, w, BLOCK1.weeks[w].umbral, {
    distanceKm: BLOCK1.weeks[w].umbral.distanceKm[0],
    paceSecPerKm: 295,
    effort: 'controlado'
  }));
  const gap = buildSession(addDays(BLOCK_START, 24), 'umbral', 1, 4, BLOCK1.weeks[4].umbral, { status: 'skipped', reason: 'viaje' });
  await seedApp(page, { blockStart: BLOCK_START, sessions: [...qualifying, gap] });
  await page.clock.install({ time: atNoon(TODAY_BLOCK2_WEEK1_THU) });
  await page.goto('/');

  await expect(page.locator('.card', { hasText: 'Antes de la sesión' })).toHaveCount(0);
});
