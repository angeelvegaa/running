// El plan como datos: los 4 tipos de sesión, el Bloque 1 semana a semana tal
// como está en el documento del plan, y la lógica para proponer el bloque
// siguiente a partir del pico del anterior. Puro.
//
// Ritmos en segundos por km (350 = 5:50/km). Rangos [lo, hi]. Un ritmo null
// significa "libre" (p. ej. el umbral de la semana de deload).

export const SESSION_TYPES = [
  { id: 'suave', name: 'Suave', weekday: 1, zoneLabel: 'Z2', metric: 'distance', hint: 'Rodaje fácil.' },
  { id: 'series', name: 'Series', weekday: 2, zoneLabel: 'Z4-Z5', metric: 'reps', hint: 'Repeticiones. Guíate por el ritmo, la FC llega tarde.' },
  { id: 'umbral', name: 'Umbral', weekday: 4, zoneLabel: 'Z3-Z4', metric: 'distance', hint: 'Continuo, en llano.' },
  { id: 'larga', name: 'Larga', weekday: 5, zoneLabel: 'Z2', metric: 'distance', hint: 'Tirada larga a ritmo cómodo.' }
];

export const SESSION_TYPE_IDS = SESSION_TYPES.map(t => t.id);

// Tipos con sesión planificada según los ajustes. La Suave se puede apagar
// (suaveEnabled) sin borrar nada: su historial y sus objetivos siguen ahí.
export function activeSessionTypes(settings) {
  return SESSION_TYPES.filter(t => t.id !== 'suave' || settings.suaveEnabled);
}

// Días por defecto de cada modo: 4 sesiones (original) y 3 sesiones (sin Suave).
export const WEEKDAYS_4 = { suave: 1, series: 2, umbral: 4, larga: 5 };
export const WEEKDAYS_3 = { suave: 1, series: 1, umbral: 3, larga: 5 };

export function sessionType(id) {
  return SESSION_TYPES.find(t => t.id === id) || null;
}

export const WEEK_LABELS = { 1: 'Base', 2: 'Base', 3: 'Pico', 4: 'Deload' };

// Palancas posibles para la semana de pico de series y umbral: solo una a la vez.
export const LEVERS = ['ritmo', 'volumen'];
export const DEFAULT_LEVERS = { series: 'ritmo', umbral: 'volumen' };

// --- Bloque 1: los números reales del documento ---

export const SEED_BLOCK_1 = {
  block: 1,
  levers: { ...DEFAULT_LEVERS },
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

// --- Derivación del bloque siguiente ---

const round05 = n => Math.round(n * 2) / 2;

function shiftPace(range, delta) {
  if (!range) return null;
  return range.map(v => (v == null ? null : v + delta));
}
function scaleDistance(range, factor) {
  return range.map(v => round05(v * factor));
}
function addReps(range, n) {
  return range.map(v => Math.max(1, Math.round(v + n)));
}
function scaleReps(range, factor) {
  return range.map(v => Math.max(1, Math.round(v * factor)));
}

// prevBlock: objeto { block, weeks }. levers: { series, umbral } con 'ritmo' | 'volumen'.
// Devuelve el bloque N+1 propuesto — cada número es editable después.
export function deriveNextBlock(prevBlock, levers = DEFAULT_LEVERS) {
  const peak = prevBlock.weeks[3];
  const nextBlockNum = prevBlock.block + 1;
  const weeks = { 1: {}, 2: {}, 3: {}, 4: {} };

  // Suave y larga: volumen puro, ritmo Z2 sin tocar. La semana 1 parte del
  // pico anterior; +5 % y +10 % en semanas 2 y 3; 75 % en el deload.
  for (const type of ['suave', 'larga']) {
    if (!peak[type]) continue;
    const base = peak[type].distanceKm;
    weeks[1][type] = { distanceKm: [...base], paceSecPerKm: peak[type].paceSecPerKm ? [...peak[type].paceSecPerKm] : null };
    weeks[2][type] = { distanceKm: scaleDistance(base, 1.05), paceSecPerKm: weeks[1][type].paceSecPerKm };
    weeks[3][type] = { distanceKm: scaleDistance(base, 1.10), paceSecPerKm: weeks[1][type].paceSecPerKm };
    weeks[4][type] = { distanceKm: scaleDistance(base, 0.75), paceSecPerKm: weeks[1][type].paceSecPerKm };
  }

  // Series y umbral: una sola palanca en la semana de pico.
  for (const type of ['series', 'umbral']) {
    const lever = levers[type] || DEFAULT_LEVERS[type];
    const s1 = peak[type];
    const isSeries = type === 'series';
    const vol1 = isSeries ? s1.reps : s1.distanceKm;
    const pace1 = s1.paceSecPerKm ? [...s1.paceSecPerKm] : null;

    let volByWeek, paceByWeek;
    if (lever === 'ritmo') {
      volByWeek = { 1: vol1, 2: vol1, 3: vol1 };
      paceByWeek = { 1: pace1, 2: shiftPace(pace1, -3), 3: shiftPace(pace1, -5) };
    } else {
      const bump = isSeries
        ? { 2: addReps(vol1, 1), 3: addReps(vol1, 2) }
        : { 2: scaleDistance(vol1, 1).map(v => v + 0.5), 3: scaleDistance(vol1, 1).map(v => v + 1) };
      volByWeek = { 1: vol1, 2: bump[2], 3: bump[3] };
      paceByWeek = { 1: pace1, 2: pace1, 3: pace1 };
    }
    // Deload: 60 % del volumen de la semana 1, con el ritmo de la semana 1.
    const deloadVol = isSeries ? scaleReps(vol1, 0.6) : scaleDistance(vol1, 0.6);
    volByWeek[4] = deloadVol;
    paceByWeek[4] = pace1;

    for (const w of [1, 2, 3, 4]) {
      weeks[w][type] = isSeries
        ? { reps: [...volByWeek[w]], repMeters: s1.repMeters, paceSecPerKm: paceByWeek[w] ? [...paceByWeek[w]] : null }
        : { distanceKm: [...volByWeek[w]], paceSecPerKm: paceByWeek[w] ? [...paceByWeek[w]] : null };
    }
  }

  return { block: nextBlockNum, levers: { ...levers }, weeks, derivedFrom: prevBlock.block };
}
