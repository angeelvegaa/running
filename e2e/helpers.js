// Datos mínimos de ajustes/bloques/sesiones para los tests e2e, escritos
// directamente en localStorage con el mismo formato que usa js/storage.js
// (evita depender de generar cada sesión a través de la UI para todo).

export function buildSettings(blockStart, overrides = {}) {
  return {
    schemaVersion: 1,
    blockStart,
    weekdays: { suave: 1, series: 2, umbral: 4, larga: 5 },
    hrMax: 190,
    hrRest: 48,
    zonePaceNotes: {
      1: 'Trote muy suave — recuperación entre series',
      2: '≈ 5:50-6:30/km en llano — rodajes y tirada larga',
      3: '≈ 5:45-6:10/km — evitar como grueso del entreno',
      4: '≈ 5:00-5:15/km en llano — tu día de jueves',
      5: 'Guíate por el ritmo, no por la FC — en repeticiones cortas la FC llega tarde'
    },
    zones: [
      { z: 1, name: 'Recuperación', lo: 119, hi: 133, pace: 'Trote muy suave — recuperación entre series' },
      { z: 2, name: 'Base aeróbica', lo: 133, hi: 147, pace: '≈ 5:50-6:30/km en llano — rodajes y tirada larga' },
      { z: 3, name: 'Moderado (zona gris)', lo: 147, hi: 162, pace: '≈ 5:45-6:10/km — evitar como grueso del entreno' },
      { z: 4, name: 'Umbral', lo: 162, hi: 177, pace: '≈ 5:00-5:15/km en llano — tu día de jueves' },
      { z: 5, name: 'VO2max / velocidad', lo: 177, hi: 190, pace: 'Guíate por el ritmo, no por la FC — en repeticiones cortas la FC llega tarde' }
    ],
    ...overrides
  };
}

export function buildBlock1() {
  return {
    block: 1,
    levers: { series: 'ritmo', umbral: 'volumen' },
    weeks: {
      1: {
        suave: { distanceKm: [5, 5], paceSecPerKm: [350, 390] },
        series: { reps: [6, 8], repMeters: 400, paceSecPerKm: [230, 250] },
        umbral: { distanceKm: [4, 4], paceSecPerKm: [305, 315] },
        larga: { distanceKm: [10, 10], paceSecPerKm: [350, 390] }
      },
      2: {
        suave: { distanceKm: [5, 5.5], paceSecPerKm: [350, 390] },
        series: { reps: [5, 5], repMeters: 700, paceSecPerKm: [245, 260] },
        umbral: { distanceKm: [4.5, 5], paceSecPerKm: [305, 315] },
        larga: { distanceKm: [10, 11], paceSecPerKm: [350, 390] }
      },
      3: {
        suave: { distanceKm: [5.5, 6], paceSecPerKm: [350, 390] },
        series: { reps: [8, 10], repMeters: 400, paceSecPerKm: [225, 245] },
        umbral: { distanceKm: [5.5, 6], paceSecPerKm: [300, 310] },
        larga: { distanceKm: [11, 12], paceSecPerKm: [350, 390] }
      },
      4: {
        suave: { distanceKm: [4, 4], paceSecPerKm: [350, 390] },
        series: { reps: [4, 5], repMeters: 400, paceSecPerKm: [230, 250] },
        umbral: { distanceKm: [3, 3], paceSecPerKm: null },
        larga: { distanceKm: [8, 8], paceSecPerKm: [350, 390] }
      }
    }
  };
}

export function sessionId(dateStr, type) {
  return `${dateStr}_${type}`;
}

// Sesión "completada" mínima de un tipo dado.
export function buildSession(dateStr, type, block, weekInBlock, target, overrides = {}) {
  const id = sessionId(dateStr, type);
  return [id, {
    id, date: dateStr, type, block, weekInBlock,
    status: 'completed', terrain: 'llano', target,
    distanceKm: null, paceSecPerKm: null,
    repsDone: null, repMeters: null, repPaceSecPerKm: null,
    hrAvg: null, hrMax: null, effort: null, note: null, reason: null,
    ...overrides
  }];
}

// Escribe ajustes + bloques (+ sesiones opcionales) en localStorage antes de
// la primera navegación, para que app.js arranque ya con ese estado.
//
// addInitScript se re-ejecuta en CADA navegación de la página, incluida
// page.reload() — no solo en la primera. Sin el guard de "solo si no existe
// ya", un test que registra una sesión y luego recarga para comprobar que
// sobrevive vería su propio guardado borrado por este mismo seed antes de
// que la app llegara a leerlo.
export async function seedApp(page, { blockStart, blocks, sessions = [], settingsOverrides = {} }) {
  const settings = buildSettings(blockStart, settingsOverrides);
  const blocksMap = blocks || { 1: buildBlock1() };
  const sessionsMap = Object.fromEntries(sessions);

  await page.addInitScript(([settingsData, blocksData, sessionsData]) => {
    const setIfEmpty = (key, value) => {
      if (localStorage.getItem(key) == null) localStorage.setItem(key, JSON.stringify(value));
    };
    setIfEmpty('run.settings', settingsData);
    setIfEmpty('run.blocks', { schemaVersion: 1, blocks: blocksData });
    setIfEmpty('run.sessions', { schemaVersion: 1, sessions: sessionsData });
  }, [settings, blocksMap, sessionsMap]);
}

export function atNoon(dateStr) {
  return new Date(`${dateStr}T12:00:00`);
}

export function addDays(dateStr, days) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  const yy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}
