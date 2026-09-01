import { test, expect } from '@playwright/test';
import { seedApp, atNoon, addDays } from './helpers.js';

const BLOCK_START = '2026-01-05';

test('el campo de ritmo inserta el ":" solo al teclear dígitos (teclado numérico sin esa tecla)', async ({ page }) => {
  await seedApp(page, { blockStart: BLOCK_START });
  await page.clock.install({ time: atNoon(addDays(BLOCK_START, 3)) }); // jueves, umbral
  await page.goto('/');
  await page.getByRole('button', { name: 'Registrar sesión' }).click();

  const pace = page.locator('.field:has-text("Ritmo medio") .text-input');
  await pace.pressSequentially('415');
  await expect(pace).toHaveValue('4:15');

  await pace.fill('');
  await pace.pressSequentially('5205');
  await expect(pace).toHaveValue('52:05');
});

test('si el ":" sí se puede escribir, se respeta tal cual', async ({ page }) => {
  await seedApp(page, { blockStart: BLOCK_START });
  await page.clock.install({ time: atNoon(addDays(BLOCK_START, 3)) });
  await page.goto('/');
  await page.getByRole('button', { name: 'Registrar sesión' }).click();

  const pace = page.locator('.field:has-text("Ritmo medio") .text-input');
  await pace.pressSequentially('4:15');
  await expect(pace).toHaveValue('4:15');

  await page.fill('.field:has-text("Distancia") .text-input', '5');
  await page.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.locator('.status')).toHaveText('Registrada');

  await page.getByRole('button', { name: 'Editar registro' }).click();
  await expect(page.locator('.field:has-text("Ritmo medio") .text-input')).toHaveValue('4:15');
});
