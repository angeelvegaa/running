// Motor de sugerencias sobre el historial de un tipo de sesión. Función pura,
// sin IA: solo condiciones sobre lo que ya registraste, comparado contra el
// objetivo que tenía cada sesión en su momento.
//
// Se evalúa por tipo (suave / series / umbral / larga), nunca mezclando tipos.
// Las reglas y sus umbrales están todos aquí arriba, sueltos, para poder
// ajustarlos en un momento si al usarlos ves que saltan demasiado o de menos.

import { formatPaceRange } from './pace.js';
import { hrWindowFor, hrIsReliableFor } from './zones.js';

const R1_STREAK = 3;        // sesiones consecutivas para sugerir ir más rápido
const R2_STREAK = 2;        // sesiones consecutivas para sugerir aflojar
const PACE_MARGIN = 5;      // s/km: cuánto más rápido que el objetivo cuenta como "de verdad más rápido" (ruido de GPS)
const PACE_STEP = 5;        // s/km: cuánto mueve el objetivo el botón Aplicar
const HR_SPIKE_OVER = 4;    // ppm por encima del techo de la ventana que cuenta como "FC disparada"
const DIST_MIN_FRAC = 0.95; // fracción del mínimo de distancia objetivo que cuenta como sesión hecha
const WINDOW = 6;           // como mucho se miran las 6 últimas sesiones de la racha

const EFFORT_RANK = { facil: 1, controlado: 2, muy_duro: 3 };

function comparablePace(h) {
  // En series manda el ritmo de las repeticiones, no la media de la sesión
  // (que incluye las recuperaciones). En el resto, el ritmo medio.
  return h.type === 'series' ? h.repPaceSecPerKm ?? null : h.paceSecPerKm ?? null;
}

// Hueco: día no realizado, día de montaña (el terreno invalida el ritmo), o
// sesión sin ritmo con el que comparar. Cualquiera corta la racha.
function isGap(h) {
  return h.status === 'skipped' || h.terrain === 'montana' || comparablePace(h) == null;
}

function confidenceFor(n) {
  if (n >= 5) return 'alta';
  if (n >= 3) return 'media';
  return 'baja';
}

function workDone(h) {
  if (h.type === 'series') {
    return h.target?.reps && h.repsDone != null && h.repsDone >= h.target.reps[0];
  }
  return h.target?.distanceKm && h.distanceKm != null && h.distanceKm >= h.target.distanceKm[0] * DIST_MIN_FRAC;
}

// history: sesiones de un tipo, ascendente por fecha, cada una con su `.target`
// (el objetivo que aplicaba esa semana) y `.type`.
// target: el objetivo del tipo para la próxima sesión (semana actual del bloque).
// hr: { hrMax, hrRest } para situar las ventanas de FC.
export function getSuggestions(history, type, target, hr = {}) {
  const win = hrWindowFor(type, hr.hrMax, hr.hrRest);
  const hrReliable = hrIsReliableFor(type);

  // Descarta todo hasta el último hueco incluido: solo cuenta la racha de
  // sesiones reales y en llano desde entonces.
  const lastGapIdx = history.reduce((acc, h, i) => (isGap(h) ? i : acc), -1);
  const trained = history.slice(lastGapIdx + 1).filter(h => !isGap(h));
  const recent = trained.slice(-WINDOW);

  if (recent.length < 2) {
    return [{
      id: 'not-enough-data',
      priority: 0,
      confidence: 'baja',
      text: `Registra 2 sesiones de ${type} para recibir sugerencias.`
    }];
  }

  const confidence = confidenceFor(recent.length);
  const suggestions = [];

  // --- R2 · mantener o aflojar, nunca subir (prioridad 3, gana a R1) ---
  const last2 = recent.slice(-R2_STREAK);
  const r2Ready = last2.length === R2_STREAK;

  const r2aHrSpike = r2Ready && hrReliable &&
    last2.every(h => h.hrAvg != null && h.hrAvg >= win.hi + HR_SPIKE_OVER);
  const r2bTooHard = r2Ready &&
    last2.every(h => h.effort === 'muy_duro');

  if (r2aHrSpike || r2bTooHard) {
    const looser = target?.paceSecPerKm ? target.paceSecPerKm.map(v => v + PACE_STEP) : null;
    let text;
    if (r2aHrSpike) {
      const [a, b] = last2.map(h => h.hrAvg);
      text = `No subas el ritmo objetivo de ${type} todavía: FC media ${a} y ${b} con la ventana esperada en ${win.lo}-${win.hi}. Mantén el rango`;
    } else {
      text = `Dos sesiones seguidas de ${type} en "muy duro". Mantén el ritmo objetivo`;
    }
    text += looser ? `, o aflójalo a ${formatPaceRange(looser)}.` : '.';
    suggestions.push({
      id: 'hold',
      priority: 3,
      confidence,
      text,
      apply: looser ? { type, deltaSecPerKm: PACE_STEP, newRange: looser } : null
    });
  }

  // --- R1 · ir más rápido (prioridad 2) — se suprime si R2 disparó ---
  const last3 = recent.slice(-R1_STREAK);
  const r1Ready = last3.length === R1_STREAK && !suggestions.some(s => s.id === 'hold');

  const r1Ok = r1Ready && last3.every(h => {
    const p = comparablePace(h);
    if (p == null || !h.target?.paceSecPerKm) return false;
    if (p > h.target.paceSecPerKm[0] - PACE_MARGIN) return false;
    if (h.effort !== 'facil' && h.effort !== 'controlado') return false;
    if (!workDone(h)) return false;
    return true;
  });

  // Freno por FC (solo suave, umbral y larga). La FC que falta no bloquea.
  let hrBlocks = false;
  if (r1Ok && hrReliable) {
    const withHr = last3.filter(h => h.hrAvg != null);
    const above = withHr.filter(h => h.hrAvg > win.hi).length;
    hrBlocks = withHr.length > 0 && above > withHr.length / 2;
  }

  if (r1Ok && !hrBlocks && target?.paceSecPerKm) {
    const faster = target.paceSecPerKm.map(v => v - PACE_STEP);
    suggestions.push({
      id: 'faster',
      priority: 2,
      confidence,
      text: `${cap(type)}: ${R1_STREAK} sesiones seguidas más rápido que el objetivo y sin pasarlo mal. ` +
        `Baja el objetivo de ${formatPaceRange(target.paceSecPerKm)} a ${formatPaceRange(faster)}.`,
      apply: { type, deltaSecPerKm: -PACE_STEP, newRange: faster }
    });
  }

  return suggestions.sort((a, b) => b.priority - a.priority);
}

function cap(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export const RULES_META = { R1_STREAK, R2_STREAK, PACE_MARGIN, PACE_STEP, HR_SPIKE_OVER, DIST_MIN_FRAC, WINDOW };
