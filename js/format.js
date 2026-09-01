// Formateo de objetivos y sesiones para pantalla. Puro.

import { formatPaceRange } from './pace.js';

function n(v) {
  // 5.5 -> '5,5' (coma decimal, como en el documento del plan). 5 -> '5'.
  return Number.isInteger(v) ? String(v) : String(v).replace('.', ',');
}

export function formatDistanceRange(range) {
  if (!range) return '—';
  const [lo, hi] = range;
  return lo === hi ? `${n(lo)} km` : `${n(lo)}-${n(hi)} km`;
}

export function formatRepsRange(range) {
  if (!range) return '—';
  const [lo, hi] = range;
  return lo === hi ? `${lo}` : `${lo}-${hi}`;
}

// Texto del objetivo de una sesión: "5,5-6 km · 5:50-6:30/km" o
// "8-10 × 400 m · 3:45-4:05/km".
export function formatTarget(type, target) {
  if (!target) return 'Sin objetivo definido todavía.';
  const pace = target.paceSecPerKm ? formatPaceRange(target.paceSecPerKm) : 'ritmo libre';
  if (type === 'series') {
    return `${formatRepsRange(target.reps)} × ${target.repMeters} m · ${pace}`;
  }
  return `${formatDistanceRange(target.distanceKm)} · ${pace}`;
}
