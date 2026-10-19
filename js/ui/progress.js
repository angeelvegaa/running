import { el, clear, chipSelect } from './components.js';
import * as state from '../state.js';
import { SESSION_TYPES, sessionType, activeSessionTypes } from '../plan.js';
import { secondsToPace } from '../pace.js';
import { getSuggestions } from '../suggestions.js';

const CHART_RANGES = [
  { id: 'block', label: 'Este bloque' },
  { id: 'last3', label: 'Últimos 3 bloques' },
  { id: 'all', label: 'Todo' }
];

function filterByRange(history, rangeId) {
  if (rangeId === 'all') return history;
  const blocks = history.map(h => h.block).filter(b => b != null);
  if (!blocks.length) return history;
  const maxBlock = Math.max(...blocks);
  const minBlock = rangeId === 'block' ? maxBlock : maxBlock - 2;
  return history.filter(h => h.block >= minBlock);
}

function comparablePace(h) {
  return h.type === 'series' ? h.repPaceSecPerKm : h.paceSecPerKm;
}

// invert=true: el valor bajo queda arriba (para ritmo: más rápido = arriba).
function buildChart(history, { getValue, invert = false, pointLabel, axisLabel }) {
  const points = history
    .filter(h => h.status === 'completed')
    .map(h => ({ date: h.date, value: getValue(h), block: h.block, weekInBlock: h.weekInBlock, montana: h.terrain === 'montana' }))
    .filter(p => p.value != null);
  if (points.length < 2) return null;

  const height = 130, padX = 44, padY = 18;
  const width = Math.max(320, points.length * 24);
  const values = points.map(p => p.value);
  const minV = Math.min(...values), maxV = Math.max(...values);
  const range = maxV - minV || 1;
  const xStep = (width - padX * 2) / (points.length - 1);

  const coords = points.map((p, i) => {
    const norm = (p.value - minV) / range;
    const y = invert
      ? padY + norm * (height - padY * 2)
      : height - padY - norm * (height - padY * 2);
    return { x: padX + i * xStep, y, ...p };
  });

  const pathD = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('class', 'progress-chart');

  for (let i = 1; i < coords.length; i++) {
    if (coords[i].block === coords[i - 1].block) continue;
    const lineX = (coords[i - 1].x + coords[i].x) / 2;
    const line = document.createElementNS(svgNS, 'line');
    line.setAttribute('x1', lineX.toFixed(1)); line.setAttribute('x2', lineX.toFixed(1));
    line.setAttribute('y1', padY - 8); line.setAttribute('y2', height - padY + 8);
    line.setAttribute('class', 'progress-chart-block-line');
    svg.appendChild(line);
    const label = document.createElementNS(svgNS, 'text');
    label.setAttribute('x', lineX.toFixed(1)); label.setAttribute('y', padY - 10);
    label.setAttribute('text-anchor', 'middle'); label.setAttribute('class', 'progress-chart-block-label');
    label.textContent = `B${coords[i].block}`;
    svg.appendChild(label);
  }

  // Etiquetas de los extremos del eje Y: arriba y abajo del rango de datos.
  const topLabel = invert ? minV : maxV;
  const bottomLabel = invert ? maxV : minV;
  [[topLabel, padY + 3], [bottomLabel, height - padY]].forEach(([val, y]) => {
    const t = document.createElementNS(svgNS, 'text');
    t.setAttribute('x', 4);
    t.setAttribute('y', y);
    t.setAttribute('class', 'progress-chart-axis-label');
    t.textContent = axisLabel(val);
    svg.appendChild(t);
  });

  const path = document.createElementNS(svgNS, 'path');
  path.setAttribute('d', pathD);
  path.setAttribute('class', 'progress-chart-line');
  svg.appendChild(path);

  coords.forEach(c => {
    const circle = document.createElementNS(svgNS, 'circle');
    circle.setAttribute('cx', c.x); circle.setAttribute('cy', c.y);
    circle.setAttribute('r', c.weekInBlock === 4 ? 5 : 3.5);
    circle.setAttribute('class', `progress-chart-point${c.weekInBlock === 4 ? ' progress-chart-point--deload' : ''}${c.montana ? ' progress-chart-point--montana' : ''}`);
    svg.appendChild(circle);
    const title = document.createElementNS(svgNS, 'title');
    title.textContent = `${c.date}: ${pointLabel(c)} · B${c.block} S${c.weekInBlock}${c.weekInBlock === 4 ? ' · deload' : ''}${c.montana ? ' · montaña' : ''}`;
    circle.appendChild(title);
  });

  return svg;
}

export function renderProgress(root, navigate) {
  clear(root);
  root.appendChild(el('h2', { text: 'Progreso' }));

  // La Suave sigue visible si ya tiene historial, aunque esté desactivada.
  const active = activeSessionTypes(state.getSettings());
  const shownTypes = SESSION_TYPES.filter(t => active.includes(t) || state.getTypeHistory(t.id).length);
  let typeId = shownTypes[0].id;
  let rangeId = 'all';

  function draw() {
    clear(root);
    root.appendChild(el('h2', { text: 'Progreso' }));
    root.appendChild(chipSelect({
      options: shownTypes.map(t => ({ value: t.id, label: t.name })),
      value: typeId, wide: true,
      onChange: (v) => { typeId = v; draw(); }
    }));

    const type = sessionType(typeId);
    const history = filterByRange(state.getTypeHistory(typeId), rangeId);

    const card = el('div', { class: 'card' }, [
      el('h4', { text: `Ritmo${typeId === 'series' ? ' de repeticiones' : ' medio'}` }),
      chipSelect({ options: CHART_RANGES.map(r => ({ value: r.id, label: r.label })), value: rangeId, wide: true, onChange: (v) => { rangeId = v; draw(); } })
    ]);
    const paceChart = buildChart(history, {
      getValue: comparablePace, invert: true,
      pointLabel: c => `${secondsToPace(c.value)}/km`,
      axisLabel: v => secondsToPace(v)
    });
    card.appendChild(paceChart || el('p', { class: 'muted', text: 'No hay suficientes sesiones con ritmo en este rango (las de montaña no cuentan aquí).' }));
    if (paceChart) card.appendChild(el('p', { class: 'muted chart-note', text: 'Más rápido = más arriba.' }));
    root.appendChild(card);

    const hrCard = el('div', { class: 'card' }, [el('h4', { text: 'FC media' })]);
    const hrChart = buildChart(history, { getValue: h => h.hrAvg, invert: false, pointLabel: c => `${c.value} ppm`, axisLabel: v => `${v}` });
    hrCard.appendChild(hrChart || el('p', { class: 'muted', text: 'No hay suficientes datos de FC en este rango.' }));
    root.appendChild(hrCard);

    const settings = state.getSettings();
    const currentTarget = history.length ? history[history.length - 1].target : null;
    const suggestions = getSuggestions(state.getTypeHistory(typeId), typeId, currentTarget, settings);
    root.appendChild(el('div', { class: 'card' }, [
      el('h4', { text: 'Sugerencias' }),
      suggestions.length
        ? el('ul', { class: 'suggestion-list' }, suggestions.map(s => el('li', { text: `${s.text} (confianza: ${s.confidence})` })))
        : el('p', { class: 'muted', text: 'Nada que ajustar por ahora: sigue con el objetivo del bloque.' })
    ]));

    const full = state.getTypeHistory(typeId).slice().reverse();
    root.appendChild(el('div', { class: 'card' }, [
      el('h4', { text: 'Sesiones' }),
      full.length
        ? el('ul', { class: 'detail-set-list' }, full.map(h => el('li', { text: sessionLine(h, type) })))
        : el('p', { class: 'muted', text: 'Todavía no hay sesiones de este tipo.' })
    ]));
  }

  draw();
}

function sessionLine(h, type) {
  if (h.status === 'skipped') return `${h.date} · S${h.weekInBlock} · no realizada`;
  if (h.terrain === 'montana') return `${h.date} · S${h.weekInBlock} · montaña${h.hrAvg != null ? ` · FC ${h.hrAvg}` : ''}`;
  const pace = comparablePace(h);
  const paceTxt = pace != null ? `${secondsToPace(pace)}/km` : '—';
  const extra = type.id === 'series' && h.repsDone != null ? `${h.repsDone}×${h.repMeters ?? '?'}m · ` : '';
  return `${h.date} · S${h.weekInBlock} · ${extra}${paceTxt}${h.hrAvg != null ? ` · FC ${h.hrAvg}` : ''}`;
}
