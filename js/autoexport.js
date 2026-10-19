// Vista de SOLO LECTURA en texto plano, pensada para una automatización
// externa (un Atajo de iPhone que la lee y se la pasa a otra IA), no para una
// persona. Se activa SOLO con ?autoexport=1 en la URL — el interruptor está en
// index.html; sin ese parámetro este módulo ni se carga y la app arranca igual
// que siempre.
//
// Regla de oro: SOLO LECTURA.
// - No escribe en localStorage (a diferencia de state.js, que siembra el
//   bloque 1 si falta; aquí se lee tal cual y punto).
// - No toca la copia en la nube ni el cifrado: nunca importa js/sync.js.
// - No hace ninguna llamada de red: es una transformación local de lo que ya
//   hay en el dispositivo.
//
// Resume las últimas ~5 semanas (suficiente para un resumen mensual), no el
// histórico entero.

import * as storage from './storage.js';
import { nextMonday, todayStr, getBlockPosition } from './schedule.js';
import { SESSION_TYPES, activeSessionTypes, sessionType, WEEKDAYS_3, SEED_BLOCK_1, WEEK_LABELS } from './plan.js';
import { formatTarget } from './format.js';
import { secondsToPace } from './pace.js';
import { DEFAULT_HR_MAX, DEFAULT_HR_REST, DEFAULT_ZONES, karvonenZones } from './zones.js';
import { getSuggestions } from './suggestions.js';

const WINDOW_DAYS = 35; // ~5 semanas
const DAY_MS = 24 * 60 * 60 * 1000;
const EFFORT_LABEL = { facil: 'fácil', controlado: 'controlado', muy_duro: 'muy duro' };

// Texto del resumen, listo para compartir o volcar en el <pre>. La PRIMERA
// línea es solo la fecha de hoy en AAAA-MM-DD, para identificar de un vistazo
// (o desde una automatización) cuándo se generó este resumen concreto. Lo usan
// tanto ?autoexport=1 como el botón "Compartir resumen" de Ajustes: mismo texto.
export function buildReportText(now = new Date()) {
  try {
    return `${todayStr(now)}\n${buildReport(now)}`;
  } catch (err) {
    return `RUNNING AUTOEXPORT ERROR: ${err && err.message ? err.message : String(err)}`;
  }
}

export function renderAutoExport() {
  const text = buildReportText(new Date());
  // Fuera la hoja de estilos de la app: la salida es texto pelado dentro de un
  // <pre>, sin estilos propios ni JavaScript interactivo.
  document.head.querySelectorAll('link[rel="stylesheet"]').forEach(l => l.remove());
  document.title = 'Running · autoexport';
  const pre = document.createElement('pre');
  pre.id = 'autoexport';
  pre.textContent = text;
  document.body.replaceChildren(pre);
}

// --- lectura (sin efectos) ---

function readSettings() {
  const loaded = storage.loadSettings();
  const base = {
    blockStart: nextMonday(),
    suaveEnabled: false,
    weekdays: { ...WEEKDAYS_3 },
    hrMax: DEFAULT_HR_MAX,
    hrRest: DEFAULT_HR_REST,
    zones: DEFAULT_ZONES
  };
  if (!loaded) return base;
  // Mismo criterio que state.js, pero sin escribir: ajustes antiguos sin
  // suaveEnabled cuentan como Suave apagada.
  return {
    ...base,
    ...loaded,
    suaveEnabled: !!loaded.suaveEnabled,
    weekdays: { ...base.weekdays, ...(loaded.weekdays || {}) },
    zones: (loaded.zones && loaded.zones.length) ? loaded.zones : base.zones
  };
}

function readBlocks() {
  const loaded = storage.loadBlocks();
  if (loaded && loaded.blocks && Object.keys(loaded.blocks).length) return loaded.blocks;
  return { 1: SEED_BLOCK_1 };
}

// Igual que state.getBlock: si el bloque pedido aún no está configurado, cae al
// más alto que sí lo esté (así "esta semana" siempre tiene objetivos).
function blockFor(blocks, n) {
  const nums = Object.keys(blocks).map(Number).sort((a, b) => a - b);
  const highest = nums[nums.length - 1];
  return blocks[n] || blocks[highest] || SEED_BLOCK_1;
}

function recordedSessions() {
  const data = storage.loadSessions();
  const map = (data && data.sessions) || {};
  return Object.values(map)
    .filter(s => s.status === 'completed' || s.status === 'skipped')
    .sort((a, b) => a.date.localeCompare(b.date));
}

// --- formato ---

function mean(arr) {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function fmtKm(v) {
  const r = Math.round(v * 10) / 10;
  return `${Number.isInteger(r) ? String(r) : String(r).replace('.', ',')} km`;
}

function summarizeType(type, sessions) {
  const parts = [`${sessions.length} ${sessions.length === 1 ? 'sesión' : 'sesiones'}`];
  if (type.metric === 'reps') {
    const reps = sessions.reduce((a, s) => a + (s.repsDone || 0), 0);
    if (reps) parts.push(`${reps} repeticiones`);
    const paces = sessions.map(s => s.repPaceSecPerKm).filter(p => p != null);
    if (paces.length) parts.push(`ritmo rep medio ${secondsToPace(mean(paces))}/km`);
  } else {
    const km = sessions.reduce((a, s) => a + (s.distanceKm || 0), 0);
    if (km) parts.push(fmtKm(km));
    // La montaña no entra en el ritmo medio: el terreno lo hace incomparable.
    const paces = sessions.filter(s => s.terrain !== 'montana').map(s => s.paceSecPerKm).filter(p => p != null);
    if (paces.length) parts.push(`ritmo medio ${secondsToPace(mean(paces))}/km`);
  }
  const hrs = sessions.map(s => s.hrAvg).filter(h => h != null);
  if (hrs.length) parts.push(`FC media ${Math.round(mean(hrs))}`);
  return parts.join(' · ');
}

function sessionLine(s) {
  const type = sessionType(s.type);
  const name = type ? type.name : s.type;
  const head = `${s.date} · ${name} · B${s.block}S${s.weekInBlock}`;
  if (s.status === 'skipped') {
    return `${head} · NO REALIZADA${s.reason ? ` (${s.reason})` : ''}`;
  }
  const bits = [];
  if (s.terrain === 'montana') bits.push('montaña');
  if (s.type === 'series') {
    if (s.repsDone != null) bits.push(`${s.repsDone}×${s.repMeters ?? '?'}m`);
    if (s.repPaceSecPerKm != null) bits.push(`rep ${secondsToPace(s.repPaceSecPerKm)}/km`);
    if (s.paceSecPerKm != null) bits.push(`media ${secondsToPace(s.paceSecPerKm)}/km`);
  } else {
    if (s.distanceKm != null) bits.push(fmtKm(s.distanceKm));
    if (s.paceSecPerKm != null) bits.push(`${secondsToPace(s.paceSecPerKm)}/km`);
  }
  if (s.hrAvg != null) bits.push(`FC ${s.hrAvg}${s.hrMax != null ? `/${s.hrMax}` : ''}`);
  if (s.effort) bits.push(EFFORT_LABEL[s.effort] || s.effort);
  if (s.note) bits.push(`"${String(s.note).replace(/\s+/g, ' ').trim()}"`);
  return `${head}${bits.length ? ` · ${bits.join(' · ')}` : ''}`;
}

// --- informe ---

function buildReport(now) {
  const today = todayStr(now);
  const windowStart = todayStr(new Date(now.getTime() - WINDOW_DAYS * DAY_MS));
  const settings = readSettings();
  const blocks = readBlocks();
  const pos = getBlockPosition(today, settings.blockStart);
  const block = blockFor(blocks, pos.block);
  const weekTargets = (block.weeks && block.weeks[pos.weekInBlock]) || {};

  const all = recordedSessions();
  const windowed = all.filter(s => s.date >= windowStart);

  const L = [];
  L.push('RESUMEN MENSUAL DE ENTRENAMIENTO DE CARRERA');
  L.push(`app: running | generado: ${today} | datos locales de este dispositivo (solo lectura)`);
  L.push(`ventana: ${windowStart} a ${today} (${WINDOW_DAYS} días, ~5 semanas)`);
  L.push('');

  L.push('== PLAN ACTUAL ==');
  L.push(`bloque ${pos.block}, semana ${pos.weekInBlock} de 4 (${WEEK_LABELS[pos.weekInBlock] || '—'})`);
  L.push(`inicio de bloque: ${settings.blockStart} | estructura: 4 semanas base/base/pico/deload | sesiones por semana: ${activeSessionTypes(settings).length}`);
  L.push('objetivos de esta semana:');
  for (const t of activeSessionTypes(settings)) {
    L.push(`  - ${t.name}: ${formatTarget(t.id, weekTargets[t.id] || null)}`);
  }
  L.push('');

  const zones = (settings.zones && settings.zones.length)
    ? settings.zones
    : karvonenZones(settings.hrMax, settings.hrRest);
  L.push('== ZONAS DE FRECUENCIA CARDIACA ==');
  L.push(`método Karvonen · FCmáx ${settings.hrMax} · FCreposo ${settings.hrRest}`);
  L.push(zones.map(z => `Z${z.z} ${z.lo}-${z.hi}`).join(' · '));
  L.push('');

  L.push('== ACTIVIDAD EN LA VENTANA ==');
  if (!windowed.length) {
    L.push('sin sesiones registradas en las últimas ~5 semanas.');
  } else {
    const completed = windowed.filter(s => s.status === 'completed');
    const skipped = windowed.filter(s => s.status === 'skipped');
    const montana = completed.filter(s => s.terrain === 'montana');
    const totalKm = completed.reduce((a, s) => a + (s.distanceKm || 0), 0);
    L.push(`sesiones: ${windowed.length} registradas — ${completed.length} completadas` +
      `${montana.length ? ` (${montana.length} en montaña)` : ''}, ` +
      `${skipped.length} no ${skipped.length === 1 ? 'realizada' : 'realizadas'}`);
    L.push(`distancia total corrida: ${fmtKm(totalKm)}`);
    L.push('por tipo:');
    for (const t of SESSION_TYPES) {
      const ofType = completed.filter(s => s.type === t.id);
      // Suave apagada: solo aparece si hay sesiones suyas en la ventana.
      if (!ofType.length && !activeSessionTypes(settings).includes(t)) continue;
      L.push(`  - ${t.name}: ${ofType.length ? summarizeType(t, ofType) : '0 sesiones'}`);
    }
  }
  L.push('');

  L.push('== SESIONES (cronológico) ==');
  if (!windowed.length) L.push('(ninguna)');
  else for (const s of windowed) L.push(sessionLine(s));
  L.push('');

  L.push('== TENDENCIA Y SUGERENCIAS (motor local, no IA) ==');
  const hr = { hrMax: settings.hrMax, hrRest: settings.hrRest };
  let any = false;
  for (const t of activeSessionTypes(settings)) {
    const hist = all.filter(s => s.type === t.id);
    const sug = getSuggestions(hist, t.id, weekTargets[t.id] || null, hr);
    for (const g of sug) {
      if (g.id === 'not-enough-data') continue;
      any = true;
      L.push(`  - ${t.name}: ${g.text} (confianza: ${g.confidence})`);
    }
  }
  if (!any) L.push('  sin ajustes propuestos: seguir con los objetivos del bloque.');
  L.push('');

  L.push('FIN');
  return L.join('\n');
}
