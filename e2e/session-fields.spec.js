import { test, expect } from '@playwright/test';
import { seedApp, atNoon, addDays } from './helpers.js';

const BLOCK_START = '2026-01-05';

async function openForm(page, dayOffset) {
  await page.clock.install({ time: atNoon(addDays(BLOCK_START, dayOffset)) });
  await page.goto('/');
  await page.getByRole('button', { name: 'Registrar sesión' }).click();
}

test('el formulario de SERIES pide reps/metros/ritmo-de-reps y NO distancia total', async ({ page }) => {
  await seedApp(page, { blockStart: BLOCK_START });
  await openForm(page, 1); // martes, series

  await expect(page.locator('.field:has-text("Repeticiones hechas")')).toHaveCount(1);
  await expect(page.locator('.field:has-text("Metros por repetición")')).toHaveCount(1);
  await expect(page.locator('.field:has-text("Ritmo medio de las repeticiones")')).toHaveCount(1);
  await expect(page.locator('.field:has-text("Distancia")')).toHaveCount(0);
  // el "Ritmo medio" genérico (de sesión) no aparece en series
  await expect(page.getByText('Ritmo medio (m:ss/km)', { exact: true })).toHaveCount(0);
});

for (const [name, offset] of [['suave', 0], ['umbral', 3], ['larga', 4]]) {
  test(`el formulario de ${name} pide distancia y ritmo medio y NO reps/metros`, async ({ page }) => {
    await seedApp(page, { blockStart: BLOCK_START });
    await openForm(page, offset);

    await expect(page.locator('.field:has-text("Distancia")')).toHaveCount(1);
    await expect(page.getByText('Ritmo medio (m:ss/km)', { exact: true })).toHaveCount(1);
    await expect(page.locator('.field:has-text("Repeticiones hechas")')).toHaveCount(0);
    await expect(page.locator('.field:has-text("Metros por repetición")')).toHaveCount(0);
  });
}

test('FC media/máx, sensación y nota están en todos los tipos', async ({ page }) => {
  await seedApp(page, { blockStart: BLOCK_START });
  await openForm(page, 1); // series
  for (const label of ['FC media', 'FC máxima', 'Sensación', 'Nota']) {
    await expect(page.locator(`.field:has-text("${label}")`)).toHaveCount(1);
  }
});
