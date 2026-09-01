import { test, expect } from '@playwright/test';
import { seedApp, addDays, buildSession, buildBlock1 } from './helpers.js';

const BLOCK_START = '2026-01-05';
const BLOCK1 = buildBlock1();

function suave(week, offsetWeeks, extra = {}) {
  const date = addDays(BLOCK_START, offsetWeeks * 7);
  return buildSession(date, 'suave', 1, week, BLOCK1.weeks[week].suave, {
    distanceKm: 5, paceSecPerKm: 370, hrAvg: 140, effort: 'controlado', ...extra
  });
}

test('Historial: meses -> semanas -> días -> detalle, y borrar una sesión', async ({ page }) => {
  const sessions = [suave(1, 0), suave(2, 1)];
  await seedApp(page, { blockStart: BLOCK_START, sessions });
  await page.goto('/#/history');

  await page.getByRole('button', { name: /Enero 2026/ }).click();
  await expect(page).toHaveURL(/#\/history\/2026-01$/);

  await page.getByRole('button', { name: /Semana 1 de 4/ }).click();
  await expect(page).toHaveURL(/#\/history\/2026-01\/1-1$/);

  await page.getByRole('button', { name: /Suave/ }).click();
  await expect(page.locator('h2')).toHaveText('Suave');
  await expect(page.getByText('Ritmo medio: 6:10/km')).toBeVisible();

  await page.getByRole('button', { name: 'Eliminar esta sesión' }).click();
  await page.locator('#modalOk').click();
  await expect(page).toHaveURL(/#\/history\/2026-01\/1-1$/);
  await expect(page.getByText('Sin sesiones esta semana')).toBeVisible();
});

test('Progreso: gráfico de ritmo y FC con al menos 2 puntos', async ({ page }) => {
  const sessions = [suave(1, 0), suave(2, 1), suave(3, 2)];
  await seedApp(page, { blockStart: BLOCK_START, sessions });
  await page.goto('/#/progress');

  await expect(page.locator('.progress-chart')).toHaveCount(2);
  await expect(page.locator('.progress-chart-point')).toHaveCount(6); // 3 puntos x 2 gráficos
});

test('Progreso: cambiar de tipo redibuja el gráfico para ese tipo', async ({ page }) => {
  const sessions = [suave(1, 0), suave(2, 1)];
  await seedApp(page, { blockStart: BLOCK_START, sessions });
  await page.goto('/#/progress');

  await page.getByRole('button', { name: 'Series', exact: true }).click();
  await expect(page.getByText('Todavía no hay sesiones de este tipo')).toBeVisible();
});
