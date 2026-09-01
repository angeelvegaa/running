import { el, clear, toast } from './components.js';
import { confirmModal } from '../modal.js';
import * as state from '../state.js';
import { monthKeyOf, monthLabel, weekKeyOf } from '../schedule.js';
import { sessionType } from '../plan.js';
import { formatTarget } from '../format.js';
import { secondsToPace } from '../pace.js';

function statusBadge(session) {
  if (session.status === 'skipped') return { text: session.reason || 'No realizada', cls: 'skipped' };
  if (session.terrain === 'montana') return { text: 'Montaña', cls: 'montana' };
  return { text: 'Completada', cls: 'completed' };
}

function summarize(sessions) {
  const counts = { completed: 0, skipped: 0, montana: 0 };
  sessions.forEach(s => {
    if (s.status === 'skipped') counts.skipped++;
    else if (s.terrain === 'montana') counts.montana++;
    else counts.completed++;
  });
  return [
    counts.completed ? `${counts.completed} completada${counts.completed === 1 ? '' : 's'}` : null,
    counts.montana ? `${counts.montana} montaña` : null,
    counts.skipped ? `${counts.skipped} no realizada${counts.skipped === 1 ? '' : 's'}` : null
  ].filter(Boolean).join(' · ');
}

function emptyState(root, text) {
  root.appendChild(el('p', { class: 'muted', text }));
}

export function renderHistoryMonths(root, navigate) {
  clear(root);
  root.appendChild(el('h2', { text: 'Historial' }));
  const sessions = state.getSessionsSorted();
  if (!sessions.length) return emptyState(root, 'Todavía no hay sesiones registradas.');

  const months = {};
  sessions.forEach(s => (months[monthKeyOf(s.date)] ??= []).push(s));
  Object.keys(months).sort((a, b) => b.localeCompare(a)).forEach(mk => {
    const list = months[mk];
    root.appendChild(el('button', { class: 'history-row', type: 'button', onClick: () => navigate(`#/history/${mk}`) }, [
      el('div', { class: 'history-row-main' }, [
        el('span', { class: 'history-day', text: monthLabel(mk) }),
        el('span', { class: 'history-date', text: `${list.length} sesión${list.length === 1 ? '' : 'es'}` })
      ]),
      el('div', { class: 'history-row-meta' }, [el('span', { class: 'muted', text: summarize(list) })])
    ]));
  });
}

export function renderHistoryWeeks(root, navigate, monthKey) {
  clear(root);
  const sessions = state.getSessionsSorted().filter(s => monthKeyOf(s.date) === monthKey);
  root.appendChild(el('div', { class: 'session-header' }, [
    el('button', { class: 'btn btn--ghost btn--small', text: '← Historial', onClick: () => navigate('#/history') }),
    el('h2', { text: monthLabel(monthKey) })
  ]));
  if (!sessions.length) return emptyState(root, 'Sin sesiones este mes.');

  const weeks = {};
  sessions.forEach(s => (weeks[weekKeyOf(s)] ??= []).push(s));
  const weekKeys = Object.keys(weeks).sort((a, b) => {
    const maxA = weeks[a].reduce((m, s) => (s.date > m ? s.date : m), '');
    const maxB = weeks[b].reduce((m, s) => (s.date > m ? s.date : m), '');
    return maxB.localeCompare(maxA);
  });
  weekKeys.forEach(wk => {
    const list = weeks[wk];
    const [block, weekInBlock] = wk.split('-');
    root.appendChild(el('button', { class: 'history-row', type: 'button', onClick: () => navigate(`#/history/${monthKey}/${wk}`) }, [
      el('div', { class: 'history-row-main' }, [
        el('span', { class: 'history-day', text: `Semana ${weekInBlock} de 4` }),
        el('span', { class: 'history-date', text: `Bloque ${block}` })
      ]),
      el('div', { class: 'history-row-meta' }, [el('span', { class: 'muted', text: summarize(list) })])
    ]));
  });
}

export function renderHistoryDays(root, navigate, monthKey, weekKey) {
  clear(root);
  const [block, weekInBlock] = weekKey.split('-');
  const sessions = state.getSessionsSorted().filter(s => monthKeyOf(s.date) === monthKey && weekKeyOf(s) === weekKey);
  root.appendChild(el('div', { class: 'session-header' }, [
    el('button', { class: 'btn btn--ghost btn--small', text: `← ${monthLabel(monthKey)}`, onClick: () => navigate(`#/history/${monthKey}`) }),
    el('h2', { text: `Semana ${weekInBlock} de 4` }),
    el('p', { class: 'muted', text: `Bloque ${block}` })
  ]));
  if (!sessions.length) return emptyState(root, 'Sin sesiones esta semana.');

  sessions.forEach(session => {
    const type = sessionType(session.type);
    const badge = statusBadge(session);
    root.appendChild(el('button', { class: `history-row history-row--${badge.cls}`, type: 'button', onClick: () => navigate(`#/session-detail/${session.id}`) }, [
      el('div', { class: 'history-row-main' }, [
        el('span', { class: 'history-day', text: type.name }),
        el('span', { class: 'history-date', text: session.date })
      ]),
      el('div', { class: 'history-row-meta' }, [
        el('span', { class: `badge badge--${badge.cls}`, text: badge.text }),
        session.status === 'completed' && session.distanceKm != null
          ? el('span', { class: 'muted', text: `${session.distanceKm} km` }) : null
      ])
    ]));
  });
}

export function renderSessionDetail(root, sessionId, navigate) {
  clear(root);
  const session = state.getSession(sessionId);
  if (!session) return root.appendChild(el('p', { text: 'Sesión no encontrada.' }));

  const type = sessionType(session.type);
  const monthKey = monthKeyOf(session.date);
  const weekKey = weekKeyOf(session);
  const back = () => navigate(`#/history/${monthKey}/${weekKey}`);
  const badge = statusBadge(session);

  root.appendChild(el('div', { class: 'session-header' }, [
    el('button', { class: 'btn btn--ghost btn--small', text: '← Semana', onClick: back }),
    el('h2', { text: type.name }),
    el('p', { class: 'muted', text: `${session.date} · ${badge.text}` })
  ]));

  root.appendChild(el('div', { class: 'card' }, [
    el('p', { text: `Objetivo: ${formatTarget(type.id, session.target)}` })
  ]));

  if (session.status === 'skipped') {
    root.appendChild(el('div', { class: 'card' }, [el('p', { text: session.reason ? `Motivo: ${session.reason}` : 'Día no realizado.' })]));
  } else {
    const rows = [];
    if (session.terrain === 'montana') rows.push('Terreno: montaña (ritmo no comparado)');
    if (session.distanceKm != null) rows.push(`Distancia: ${session.distanceKm} km`);
    if (type.metric === 'reps') {
      if (session.repsDone != null) rows.push(`Repeticiones: ${session.repsDone} × ${session.repMeters ?? '?'} m`);
      if (session.repPaceSecPerKm != null) rows.push(`Ritmo de repeticiones: ${secondsToPace(session.repPaceSecPerKm)}/km`);
    } else if (session.paceSecPerKm != null) {
      rows.push(`Ritmo medio: ${secondsToPace(session.paceSecPerKm)}/km`);
    }
    if (session.hrAvg != null) rows.push(`FC media: ${session.hrAvg} ppm`);
    if (session.hrMax != null) rows.push(`FC máxima: ${session.hrMax} ppm`);
    if (session.effort) rows.push(`Sensación: ${{ facil: 'Fácil', controlado: 'Exigente pero controlado', muy_duro: 'Muy duro' }[session.effort]}`);
    if (session.note) rows.push(`Nota: ${session.note}`);
    root.appendChild(el('div', { class: 'card' }, rows.length
      ? rows.map(r => el('p', { text: r }))
      : [el('p', { class: 'muted', text: 'Sin más datos registrados.' })]));
  }

  root.appendChild(el('div', { class: 'card card--danger' }, [
    el('button', {
      class: 'btn btn--danger',
      text: 'Eliminar esta sesión',
      onClick: async () => {
        const ok = await confirmModal(`¿Eliminar el registro de ${type.name} del ${session.date}? No afecta al resto del histórico.`);
        if (!ok) return;
        state.deleteSession(session.id);
        toast('Sesión eliminada');
        back();
      }
    })
  ]));
}
