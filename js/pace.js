// Ritmo de carrera: conversión entre "m:ss por km" (lo que lee la gente en el
// reloj) y segundos por km (con lo que se hacen las comparaciones). Puro.

// '5:50' | '05:50' -> 350. Devuelve null si no cuadra.
export function paceToSeconds(str) {
  if (str == null) return null;
  const s = String(str).trim();
  if (!s) return null;
  const m = s.match(/^(\d{1,2}):([0-5]?\d)$/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

// 350 -> '5:50'. null -> ''.
export function secondsToPace(sec) {
  if (sec == null || !isFinite(sec)) return '';
  const total = Math.round(sec);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// [lo, hi] en s/km -> '5:50-6:30'. Un solo valor -> '5:50'.
export function formatPaceRange(range) {
  if (!range) return '—';
  const [lo, hi] = Array.isArray(range) ? range : [range, range];
  if (lo == null && hi == null) return 'libre';
  if (hi == null || hi === lo) return `${secondsToPace(lo)}/km`;
  return `${secondsToPace(lo)}-${secondsToPace(hi)}/km`;
}

// Ritmo medio (s/km) a partir de distancia (km) y tiempo total (s).
export function paceFromDistanceTime(km, totalSeconds) {
  if (!km || !totalSeconds) return null;
  return totalSeconds / km;
}

// 'h:mm:ss' | 'mm:ss' | 'm:ss' -> segundos. null si no cuadra.
export function durationToSeconds(str) {
  if (str == null) return null;
  const s = String(str).trim();
  if (!s) return null;
  const parts = s.split(':').map(p => p.trim());
  if (parts.some(p => !/^\d+$/.test(p))) return null;
  if (parts.length === 2) return Number(parts[0]) * 60 + Number(parts[1]);
  if (parts.length === 3) return Number(parts[0]) * 3600 + Number(parts[1]) * 60 + Number(parts[2]);
  return null;
}
