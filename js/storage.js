// Adaptador de persistencia. Hoy es localStorage; si algún día hace falta
// pasar a IndexedDB, este es el único archivo que hay que tocar.

const KEYS = {
  sessions: 'run.sessions',
  settings: 'run.settings',
  blocks: 'run.blocks',
  weekBannerShown: 'run.weekBannerShown'
};

const SCHEMA_VERSION = 1;

// Aviso de escritura, clave a clave, para la copia en la nube (js/sync.js).
// Con la sincronización apagada (caso por defecto) nadie se suscribe y esto
// no cuesta nada: la lista está vacía y ningún módulo de red se carga.
const writeListeners = [];
export function onWrite(fn) {
  writeListeners.push(fn);
  return () => {
    const i = writeListeners.indexOf(fn);
    if (i >= 0) writeListeners.splice(i, 1);
  };
}
function notifyWrite(key) {
  for (const fn of writeListeners) {
    try { fn(key); } catch (err) { console.warn('storage: listener de escritura falló', err); }
  }
}

function readRaw(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.error(`storage: fallo al leer ${key}`, err);
    return null;
  }
}

function writeRaw(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    notifyWrite(key);
    return true;
  } catch (err) {
    console.error(`storage: fallo al guardar ${key}`, err);
    return false;
  }
}

// Lee el valor de una clave TAL CUAL está en localStorage (cadena sin
// parsear). Lo usa js/sync.js para cifrar y subir el contenido exacto.
export function readRawString(key) {
  try {
    return localStorage.getItem(key);
  } catch (err) {
    console.error(`storage: fallo al leer ${key}`, err);
    return null;
  }
}

// Escribe una cadena ya serializada TAL CUAL, sin re-serializar y SIN
// disparar notifyWrite: lo usa js/sync.js al bajar y fusionar datos de la
// nube; notificar aquí haría que la fusión se re-subiera a sí misma en bucle.
export function writeRawString(key, jsonString) {
  try {
    localStorage.setItem(key, jsonString);
    return true;
  } catch (err) {
    console.error(`storage: fallo al guardar ${key}`, err);
    return false;
  }
}

export function loadSessions() {
  const data = readRaw(KEYS.sessions);
  if (!data) return { schemaVersion: SCHEMA_VERSION, sessions: {} };
  return data;
}
export function saveSessions(data) {
  return writeRaw(KEYS.sessions, { schemaVersion: SCHEMA_VERSION, sessions: data.sessions });
}

export function loadSettings() {
  return readRaw(KEYS.settings);
}
export function saveSettings(settings) {
  return writeRaw(KEYS.settings, { schemaVersion: SCHEMA_VERSION, ...settings });
}

// Objetivos por bloque: { schemaVersion, blocks: { [n]: blockObj } }.
export function loadBlocks() {
  return readRaw(KEYS.blocks);
}
export function saveBlocks(blocks) {
  return writeRaw(KEYS.blocks, { schemaVersion: SCHEMA_VERSION, blocks });
}

export function loadWeekBannerShownDate() {
  return readRaw(KEYS.weekBannerShown);
}
export function saveWeekBannerShownDate(dateStr) {
  return writeRaw(KEYS.weekBannerShown, dateStr);
}

export function exportAll() {
  return JSON.stringify({
    exportedAt: new Date().toISOString(),
    sessions: readRaw(KEYS.sessions),
    settings: readRaw(KEYS.settings),
    blocks: readRaw(KEYS.blocks)
  }, null, 2);
}

export function importAll(jsonString) {
  const parsed = JSON.parse(jsonString);
  if (!parsed || typeof parsed !== 'object') throw new Error('JSON inválido');
  if (parsed.sessions) writeRaw(KEYS.sessions, parsed.sessions);
  if (parsed.settings) writeRaw(KEYS.settings, parsed.settings);
  if (parsed.blocks) writeRaw(KEYS.blocks, parsed.blocks);
  return true;
}

export function wipeAll() {
  Object.values(KEYS).forEach(k => localStorage.removeItem(k));
}
