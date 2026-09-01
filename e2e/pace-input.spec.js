import { test, expect } from '@playwright/test';
import { seedApp, atNoon, addDays } from './helpers.js';

const BLOCK_START = '2026-01-05';

async function openUmbralForm(page) {
  await seedApp(page, { blockStart: BLOCK_START });
  await page.clock.install({ time: atNoon(addDays(BLOCK_START, 3)) }); // jueves, umbral
  await page.goto('/');
  await page.getByRole('button', { name: 'Registrar sesión' }).click();
  const field = page.locator('.field:has-text("Ritmo medio")');
  return { min: field.locator('.pace-part').nth(0), sec: field.locator('.pace-part').nth(1), field };
}

test('el ritmo son dos casillas numéricas con un ":" fijo entre medias, sin campo de texto libre', async ({ page }) => {
  const { field } = await openUmbralForm(page);
  await expect(field.locator('.pace-part')).toHaveCount(2);
  await expect(field.locator('.pace-colon')).toHaveText(':');
  await expect(field.locator('.pace-part').nth(0)).toHaveAttribute('inputmode', 'numeric');
  await expect(field.locator('.pace-part').nth(1)).toHaveAttribute('inputmode', 'numeric');
  // no es un input numérico que descarte el ":" a nivel de navegador
  await expect(field.locator('.pace-part').nth(0)).toHaveAttribute('type', 'text');
});

test('teclear 2 dígitos en minutos salta el foco solo a segundos', async ({ page }) => {
  const { min, sec } = await openUmbralForm(page);
  await min.click();
  await page.keyboard.type('12');
  await expect(sec).toBeFocused();
  await page.keyboard.type('30');
  await expect(min).toHaveValue('12');
  await expect(sec).toHaveValue('30');
});

test('minutos de un solo dígito no salta: se rellena segundos a mano', async ({ page }) => {
  const { min, sec } = await openUmbralForm(page);
  await min.click();
  await page.keyboard.type('4');
  await expect(min).toBeFocused(); // no ha saltado
  await sec.click();
  await page.keyboard.type('15');
  await expect(min).toHaveValue('4');
  await expect(sec).toHaveValue('15');
});

test('retroceso con segundos vacío devuelve el foco a minutos', async ({ page }) => {
  const { min, sec } = await openUmbralForm(page);
  await min.click();
  await page.keyboard.type('5');
  await sec.click();
  await page.keyboard.type('8');
  await page.keyboard.press('Backspace'); // borra el 8 -> segundos vacío
  await expect(sec).toHaveValue('');
  await page.keyboard.press('Backspace'); // segundos ya vacío -> salta a minutos
  await expect(min).toBeFocused();
  await page.keyboard.press('Backspace'); // borra el 5 en minutos
  await expect(min).toHaveValue('');
});

test('los segundos se limitan a 59 y descartan lo que no sea dígito', async ({ page }) => {
  const { min, sec } = await openUmbralForm(page);
  await min.fill('5');
  await sec.fill('75');
  await expect(sec).toHaveValue('59');
  await sec.fill('a3b');
  await expect(sec).toHaveValue('3');
});

test('el ritmo se guarda como m:ss y se relee en las dos casillas', async ({ page }) => {
  const { min, sec } = await openUmbralForm(page);
  await min.fill('4');
  await sec.fill('5'); // un solo dígito
  await page.locator('.field:has-text("Distancia") .text-input').fill('4');
  await page.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.locator('.status')).toHaveText('Registrada');

  await page.getByRole('button', { name: 'Editar registro' }).click();
  const field = page.locator('.field:has-text("Ritmo medio")');
  await expect(field.locator('.pace-part').nth(0)).toHaveValue('4');
  await expect(field.locator('.pace-part').nth(1)).toHaveValue('05'); // normalizado a 2 dígitos

  // y en el detalle del historial aparece como 4:05/km
  await page.getByRole('button', { name: 'Historial' }).click();
  await page.getByRole('button', { name: /Enero 2026/ }).click();
  await page.getByRole('button', { name: /Semana 1 de 4/ }).click();
  await page.getByRole('button', { name: /Umbral/ }).click();
  await expect(page.getByText('Ritmo medio: 4:05/km')).toBeVisible();
});

test('el editor de bloque usa el mismo control de dos casillas para cada extremo del rango', async ({ page }) => {
  await seedApp(page, { blockStart: BLOCK_START });
  await page.goto('/#/settings');
  await page.getByRole('button', { name: 'Editar bloque 1' }).click();

  const umbralWeek1 = page.locator('.editor-target-row', { hasText: 'Umbral' }).first();
  const parts = umbralWeek1.locator('.pace-part');
  await expect(parts).toHaveCount(4); // [m:ss] a [m:ss]
  await expect(parts.nth(0)).toHaveValue('5');
  await expect(parts.nth(1)).toHaveValue('05');
  await expect(parts.nth(2)).toHaveValue('5');
  await expect(parts.nth(3)).toHaveValue('15');

  await parts.nth(1).fill('00');
  await page.getByRole('button', { name: 'Guardar bloque' }).click();
  await page.locator('#modalOk').click();
  await page.getByRole('button', { name: 'Editar bloque 1' }).click();
  await expect(page.locator('.editor-target-row', { hasText: 'Umbral' }).first().locator('.pace-part').nth(1)).toHaveValue('00');
});
