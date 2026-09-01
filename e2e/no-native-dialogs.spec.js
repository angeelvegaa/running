import { test, expect } from '@playwright/test';
import { seedApp, atNoon, addDays, buildSession, buildBlock1 } from './helpers.js';

// iOS bloquea en silencio confirm()/prompt()/alert() nativos en apps
// instaladas en pantalla de inicio: si alguno se colara, este test lo pilla
// en cualquier navegador antes de que llegue a producción.

const BLOCK_START = '2026-01-05';
const BLOCK1 = buildBlock1();

test('ninguna pantalla dispara un diálogo nativo del navegador', async ({ page }) => {
  let dialogFired = false;
  page.on('dialog', async (dialog) => { dialogFired = true; await dialog.dismiss(); });

  const sessions = [buildSession(BLOCK_START, 'suave', 1, 1, BLOCK1.weeks[1].suave, { distanceKm: 5, paceSecPerKm: 370 })];
  await seedApp(page, { blockStart: BLOCK_START, sessions });
  await page.clock.install({ time: atNoon(addDays(BLOCK_START, 1)) });
  await page.goto('/');

  // Hoy -> marcar no realizada (usa promptModal)
  await page.getByRole('button', { name: 'Marcar como no realizada' }).click();
  await expect(page.locator('#modalOverlay')).toBeVisible();
  await page.fill('#modalInput', 'probando');
  await page.locator('#modalOk').click();
  await expect(page.locator('.status')).toContainText('No realizada');

  // Historial -> detalle -> eliminar (usa confirmModal)
  await page.getByRole('button', { name: 'Historial' }).click();
  await page.getByRole('button', { name: /Enero 2026/ }).click();
  await page.getByRole('button', { name: /Semana 1 de 4/ }).click();
  await page.getByRole('button', { name: /Suave/ }).click();
  await page.getByRole('button', { name: 'Eliminar esta sesión' }).click();
  await expect(page.locator('#modalOverlay')).toBeVisible();
  await page.locator('#modalCancel').click();

  // Progreso, Zonas, Ajustes
  await page.getByRole('button', { name: 'Progreso' }).click();
  await page.getByRole('button', { name: 'Zonas' }).click();
  await page.getByRole('button', { name: 'Ajustes' }).click();

  // Ajustes -> borrar todo (confirmModal, cancelamos para no perder el estado del test)
  await page.getByRole('button', { name: 'Borrar todos los datos' }).click();
  await expect(page.locator('#modalOverlay')).toBeVisible();
  await page.locator('#modalCancel').click();

  expect(dialogFired).toBe(false);
});
