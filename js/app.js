import { renderToday } from './ui/today.js';
import { renderSession } from './ui/session.js';
import { renderHistoryMonths, renderHistoryWeeks, renderHistoryDays, renderSessionDetail } from './ui/history.js';
import { renderProgress } from './ui/progress.js';
import { renderZones } from './ui/zones.js';
import { renderSettings } from './ui/settings.js';
import { renderBlockEditor } from './ui/block-editor.js';
import * as state from './state.js';
import * as storage from './storage.js';
import { todayStr, isWeekChangeDay, getBlockPosition, getWeekBannerMessage } from './schedule.js';
import { el } from './ui/components.js';

const root = document.getElementById('view');
const navButtons = document.querySelectorAll('.nav-btn');

function setActiveNav(section) {
  navButtons.forEach(btn => btn.classList.toggle('nav-btn--active', btn.dataset.section === section));
}

function navigate(hash) {
  if (location.hash === hash) route();
  else location.hash = hash;
}

function route() {
  const hash = location.hash || '#/today';
  const [, section, ...rest] = hash.split('/');
  const param = rest[0];

  window.scrollTo(0, 0);
  document.body.classList.remove('onboarding-active');

  switch (section) {
    case 'today':
      setActiveNav('today');
      renderToday(root, navigate);
      break;
    case 'session':
      setActiveNav('today');
      renderSession(root, param, navigate);
      break;
    case 'session-detail':
      setActiveNav('history');
      renderSessionDetail(root, param, navigate);
      break;
    case 'history':
      setActiveNav('history');
      if (rest.length === 0) renderHistoryMonths(root, navigate);
      else if (rest.length === 1) renderHistoryWeeks(root, navigate, rest[0]);
      else renderHistoryDays(root, navigate, rest[0], rest[1]);
      break;
    case 'progress':
      setActiveNav('progress');
      renderProgress(root, navigate);
      break;
    case 'zones':
      setActiveNav('zones');
      renderZones(root, navigate);
      break;
    case 'settings':
      setActiveNav('settings');
      renderSettings(root, navigate);
      break;
    case 'block-editor':
      setActiveNav('settings');
      renderBlockEditor(root, navigate, param);
      break;
    default:
      setActiveNav('today');
      renderToday(root, navigate);
  }
}

navButtons.forEach(btn => btn.addEventListener('click', () => navigate(`#/${btn.dataset.section}`)));
window.addEventListener('hashchange', route);
route();
maybeShowWeekChangeBanner();

// Aviso de que hoy arranca una semana nueva del bloque, solo el día exacto en
// que cambia y solo la primera vez que se abre la app ese día.
function maybeShowWeekChangeBanner() {
  const settings = state.getSettings();
  const dateStr = todayStr();
  if (!isWeekChangeDay(dateStr, settings.blockStart)) return;
  if (storage.loadWeekBannerShownDate() === dateStr) return;

  storage.saveWeekBannerShownDate(dateStr);
  const { weekInBlock } = getBlockPosition(dateStr, settings.blockStart);
  showWeekBanner(getWeekBannerMessage(weekInBlock));
}

function showWeekBanner(message) {
  const banner = el('div', { class: 'week-banner', role: 'status' }, [
    el('span', { text: message }),
    el('button', {
      class: 'week-banner-close',
      type: 'button',
      'aria-label': 'Cerrar aviso',
      text: '✕',
      onClick: (e) => e.currentTarget.closest('.week-banner').remove()
    })
  ]);
  document.body.appendChild(banner);
}

// Service worker con actualización automática: la versión nueva se activa
// sola (skipWaiting + clients.claim) y recargamos una vez cuando toma el
// control. El guardado es en cada interacción, así que la recarga no pierde
// nada. No recargamos en la primera visita (cuando el SW toma el control por
// primera vez), solo si la página ya venía controlada por uno anterior.
if ('serviceWorker' in navigator) {
  const hadControllerAtLoad = !!navigator.serviceWorker.controller;
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadControllerAtLoad || reloaded) return;
    reloaded = true;
    location.reload();
  });
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').then(reg => {
      reg.update().catch(() => {});
      setInterval(() => reg.update().catch(() => {}), 30 * 60 * 1000);
    }).catch(err => console.error('SW register failed', err));
  });
}
