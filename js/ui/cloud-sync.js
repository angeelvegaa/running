// UI de "Copia en la nube" dentro de Ajustes: la tarjeta (interruptor /
// ver código / desactivar) y el asistente de activación de 2-3 pasos
// (elegir modo → email+contraseña → clave de cifrado → listo).
//
// Nada de esto hace red hasta que la persona pulsa "Activar": el interruptor
// está apagado por defecto y js/sync.js no importa el SDK de Supabase hasta
// que se le llama.

import { el, clear, toast } from './components.js';
import * as sync from '../sync.js';

// Site keys de Turnstile (públicas, no secretas — seguro exponerlas):
// - REAL: la del dominio angeelvegaa.github.io (0x4 + 6 A's).
// - TEST: clave de test oficial de Cloudflare ("siempre pasa"). Las claves
//   de producción rechazan resolver el reto en localhost / navegador de
//   test (Playwright), así que en local se usa esta.
export const TURNSTILE_SITE_KEY_REAL = '0x4AAAAAAEroqMIQUWfcnssE';
const TURNSTILE_SITE_KEY_TEST = '1x00000000000000000000AA';
const TURNSTILE_SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js';

// Solo estos hostnames EXACTOS (comparación por igualdad, nunca por
// prefijo): son los únicos con los que se sirve la app en local. GitHub
// Pages nunca sirve la app real bajo "localhost"/"127.0.0.1" (loopback, no
// dominios enrutables), así que ningún visitante real cae aquí.
const LOCAL_TEST_HOSTNAMES = new Set(['localhost', '127.0.0.1']);
export function resolveTurnstileSiteKey(hostname) {
  return LOCAL_TEST_HOSTNAMES.has(hostname) ? TURNSTILE_SITE_KEY_TEST : TURNSTILE_SITE_KEY_REAL;
}
const TURNSTILE_SITE_KEY = resolveTurnstileSiteKey(window.location.hostname);

const TURNSTILE_LOAD_ERROR_MSG = 'No se pudo cargar la verificación anti-bot. Revisa tu conexión (o si bloqueas contenido de challenges.cloudflare.com) y recarga la página.';
const TURNSTILE_LOAD_TIMEOUT_MS = 12000;

// Estado efímero de la tarjeta: se reinicia cuando se vuelve a entrar en
// Ajustes (la vista se reconstruye entera en cada navegación).
let wizardOpen = false;
let revealCode = false;
let confirmDisable = false;

let turnstileScriptPromise = null;
function loadTurnstileScript() {
  if (window.turnstile) return Promise.resolve();
  if (!turnstileScriptPromise) {
    turnstileScriptPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = TURNSTILE_SCRIPT_URL;
      s.async = true;
      s.defer = true;
      const timer = setTimeout(
        () => reject(new Error('La verificación anti-bot tardó demasiado en cargar.')),
        TURNSTILE_LOAD_TIMEOUT_MS
      );
      s.onload = () => { clearTimeout(timer); resolve(); };
      s.onerror = () => { clearTimeout(timer); reject(new Error('No se pudo cargar la verificación anti-bot.')); };
      document.head.appendChild(s);
    });
    turnstileScriptPromise.catch(() => { turnstileScriptPromise = null; });
  }
  return turnstileScriptPromise;
}

// container: nodo donde vive la tarjeta. onMerged: callback si la primera
// fusión trae cambios (para refrescar la pantalla).
export function renderCloudSync(container, { onMerged } = {}) {
  clear(container);
  container.appendChild(el('h4', { text: 'Copia en la nube' }));
  const status = sync.getStatus();

  if (!status.enabled) {
    if (!wizardOpen) {
      container.appendChild(el('p', {
        class: 'muted',
        text: 'Opcional y apagada por defecto: si no la activas, la app sigue 100% local, sin ninguna conexión ni cuenta. Al activarla, tus datos se cifran en este dispositivo y se guardan en la nube para poder recuperarlos en otro móvil.'
      }));
      container.appendChild(el('button', {
        class: 'btn btn--secondary',
        text: 'Activar copia en la nube',
        onClick: () => { wizardOpen = true; renderCloudSync(container, { onMerged }); }
      }));
      return;
    }
    mountWizard(container, {
      initialEmail: status.email || '',
      onCancel: () => { wizardOpen = false; renderCloudSync(container, { onMerged }); },
      onDone: () => { wizardOpen = false; toast('Copia en la nube activada'); renderCloudSync(container, { onMerged }); },
      onMerged
    });
    return;
  }

  container.appendChild(el('p', {
    class: 'muted',
    text: `Sincronizando con ${status.email || 'tu cuenta'}. Cada cambio se cifra y se sube; al abrir la app se baja y se fusiona (último cambio gana).`
  }));

  container.appendChild(el('button', {
    class: 'btn btn--secondary',
    text: revealCode ? 'Ocultar código de recuperación' : 'Ver código de recuperación',
    onClick: () => { revealCode = !revealCode; renderCloudSync(container, { onMerged }); }
  }));
  if (revealCode) {
    container.appendChild(el('p', {
      class: 'muted',
      text: 'Guárdalo en un sitio seguro (Notas, gestor de contraseñas). Es la única forma de recuperar tus datos ya sincronizados en un dispositivo nuevo — nadie puede recuperarlo por ti.'
    }));
    container.appendChild(el('div', { class: 'recovery-code', text: sync.getRecoveryCode() || '' }));
  }

  if (!confirmDisable) {
    container.appendChild(el('button', {
      class: 'btn btn--danger',
      text: 'Desactivar en este dispositivo',
      onClick: () => { confirmDisable = true; renderCloudSync(container, { onMerged }); }
    }));
    return;
  }
  container.appendChild(el('p', {
    class: 'muted',
    text: 'Este dispositivo deja de sincronizar y se cierra la sesión. Tus datos siguen tal cual aquí y en la nube.'
  }));
  container.appendChild(el('button', {
    class: 'btn btn--danger',
    text: 'Sí, desactivar',
    onClick: async () => {
      await sync.disable();
      confirmDisable = false; revealCode = false;
      toast('Copia en la nube desactivada');
      renderCloudSync(container, { onMerged });
    }
  }));
  container.appendChild(el('button', {
    class: 'btn btn--secondary',
    text: 'Cancelar',
    onClick: () => { confirmDisable = false; renderCloudSync(container, { onMerged }); }
  }));
}

// Asistente autocontenido. El widget de Turnstile vive en un nodo fijo
// (turnstileSlot) que NO se borra en cada render interno, para que escribir
// en email/contraseña no lo reinicie.
function mountWizard(container, { initialEmail = '', onCancel, onDone, onMerged }) {
  let step = 'mode-choice'; // 'mode-choice' -> 'auth' -> 'key-choice' -> 'show-code' -> 'ready'
  let mode = null;          // 'signup' | 'signin'
  let email = initialEmail;
  let password = '';
  let busy = false;
  let error = null;
  let generatedCode = null;
  let captchaToken = null;
  let widgetId = null;
  let turnstileStarted = false;
  let offerSwitchToSignin = false;

  const topWrap = el('div', {});
  const turnstileSlot = el('div', { class: 'turnstile-slot' });
  const bottomWrap = el('div', {});
  container.append(topWrap, turnstileSlot, bottomWrap);

  render();

  function ensureTurnstile() {
    if (turnstileStarted) return;
    turnstileStarted = true;
    mountTurnstile();
  }

  async function mountTurnstile() {
    try {
      await loadTurnstileScript();
      if (widgetId !== null) return;
      if (!window.turnstile) throw new Error('El script de Turnstile cargó pero window.turnstile no existe.');
      widgetId = window.turnstile.render(turnstileSlot, {
        sitekey: TURNSTILE_SITE_KEY,
        appearance: 'interaction-only',
        callback: (t) => {
          captchaToken = t;
          if (error === TURNSTILE_LOAD_ERROR_MSG) { error = null; render(); }
        },
        'expired-callback': () => { captchaToken = null; },
        'error-callback': (code) => {
          captchaToken = null;
          console.error('turnstile: error-callback, código', code, '— sitekey:', TURNSTILE_SITE_KEY, '— hostname:', window.location.hostname);
          error = `No se pudo verificar que no eres un bot (código ${code}). ` +
            'Revisa tu conexión o desactiva bloqueadores de contenido para challenges.cloudflare.com, y vuelve a intentarlo.';
          render();
        }
      });
    } catch (err) {
      console.error('turnstile: fallo al cargar/montar', err, '— sitekey:', TURNSTILE_SITE_KEY, '— hostname:', window.location.hostname);
      error = TURNSTILE_LOAD_ERROR_MSG;
      render();
    }
  }
  function resetTurnstile() {
    captchaToken = null;
    if (widgetId !== null && window.turnstile) {
      try { window.turnstile.reset(widgetId); } catch { /* noop */ }
    }
  }
  function destroyTurnstile() {
    if (widgetId !== null && window.turnstile) {
      try { window.turnstile.remove(widgetId); } catch { /* noop */ }
      widgetId = null;
    }
  }

  function render() {
    turnstileSlot.style.display = step === 'auth' ? '' : 'none';
    clear(topWrap);
    clear(bottomWrap);
    const { top, bottom } = build();
    topWrap.appendChild(top);
    bottomWrap.appendChild(bottom);
  }

  function build() {
    const top = el('div', {});
    const bottom = el('div', {});
    if (error) top.appendChild(el('p', { class: 'cloud-warn', text: `⚠ ${error}` }));

    if (step === 'mode-choice') {
      top.appendChild(el('p', {
        class: 'muted',
        text: 'Para sincronizar necesitas una cuenta (solo email y contraseña, para identificar tus datos cifrados).'
      }));
      top.appendChild(el('p', {
        class: 'muted',
        text: 'El email de confirmación se abre en Safari, no en la app instalada. Tras confirmar ahí, vuelve a esta app y usa "Ya tengo cuenta — iniciar sesión".'
      }));
      const goAuth = (m) => { mode = m; step = 'auth'; error = null; render(); ensureTurnstile(); };
      bottom.appendChild(el('button', { class: 'btn btn--secondary', text: 'Crear una cuenta nueva', onClick: () => goAuth('signup') }));
      bottom.appendChild(el('button', { class: 'btn btn--secondary', text: 'Ya tengo cuenta — iniciar sesión', onClick: () => goAuth('signin') }));
      bottom.appendChild(el('button', { class: 'btn btn--ghost', text: 'Cancelar', onClick: () => { destroyTurnstile(); onCancel(); } }));
      return { top, bottom };
    }

    if (step === 'auth') {
      const signin = mode === 'signin';
      top.appendChild(el('p', { class: 'muted', text: signin ? 'Inicia sesión con tu cuenta.' : 'Crea una cuenta nueva.' }));
      const emailInput = el('input', { type: 'email', class: 'text-input', placeholder: 'tu@email.com', value: email, autocomplete: 'email', oninput: (e) => { email = e.target.value; } });
      const passwordInput = el('input', {
        type: 'password', class: 'text-input',
        placeholder: signin ? 'Contraseña' : 'Contraseña (mín. 6 caracteres)',
        value: password,
        autocomplete: signin ? 'current-password' : 'new-password',
        oninput: (e) => { password = e.target.value; }
      });
      top.append(emailInput, passwordInput);

      const runAuth = async () => {
        if (busy) return;
        const em = email.trim(), pw = password;
        if (!em || !pw) { error = 'Rellena email y contraseña.'; render(); return; }
        if (!captchaToken) { error = 'Completa la verificación anti-bot de arriba antes de continuar.'; render(); return; }
        busy = true; error = null; render();
        try {
          const fn = signin ? sync.signIn : sync.signUp;
          const result = await fn(em, pw, captchaToken);
          busy = false;
          if (result.confirmEmailRequired) {
            error = 'Cuenta creada. Abre el enlace del email de confirmación (se abrirá en Safari) y luego vuelve aquí y elige "Ya tengo cuenta — iniciar sesión".';
            resetTurnstile(); render(); return;
          }
          email = result.email;
          step = sync.hasEncryptionKey() ? 'ready' : 'key-choice';
          render();
        } catch (err) {
          busy = false;
          error = translateAuthError(err);
          offerSwitchToSignin = !signin && /User already registered/i.test((err && err.message) || '');
          resetTurnstile(); // el token de Turnstile es de un solo uso
          render();
        }
      };

      bottom.appendChild(el('button', {
        class: 'btn btn--primary', text: busy ? '…' : (signin ? 'Iniciar sesión' : 'Crear cuenta'),
        onClick: runAuth
      }));
      if (offerSwitchToSignin) {
        bottom.appendChild(el('button', {
          class: 'btn btn--secondary', text: 'Iniciar sesión con esa cuenta',
          onClick: () => { mode = 'signin'; error = null; offerSwitchToSignin = false; resetTurnstile(); render(); }
        }));
      }
      bottom.appendChild(el('button', { class: 'btn btn--ghost', text: '‹ Cambiar', onClick: () => { step = 'mode-choice'; error = null; offerSwitchToSignin = false; render(); } }));
      bottom.appendChild(el('button', { class: 'btn btn--ghost', text: 'Cancelar', onClick: () => { destroyTurnstile(); onCancel(); } }));
      return { top, bottom };
    }

    if (step === 'key-choice') {
      top.appendChild(el('p', {
        class: 'muted',
        text: 'Falta la clave de cifrado: tus datos se cifran en este dispositivo antes de subirlos; nadie más (ni el servidor) puede leerlos sin ella.'
      }));
      top.appendChild(el('button', {
        class: 'btn btn--secondary',
        text: 'Es la primera vez que activo esto (crear clave nueva)',
        onClick: async () => { generatedCode = await sync.generateRecoveryCode(); step = 'show-code'; render(); }
      }));
      top.appendChild(el('p', { class: 'muted', text: 'O, si ya activaste la sincronización antes en otro móvil, pega aquí ese código de recuperación:' }));
      const codeInput = el('textarea', { class: 'text-input', rows: 3, placeholder: 'Código de recuperación de otro dispositivo' });
      top.appendChild(codeInput);
      top.appendChild(el('button', {
        class: 'btn btn--secondary', text: 'Usar este código',
        onClick: async () => {
          try { sync.adoptRecoveryCode(codeInput.value); error = null; await finish(); }
          catch (err) { error = err.message; render(); }
        }
      }));
      top.appendChild(el('button', { class: 'btn btn--ghost', text: 'Cancelar', onClick: () => { destroyTurnstile(); onCancel(); } }));
      return { top, bottom };
    }

    if (step === 'show-code') {
      top.appendChild(el('p', {
        class: 'cloud-warn',
        text: 'Guarda este código de recuperación en un sitio seguro (Notas, gestor de contraseñas) AHORA. Es la única forma de recuperar tus datos si borras los datos del navegador o cambias de móvil — nadie puede recuperarlo por ti.'
      }));
      top.appendChild(el('div', { class: 'recovery-code', text: generatedCode }));
      top.appendChild(el('button', { class: 'btn btn--primary', text: 'Ya lo he guardado, continuar', onClick: finish }));
      return { top, bottom };
    }

    // step === 'ready'
    top.appendChild(el('p', { class: 'muted', text: 'Este dispositivo ya tiene una clave de cifrado configurada.' }));
    top.appendChild(el('button', { class: 'btn btn--primary', text: 'Continuar', onClick: finish }));
    return { top, bottom };
  }

  async function finish() {
    try {
      const changed = await sync.finishActivation(email);
      destroyTurnstile();
      if (changed && onMerged) onMerged();
      onDone();
    } catch (err) {
      error = err.message;
      render();
    }
  }
}

function translateAuthError(err) {
  const msg = (err && err.message) || '';
  if (/Email not confirmed/i.test(msg)) return 'Tu email aún no está confirmado. Abre el enlace del correo de confirmación (en Safari) y vuelve a intentarlo.';
  if (/Invalid login credentials/i.test(msg)) return 'Email o contraseña incorrectos (o el email aún no está confirmado).';
  if (/User already registered/i.test(msg)) return 'Ya existe una cuenta con ese email. Inicia sesión en vez de crearla.';
  if (/Password should be at least/i.test(msg)) return 'La contraseña debe tener al menos 6 caracteres.';
  return msg || 'Ha ocurrido un error. Inténtalo de nuevo.';
}
