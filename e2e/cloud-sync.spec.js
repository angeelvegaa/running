// Copia en la nube (js/sync.js + js/ui/cloud-sync.js). Chromium y WebKit,
// portrait (los dos proyectos de playwright.config.js).
//
// Cubre:
//  1. Interruptor APAGADO (por defecto): CERO peticiones a Supabase /
//     esm.sh / Turnstile, aunque se navegue y se escriba en localStorage.
//  2. Abrir el asistente carga Turnstile (clave de TEST en localhost) y el
//     widget resuelve el reto solo — no toca Supabase todavía.
//  3. Flujo de registro completo: crea cuenta -> confirmación de email
//     pendiente -> la sync NO se activa sola (escenario Safari).
//  4. Flujo de inicio de sesión completo con cuenta ya confirmada: se
//     activa la sync y sube los datos locales.
//
// Supabase va simulado (override de window.fetch inyectado antes de cargar
// la app): auth y rest/sync_data responden en local, sin CORS ni red real.
// El SDK se sigue bajando de esm.sh y Turnstile de Cloudflare de verdad.

import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { seedApp } from './helpers.js';

const BLOCK_START = '2026-01-05';
const SYNC_HOSTS = /esm\.sh|supabase\.co|challenges\.cloudflare\.com/;
const SITE_KEY_TEST = '1x00000000000000000000AA';
const SITE_KEY_REAL = '0x4AAAAAAEroqMIQUWfcnssE';

const CLOUD_SYNC_SRC = readFileSync(join(__dirname, '../js/ui/cloud-sync.js'), 'utf8');

// Se inyecta con addInitScript ANTES de cargar la app: sustituye
// window.fetch para responder localmente a las llamadas al proyecto de
// Supabase (auth y rest/sync_data). El import() del SDK no pasa por fetch,
// así que esm.sh se sigue descargando de verdad.
function supaMockInit(cfg) {
  const known = new Map(cfg.known);       // "email password" -> userId
  const confirmed = new Set(cfg.confirmed);
  window.__supa = { signups: 0, pulls: 0, pushes: 0, tokenGrants: [] };
  const REAL = window.fetch.bind(window);

  function b64url(o) {
    return btoa(JSON.stringify(o)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  }
  function jwt(payload) {
    return b64url({ alg: 'HS256', typ: 'JWT' }) + '.' + b64url(payload) + '.sig';
  }
  function session(uid, email) {
    const now = Math.floor(Date.now() / 1000);
    return {
      access_token: jwt({ sub: uid, email, role: 'authenticated', aud: 'authenticated', iat: now, exp: now + 3600 }),
      token_type: 'bearer', expires_in: 3600, expires_at: now + 3600,
      refresh_token: 'rt-' + uid,
      user: { id: uid, email, aud: 'authenticated', role: 'authenticated' }
    };
  }

  window.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : (input && input.url) || '';
    if (!/supabase\.co\/(auth|rest)\/v1\//.test(url)) return REAL(input, init);
    const u = new URL(url, location.href);
    const method = (init.method || (input && input.method) || 'GET').toUpperCase();
    let body = {};
    try { const raw = init.body || (input && input.body); if (raw) body = JSON.parse(raw); } catch { /* noop */ }
    const R = (status, obj) => new Response(obj == null ? null : JSON.stringify(obj),
      { status, headers: { 'content-type': 'application/json' } });

    if (u.pathname.endsWith('/auth/v1/signup')) {
      window.__supa.signups++;
      // confirmación de email ON -> sin sesión, solo el objeto usuario
      return R(200, { id: 'u-' + body.email, email: body.email, confirmed_at: null, identities: [], aud: 'authenticated', role: 'authenticated' });
    }
    if (u.pathname.endsWith('/auth/v1/token')) {
      const grant = u.searchParams.get('grant_type');
      window.__supa.tokenGrants.push(grant);
      if (grant === 'password') {
        const k = body.email + ' ' + body.password;
        if (!known.has(k)) return R(400, { error: 'invalid_grant', error_description: 'Invalid login credentials' });
        if (!confirmed.has(k)) return R(400, { error: 'invalid_grant', error_description: 'Email not confirmed' });
        return R(200, session(known.get(k), body.email));
      }
      if (grant === 'refresh_token') return R(200, session('u-refresh', 'x@x'));
      return R(400, { error: 'unsupported_grant_type' });
    }
    if (u.pathname.endsWith('/auth/v1/user')) return R(200, { id: 'u-x', email: 'x@x', aud: 'authenticated', role: 'authenticated' });
    if (u.pathname.endsWith('/auth/v1/logout')) return R(204, null);
    if (u.pathname.endsWith('/rest/v1/sync_data')) {
      if (method === 'GET') { window.__supa.pulls++; return R(200, []); }
      if (method === 'POST') { window.__supa.pushes++; return R(201, []); }
      if (method === 'DELETE') return R(204, null);
    }
    return R(404, { error: 'unmocked ' + method + ' ' + u.pathname });
  };
}

// Abre Ajustes y el asistente de "Copia en la nube" con el modo elegido,
// dejando a la vista el formulario de email + contraseña.
async function openWizard(page, mode) {
  await page.goto('/#/settings');
  await page.getByRole('button', { name: 'Activar copia en la nube' }).click();
  const btn = mode === 'signin' ? 'Ya tengo cuenta — iniciar sesión' : 'Crear una cuenta nueva';
  await page.getByRole('button', { name: btn }).click();
  await page.locator('input[type="email"]').waitFor({ state: 'visible' });
}

// Espera a que el widget de Turnstile (clave de test) resuelva el reto y
// deje el token en el input oculto.
async function waitForCaptcha(page) {
  await page.waitForFunction(() => {
    const i = document.querySelector('.turnstile-slot input[name="cf-turnstile-response"]');
    return !!(i && i.value && i.value.length > 0);
  }, null, { timeout: 15000 });
}

test('la Site Key real del código es la correcta (0x4 + 6 A\'s, sin la "A" de más)', () => {
  expect(CLOUD_SYNC_SRC).toContain(`'${SITE_KEY_REAL}'`);
  expect(CLOUD_SYNC_SRC).not.toMatch(/0x4AAAAAAA/);
});

test('sync apagada: cero peticiones de red al navegar y escribir', async ({ page }) => {
  const netHits = [];
  page.on('request', (r) => { if (SYNC_HOSTS.test(r.url())) netHits.push(r.url()); });

  await seedApp(page, { blockStart: BLOCK_START });
  await page.goto('/');
  await expect(page.locator('.app-title')).toHaveText('Running');

  for (const section of ['plan', 'history', 'progress', 'zones', 'settings']) {
    await page.goto(`/#/${section}`);
    await page.waitForTimeout(150);
  }

  // Escritura real en una clave sincronizable (run.settings): mueve un día.
  await page.goto('/#/settings');
  const select = page.locator('.settings-select').first();
  await select.selectOption({ index: 3 });
  await page.waitForTimeout(500);

  await page.waitForLoadState('networkidle').catch(() => {});
  expect(netHits, netHits.join(' | ')).toHaveLength(0);

  // La tarjeta está y deja claro que es opcional / local por defecto.
  const cardText = await page.locator('#cloudSyncCard').innerText();
  expect(cardText).toMatch(/opcional/i);
  expect(cardText).toMatch(/local/i);
});

test('abrir el asistente carga Turnstile (clave de test) y resuelve, sin tocar Supabase', async ({ page }) => {
  const netHits = [];
  page.on('request', (r) => { if (SYNC_HOSTS.test(r.url())) netHits.push(r.url()); });

  await seedApp(page, { blockStart: BLOCK_START });
  await page.addInitScript(supaMockInit, { known: [], confirmed: [] });
  await page.goto('/');

  await page.goto('/#/settings');
  await page.getByRole('button', { name: 'Activar copia en la nube' }).click();

  // El asistente arranca pidiendo elegir camino: crear / iniciar sesión.
  await expect(page.getByRole('button', { name: 'Crear una cuenta nueva' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ya tengo cuenta — iniciar sesión' })).toBeVisible();

  await page.getByRole('button', { name: 'Crear una cuenta nueva' }).click();
  await expect(page.locator('input[type="email"]')).toBeVisible();
  await expect(page.locator('input[type="password"]')).toBeVisible();

  await waitForCaptcha(page);

  const tsHits = netHits.filter((u) => /turnstile/.test(u)).join(' ');
  expect(tsHits).toContain(SITE_KEY_TEST);
  expect(tsHits).not.toContain(SITE_KEY_REAL);
  expect(netHits.filter((u) => /supabase\.co/.test(u))).toHaveLength(0);
});

test('flujo de registro: crea cuenta, queda pendiente de confirmar email, la sync NO se activa', async ({ page }) => {
  const email = `run-e2e-${Date.now()}@example.com`;
  const password = 'clave-de-prueba-123';

  await seedApp(page, { blockStart: BLOCK_START });
  await page.addInitScript(supaMockInit, { known: [], confirmed: [] });
  await page.goto('/');

  await openWizard(page, 'signup');
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await waitForCaptcha(page);
  await page.getByRole('button', { name: 'Crear cuenta', exact: true }).click();

  await expect(page.locator('#cloudSyncCard')).toContainText(/email de confirmaci/i);

  expect(await page.evaluate(() => localStorage.getItem('run.sync.enabled'))).not.toBe('true');
  const hasSession = await page.evaluate(() => Object.keys(localStorage).some((k) => /sb-.*-auth-token/.test(k)));
  expect(hasSession).toBe(false);
  expect(await page.evaluate(() => window.__supa.signups)).toBe(1);
});

test('flujo de inicio de sesión con cuenta ya confirmada: activa la sync y sube los datos locales', async ({ page }) => {
  const email = `run-e2e-${Date.now()}@example.com`;
  const password = 'clave-de-prueba-123';
  const acctKey = `${email} ${password}`;

  await seedApp(page, { blockStart: BLOCK_START });
  await page.addInitScript(supaMockInit, { known: [[acctKey, 'u-1']], confirmed: [acctKey] });
  await page.goto('/');

  // arranca sin sesión, sync apagada
  expect(await page.evaluate(() => localStorage.getItem('run.sync.enabled'))).not.toBe('true');

  await openWizard(page, 'signin');
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await waitForCaptcha(page);
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click();

  // login OK -> paso de clave de cifrado: genera una nueva y termina
  await page.getByRole('button', { name: /primera vez que activo/i }).click({ timeout: 15000 });
  await page.getByRole('button', { name: /Ya lo he guardado/i }).click();

  await expect(page.locator('#cloudSyncCard')).toContainText(/Sincronizando con/i, { timeout: 15000 });

  expect(await page.evaluate(() => localStorage.getItem('run.sync.enabled'))).toBe('true');
  expect(await page.evaluate(() => window.__supa.tokenGrants)).toContain('password');
  expect(await page.evaluate(() => window.__supa.pushes)).toBeGreaterThanOrEqual(1);
  expect(await page.evaluate(() => localStorage.getItem('run.sync.key'))).toBeTruthy();

  // el código de recuperación se puede volver a ver
  await page.getByRole('button', { name: 'Ver código de recuperación' }).click();
  expect((await page.locator('.recovery-code').innerText()).trim().length).toBeGreaterThan(20);
});
