// CRUD de sesiones, ajustes y objetivos por bloque, sobre storage.js. Todo
// vive solo en este dispositivo: nada compartido ni sincronizado, tampoco con
// la app del gym (la fecha de inicio de bloque se introduce a mano en las dos).

import * as storage from './storage.js';
import { nextMonday } from './schedule.js';
import { SEED_BLOCK_1, SESSION_TYPE_IDS, deriveNextBlock, DEFAULT_LEVERS, activeSessionTypes, WEEKDAYS_3, WEEKDAYS_4 } from './plan.js';
import { DEFAULT_HR_MAX, DEFAULT_HR_REST, DEFAULT_ZONES, DEFAULT_ZONE_PACE_NOTES, karvonenZones } from './zones.js';

let _settings = null;
let _sessions = null;
let _blocks = null;

const clone = v => JSON.parse(JSON.stringify(v));

function defaultSettings() {
  return {
    blockStart: nextMonday(),
    suaveEnabled: false,
    weekdays: { ...WEEKDAYS_3 },
    hrMax: DEFAULT_HR_MAX,
    hrRest: DEFAULT_HR_REST,
    zonePaceNotes: { ...DEFAULT_ZONE_PACE_NOTES },
    zones: clone(DEFAULT_ZONES)
  };
}

function ensureLoaded() {
  if (_settings === null) {
    const loaded = storage.loadSettings();
    const defaults = defaultSettings();
    _settings = loaded
      ? {
          ...defaults,
          ...loaded,
          weekdays: { ...defaults.weekdays, ...(loaded.weekdays || {}) },
          zonePaceNotes: { ...defaults.zonePaceNotes, ...(loaded.zonePaceNotes || {}) },
          zones: loaded.zones || defaults.zones
        }
      : defaults;
    // Migración única: ajustes guardados antes de existir suaveEnabled usan el
    // plan de 4 sesiones. Se pasa a 3 (lunes Series, miércoles Umbral, viernes
    // Larga) solo si los días son los de fábrica; si el usuario los cambió a
    // mano se respetan y solo se apaga la Suave.
    if (loaded && loaded.suaveEnabled === undefined) {
      const wd = _settings.weekdays;
      const factory = Object.keys(WEEKDAYS_4).every(k => wd[k] === WEEKDAYS_4[k]);
      _settings = { ..._settings, suaveEnabled: false, weekdays: factory ? { ...WEEKDAYS_3 } : wd };
      storage.saveSettings(_settings);
    }
  }
  if (_sessions === null) {
    _sessions = storage.loadSessions().sessions || {};
  }
  if (_blocks === null) {
    const loaded = storage.loadBlocks();
    _blocks = (loaded && loaded.blocks && Object.keys(loaded.blocks).length)
      ? loaded.blocks
      : { 1: clone(SEED_BLOCK_1) };
    if (!loaded || !loaded.blocks || !Object.keys(loaded.blocks).length) storage.saveBlocks(_blocks);
  }
}

export function resetCache() {
  _settings = null;
  _sessions = null;
  _blocks = null;
}

// --- Ajustes ---

export function getSettings() {
  ensureLoaded();
  return _settings;
}

// Activa o desactiva la Suave en la planificación futura. No toca sesiones ni
// objetivos. Al cambiar de modo se reponen los días de fábrica del modo nuevo
// (con la Suave en lunes, Series no puede seguir en lunes).
export function setSuaveEnabled(enabled) {
  ensureLoaded();
  return updateSettings({ suaveEnabled: enabled, weekdays: { ...(enabled ? WEEKDAYS_4 : WEEKDAYS_3) } });
}

// Tipo planificado para un día de la semana (0=domingo), solo entre los activos.
export function typeIdForWeekday(weekday) {
  ensureLoaded();
  const t = activeSessionTypes(_settings).find(t => _settings.weekdays[t.id] === weekday);
  return t ? t.id : null;
}

export function updateSettings(patch) {
  ensureLoaded();
  _settings = { ..._settings, ...patch };
  storage.saveSettings(_settings);
  return _settings;
}

// Recalcula los límites de las 5 zonas por Karvonen con la FCmáx/FCreposo
// actuales, conservando los textos de ritmo.
export function recalcZonesFromKarvonen() {
  ensureLoaded();
  _settings = {
    ..._settings,
    zones: karvonenZones(_settings.hrMax, _settings.hrRest, _settings.zonePaceNotes)
  };
  storage.saveSettings(_settings);
  return _settings.zones;
}

// --- Bloques (objetivos por semana) ---

function persistBlocks() {
  storage.saveBlocks(_blocks);
}

export function getAllBlockNumbers() {
  ensureLoaded();
  return Object.keys(_blocks).map(Number).sort((a, b) => a - b);
}

export function highestConfiguredBlock() {
  const nums = getAllBlockNumbers();
  return nums[nums.length - 1];
}

// Objetivos de un bloque. Si ese bloque aún no está configurado, se usa el
// bloque configurado más alto (así "Hoy" siempre tiene un objetivo que mostrar
// aunque todavía no hayas cerrado el bloque nuevo).
export function getBlock(blockNum) {
  ensureLoaded();
  return _blocks[blockNum] || _blocks[highestConfiguredBlock()] || clone(SEED_BLOCK_1);
}

export function getWeekTargets(blockNum, weekInBlock) {
  return getBlock(blockNum).weeks[weekInBlock];
}

export function getTargetFor(type, blockNum, weekInBlock) {
  const w = getWeekTargets(blockNum, weekInBlock);
  return w ? w[type] : null;
}

// Propuesta del bloque siguiente al más alto configurado. No se guarda.
export function proposeNextBlock(levers) {
  ensureLoaded();
  const prev = getBlock(highestConfiguredBlock());
  return deriveNextBlock(prev, levers || prev.levers || DEFAULT_LEVERS);
}

export function saveBlock(blockObj) {
  ensureLoaded();
  _blocks[blockObj.block] = clone(blockObj);
  persistBlocks();
}

// Mueve el ritmo objetivo de un tipo en las 4 semanas del bloque por igual
// (conserva la forma de la progresión). Lo usa el botón "Aplicar" de las
// sugerencias. delta en s/km: negativo = más rápido.
export function adjustBlockPace(blockNum, type, deltaSecPerKm) {
  ensureLoaded();
  const block = _blocks[blockNum] || clone(getBlock(blockNum));
  for (const w of [1, 2, 3, 4]) {
    const t = block.weeks[w] && block.weeks[w][type];
    if (t && t.paceSecPerKm) t.paceSecPerKm = t.paceSecPerKm.map(v => Math.max(120, v + deltaSecPerKm));
  }
  _blocks[blockNum] = block;
  persistBlocks();
}

// --- Sesiones ---

function persistSessions() {
  storage.saveSessions({ sessions: _sessions });
}

export function sessionIdFor(dateStr, type) {
  return `${dateStr}_${type}`;
}

export function getSession(id) {
  ensureLoaded();
  return _sessions[id] || null;
}

export function getAllSessions() {
  ensureLoaded();
  return _sessions;
}

export function getSessionsSorted() {
  ensureLoaded();
  return Object.values(_sessions).sort((a, b) => b.date.localeCompare(a.date));
}

// Solo las sesiones con un registro real (completada o no realizada),
// descendente por fecha. Es lo que ve el Historial: una sesión "pending"
// (creada al abrir "Hoy" pero sin guardar) no es un registro.
export function getRecordedSessions() {
  ensureLoaded();
  return Object.values(_sessions)
    .filter(s => s.status === 'completed' || s.status === 'skipped')
    .sort((a, b) => b.date.localeCompare(a.date));
}

// Crea (si no existe) la sesión de una fecha + tipo, con una foto del objetivo
// que aplica esa semana (igual que el gym guarda block/weekInBlock/phase en
// cada sesión: las sesiones pasadas conservan el objetivo que tuvieron). Una
// sesión todavía "pending" no tiene historial que proteger, así que aquí se
// refresca su objetivo contra el bloque actual cada vez (si has tocado el
// bloque con "Aplicar" o el editor después de crearla, Hoy ve el cambio).
export function getOrCreateSession(dateStr, type, blockPos) {
  ensureLoaded();
  const id = sessionIdFor(dateStr, type);
  const { block, weekInBlock } = blockPos;
  const target = getTargetFor(type, block, weekInBlock);

  if (_sessions[id]) {
    const existing = _sessions[id];
    // Una sesión aún "pending" no tiene datos que guardar: se refresca su
    // objetivo contra el bloque actual pero NO se persiste. Así navegar por
    // "Hoy" no deja registros vacíos que luego aparezcan como fantasmas en
    // el Historial.
    if (existing.status === 'pending') existing.target = target ? clone(target) : null;
    return existing;
  }

  const session = {
    id,
    date: dateStr,
    type,
    block,
    weekInBlock,
    status: 'pending',
    terrain: 'llano',
    target: target ? clone(target) : null,
    distanceKm: null,
    paceSecPerKm: null,
    repsDone: null,
    repMeters: target && target.repMeters ? target.repMeters : null,
    repPaceSecPerKm: null,
    hrAvg: null,
    hrMax: null,
    effort: null,
    note: null,
    reason: null
  };
  _sessions[id] = session;
  persistSessions();
  return session;
}

export function saveSessionLog(id, patch) {
  ensureLoaded();
  const s = _sessions[id];
  if (!s) throw new Error(`Sesión desconocida: ${id}`);
  Object.assign(s, patch);
  if (s.status === 'pending' || s.status === 'skipped') s.status = 'completed';
  s.reason = s.status === 'skipped' ? s.reason : null;
  persistSessions();
  return s;
}

export function markSkipped(dateStr, type, blockPos, reason = null) {
  const s = getOrCreateSession(dateStr, type, blockPos);
  s.status = 'skipped';
  s.reason = reason || null;
  persistSessions();
  return s;
}

// Deshacer un "no realizada" borra el registro del todo: vuelve al estado
// "nunca se tocó ese día", sin dejar una sesión pending persistida.
export function unmarkSkipped(id) {
  ensureLoaded();
  if (!_sessions[id]) return;
  delete _sessions[id];
  persistSessions();
}

export function deleteSession(id) {
  ensureLoaded();
  if (!_sessions[id]) return false;
  delete _sessions[id];
  persistSessions();
  return true;
}

// Historial de un tipo, ascendente por fecha, con la forma que espera
// suggestions.js. Incluye los días "no realizados" y los de montaña como
// marcadores de hueco.
export function getTypeHistory(type) {
  ensureLoaded();
  return Object.values(_sessions)
    .filter(s => s.type === type)
    .filter(s => s.status === 'skipped' || s.status === 'completed')
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(s => ({ ...s }));
}

// --- Marcar un rango de días como no realizados (viaje, lesión) ---

const typeForWeekday = typeIdForWeekday;

function rangeDays(startDateStr, endDateStr) {
  const [sy, sm, sd] = startDateStr.split('-').map(Number);
  const [ey, em, ed] = endDateStr.split('-').map(Number);
  const start = new Date(sy, sm - 1, sd);
  const end = new Date(ey, em - 1, ed);
  const skipped = [];
  const keptExisting = [];
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${dd}`;
    const type = typeForWeekday(d.getDay());
    if (!type || !SESSION_TYPE_IDS.includes(type)) continue;
    const id = sessionIdFor(dateStr, type);
    const existing = _sessions[id];
    if (existing && existing.status === 'completed') {
      keptExisting.push({ date: dateStr, type });
    } else {
      skipped.push({ date: dateStr, type });
    }
  }
  return { skipped, keptExisting };
}

export function previewRangeSkipped(startDateStr, endDateStr) {
  ensureLoaded();
  return rangeDays(startDateStr, endDateStr);
}

export function applyRangeSkipped(startDateStr, endDateStr, blockPosFn, reason = null) {
  ensureLoaded();
  const { skipped, keptExisting } = rangeDays(startDateStr, endDateStr);
  skipped.forEach(({ date, type }) => {
    markSkipped(date, type, blockPosFn(date), reason);
  });
  return { skipped, keptExisting };
}
