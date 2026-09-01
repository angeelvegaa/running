import { test, expect } from '@playwright/test';
import { seedApp, atNoon, fillPace } from './helpers.js';

const BLOCK_START = '2026-01-05';

test('al borrar una sesión desde el detalle desaparece del todo del Historial, aunque después se abra Hoy', async ({ page }) => {
  await seedApp(page, { blockStart: BLOCK_START });
  await page.clock.install({ time: atNoon(BLOCK_START) }); // lunes, suave
  await page.goto('/');

  // Registrar
  await page.getByRole('button', { name: 'Registrar sesión' }).click();
  await page.fill('.field:has-text("Distancia") .text-input', '5');
  await fillPace(page.locator('.field:has-text("Ritmo medio")'), '6:05');
  await page.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.locator('.status')).toHaveText('Registrada');

  // Borrar desde el detalle del Historial
  await page.getByRole('button', { name: 'Historial' }).click();
  await page.getByRole('button', { name: /Enero 2026/ }).click();
  await page.getByRole('button', { name: /Semana 1 de 4/ }).click();
  await page.getByRole('button', { name: /Suave/ }).click();
  await page.getByRole('button', { name: 'Eliminar esta sesión' }).click();
  await page.locator('#modalOk').click();

  await expect(page.getByText('Sin sesiones esta semana')).toBeVisible();

  // Abrir Hoy (esto antes recreaba una sesión "pending" que reaparecía como
  // "Completada" fantasma) y volver al Historial: no debe quedar rastro.
  await page.getByRole('button', { name: 'Hoy' }).click();
  await expect(page.locator('.status')).toHaveText('Sin registrar');

  await page.getByRole('button', { name: 'Historial' }).click();
  await expect(page.getByText('Todavía no hay sesiones registradas')).toBeVisible();
  await expect(page.locator('.history-row')).toHaveCount(0);
});

test('deshacer "no realizada" también borra el registro por completo', async ({ page }) => {
  await seedApp(page, { blockStart: BLOCK_START });
  await page.clock.install({ time: atNoon(BLOCK_START) });
  await page.goto('/');

  await page.getByRole('button', { name: 'Marcar como no realizada' }).click();
  await page.fill('#modalInput', 'lluvia');
  await page.locator('#modalOk').click();
  await expect(page.locator('.status')).toHaveText('No realizada');

  await page.getByRole('button', { name: 'Deshacer "no realizada"' }).click();
  await expect(page.locator('.status')).toHaveText('Sin registrar');

  await page.getByRole('button', { name: 'Historial' }).click();
  await expect(page.locator('.history-row')).toHaveCount(0);
});
