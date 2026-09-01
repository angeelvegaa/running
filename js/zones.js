// Zonas de frecuencia cardiaca por el método Karvonen: FC = FCreposo + %FCR *
// (FCmáx - FCreposo), donde %FCR es el porcentaje de la reserva cardiaca.
// Puro. Los valores por defecto son los del documento del plan (FCmáx 190,
// FC reposo 48); si cambias FCmáx/FCreposo en Ajustes, "Recalcular con
// Karvonen" vuelve a derivar los límites de cada zona con esta misma fórmula.

export const DEFAULT_HR_MAX = 190;
export const DEFAULT_HR_REST = 48;

// Límites de cada zona en % de la reserva cardiaca.
const ZONE_BANDS = [
  { z: 1, name: 'Recuperación', lo: 0.50, hi: 0.60 },
  { z: 2, name: 'Base aeróbica', lo: 0.60, hi: 0.70 },
  { z: 3, name: 'Moderado (zona gris)', lo: 0.70, hi: 0.80 },
  { z: 4, name: 'Umbral', lo: 0.80, hi: 0.90 },
  { z: 5, name: 'VO2max / velocidad', lo: 0.90, hi: 1.00 }
];

// Texto orientativo de ritmo por zona (editable en Ajustes, no se recalcula).
export const DEFAULT_ZONE_PACE_NOTES = {
  1: 'Trote muy suave — recuperación entre series',
  2: '≈ 5:50-6:30/km en llano — rodajes y tirada larga',
  3: '≈ 5:45-6:10/km — evitar como grueso del entreno',
  4: '≈ 5:00-5:15/km en llano — tu día de jueves',
  5: 'Guíate por el ritmo, no por la FC — en repeticiones cortas la FC llega tarde'
};

// Tabla del documento del plan, punto de partida antes de tocar nada.
export const DEFAULT_ZONES = [
  { z: 1, name: 'Recuperación', lo: 119, hi: 133, pace: DEFAULT_ZONE_PACE_NOTES[1] },
  { z: 2, name: 'Base aeróbica', lo: 133, hi: 147, pace: DEFAULT_ZONE_PACE_NOTES[2] },
  { z: 3, name: 'Moderado (zona gris)', lo: 147, hi: 162, pace: DEFAULT_ZONE_PACE_NOTES[3] },
  { z: 4, name: 'Umbral', lo: 162, hi: 177, pace: DEFAULT_ZONE_PACE_NOTES[4] },
  { z: 5, name: 'VO2max / velocidad', lo: 177, hi: 190, pace: DEFAULT_ZONE_PACE_NOTES[5] }
];

function hr(pct, hrMax, hrRest) {
  return Math.round(hrRest + pct * (hrMax - hrRest));
}

// Recalcula lo/hi de cada zona por Karvonen, conservando nombre y texto de ritmo.
export function karvonenZones(hrMax, hrRest, paceNotes = DEFAULT_ZONE_PACE_NOTES) {
  return ZONE_BANDS.map(b => ({
    z: b.z,
    name: b.name,
    lo: hr(b.lo, hrMax, hrRest),
    hi: hr(b.hi, hrMax, hrRest),
    pace: paceNotes[b.z] || ''
  }));
}

// Ventana de FC esperada para el motor de sugerencias, por tipo de sesión,
// en % de reserva cardiaca (sigue a FCmáx/FCreposo aunque los cambies).
//   suave / larga : 60-70 %  -> 133-147 con 190/48
//   umbral        : 77-86 %  -> 157-170
//   series        : 85-100 % -> 169-190 (solo informativa: en repeticiones
//                   cortas la FC llega tarde y no se usa para sugerir)
const HR_WINDOW_BANDS = {
  suave: [0.60, 0.70],
  larga: [0.60, 0.70],
  umbral: [0.77, 0.86],
  series: [0.85, 1.00]
};

export function hrWindowFor(type, hrMax = DEFAULT_HR_MAX, hrRest = DEFAULT_HR_REST) {
  const band = HR_WINDOW_BANDS[type] || HR_WINDOW_BANDS.suave;
  return { lo: hr(band[0], hrMax, hrRest), hi: hr(band[1], hrMax, hrRest) };
}

// La FC solo es un indicador directo en sesiones continuas. En series, el
// retraso fisiológico dentro de cada repetición corta la invalida.
export function hrIsReliableFor(type) {
  return type !== 'series';
}
