// Puro: fecha -> posición en el bloque de 4 semanas. Portado de la app del
// gym (mismo bloque, misma app de fuerza sincronizada), incluido el arreglo
// de UTC para que el cambio de hora no descuadre el recuento de días.

const DAY_MS = 24 * 60 * 60 * 1000;

const WEEK_TYPES = {
  1: { label: 'Base' },
  2: { label: 'Base' },
  3: { label: 'Pico' },
  4: { label: 'Deload' }
};

function toDateOnly(dateStr) {
  // 'YYYY-MM-DD' -> epoch UTC del día, para restar fechas sin que el cambio
  // de hora (DST) meta o quite una hora entre medias y descuadre el recuento
  // de días (con new Date(y, m-1, d) local, cruzar el cambio de primavera
  // restaba 1h de más y el floor() perdía un día entero).
  const [y, m, d] = dateStr.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

export function todayStr(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// blockStart: 'YYYY-MM-DD' (debe ser un lunes). date: 'YYYY-MM-DD'.
export function getBlockPosition(dateStr, blockStartStr) {
  const date = toDateOnly(dateStr);
  const start = toDateOnly(blockStartStr);
  const diffDays = Math.floor((date - start) / DAY_MS);
  // Antes de que arranque el bloque configurado se muestra como semana 1,
  // no como un "deload" negativo que confundiría en Ajustes.
  if (diffDays < 0) return { block: 1, weekInBlock: 1 };
  const weeksSinceStart = Math.floor(diffDays / 7);
  const block = Math.floor(weeksSinceStart / 4) + 1;
  const weekInBlock = (weeksSinceStart % 4) + 1;
  return { block, weekInBlock };
}

export function getWeekType(weekInBlock) {
  return WEEK_TYPES[weekInBlock] || WEEK_TYPES[1];
}

export function isDeloadWeek(weekInBlock) {
  return weekInBlock === 4;
}

const WEEK_BANNER_MESSAGES = {
  1: 'Empieza el bloque — semana base',
  2: 'Semana 2 — sigue en base, sube un poco el volumen',
  3: 'Semana 3 — semana de pico, aquí se aprieta',
  4: 'Semana 4 — deload, toca bajar el ritmo y el volumen'
};

export function getWeekBannerMessage(weekInBlock) {
  return WEEK_BANNER_MESSAGES[weekInBlock] || WEEK_BANNER_MESSAGES[1];
}

// true solo el día exacto en que arranca una semana nueva del bloque (el
// propio día de inicio incluido), para disparar el aviso una vez.
export function isWeekChangeDay(dateStr, blockStartStr) {
  const date = toDateOnly(dateStr);
  const start = toDateOnly(blockStartStr);
  const diffDays = Math.floor((date - start) / DAY_MS);
  return diffDays >= 0 && diffDays % 7 === 0;
}

// Próximo lunes a partir de hoy (o el propio hoy si ya es lunes).
export function nextMonday(date = new Date()) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay(); // 0=domingo ... 1=lunes
  const diff = (8 - day) % 7;
  d.setDate(d.getDate() + (day === 1 ? 0 : diff));
  return todayStr(d);
}

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

// 'YYYY-MM-DD' -> 'YYYY-MM'.
export function monthKeyOf(dateStr) {
  return dateStr.slice(0, 7);
}

// 'YYYY-MM' -> 'Agosto 2026'.
export function monthLabel(monthKey) {
  const [y, m] = monthKey.split('-').map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
}

// Clave estable para agrupar por semana de bloque: "1-2" = bloque 1, semana 2.
export function weekKeyOf(session) {
  return `${session.block}-${session.weekInBlock}`;
}
