import { el, clear, chipSelect } from './components.js';
import * as state from '../state.js';
import { todayStr, getBlockPosition } from '../schedule.js';
import { SESSION_TYPES, WEEK_LABELS } from '../plan.js';
import { formatTarget } from '../format.js';

const WEEKDAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

// Pantalla de solo consulta: qué toca cada día para el bloque y la semana
// actual (o cualquier otra semana del bloque, con el selector). No registra nada.
export function renderPlan(root) {
  clear(root);
  const settings = state.getSettings();
  const { block, weekInBlock } = getBlockPosition(todayStr(), settings.blockStart);
  let shownWeek = weekInBlock;

  const z2 = settings.zones.find(z => z.z === 2);

  function draw() {
    clear(root);
    root.appendChild(el('h2', { text: 'Plan' }));
    root.appendChild(el('div', { class: 'today-block-info', text: `Bloque ${block} · Semana ${shownWeek} de 4 · ${WEEK_LABELS[shownWeek]}` }));
    root.appendChild(el('p', { class: 'muted', text: 'Solo consulta. Para registrar una sesión, ve a Hoy.' }));

    root.appendChild(chipSelect({
      options: [1, 2, 3, 4].map(w => ({ value: w, label: `Sem ${w}` })),
      value: shownWeek, wide: true,
      onChange: (w) => { shownWeek = w; draw(); }
    }));

    const days = SESSION_TYPES
      .map(t => ({ type: t, weekday: settings.weekdays[t.id] }))
      .sort((a, b) => a.weekday - b.weekday);

    const list = el('div', { class: 'plan-list' });
    days.forEach(({ type, weekday }) => {
      const target = state.getTargetFor(type.id, block, shownWeek);
      list.appendChild(el('div', { class: `plan-day plan-day--${type.id}` }, [
        el('div', { class: 'plan-day-head' }, [
          el('span', { class: 'plan-day-weekday', text: WEEKDAY_NAMES[weekday] }),
          el('span', { class: 'plan-day-zone', text: type.zoneLabel })
        ]),
        el('div', { class: 'plan-day-type', text: type.name }),
        el('div', { class: 'plan-day-target', text: formatTarget(type.id, target) }),
        el('div', { class: 'plan-day-hint', text: type.hint })
      ]));
    });
    root.appendChild(list);

    root.appendChild(el('div', { class: 'mtn-note' }, [
      el('b', { text: 'Días de montaña (lunes o viernes, cada 2-3 semanas): ' }),
      `ignora el ritmo de la tabla y guíate por la FC de Z2 (${z2 ? `${z2.lo}-${z2.hi}` : '133-147'} ppm).`
    ]));
  }

  draw();
}
