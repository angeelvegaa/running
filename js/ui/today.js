import { el, clear, toast } from './components.js';
import { promptModal, confirmModal } from '../modal.js';
import * as state from '../state.js';
import { todayStr, getBlockPosition, getWeekType } from '../schedule.js';
import { sessionType, WEEK_LABELS } from '../plan.js';
import { formatTarget } from '../format.js';
import { getSuggestions } from '../suggestions.js';

const STATUS_LABEL = {
  pending: 'Sin registrar',
  completed: 'Registrada',
  skipped: 'No realizada'
};

export function renderToday(root, navigate) {
  clear(root);
  const settings = state.getSettings();
  const dateStr = todayStr();
  const weekday = new Date().getDay();
  const { block, weekInBlock } = getBlockPosition(dateStr, settings.blockStart);
  const weekType = getWeekType(weekInBlock);

  root.appendChild(el('div', { class: 'today-header' }, [
    el('div', { class: 'today-block-info', text: `Bloque ${block} · Semana ${weekInBlock} de 4 · ${weekType.label}` })
  ]));

  const typeId = Object.entries(settings.weekdays).find(([, wd]) => wd === weekday)?.[0];
  const type = typeId ? sessionType(typeId) : null;

  if (!type) {
    root.appendChild(el('div', { class: 'card' }, [
      el('p', { text: 'Hoy no toca carrera. Descanso o entreno de gimnasio.' })
    ]));
    return;
  }

  const session = state.getOrCreateSession(dateStr, type.id, { block, weekInBlock });
  const target = getTargetOrSnapshot(session, type.id, block, weekInBlock);

  root.appendChild(el('div', { class: 'card card--today' }, [
    el('h2', { text: type.name }),
    el('p', { class: 'muted', text: type.hint }),
    el('p', { class: 'today-target', text: `Objetivo: ${formatTarget(type.id, target)}` }),
    el('p', { class: `muted status status--${session.status}`, text: session.terrain === 'montana' ? `Montaña · ${STATUS_LABEL[session.status]}` : STATUS_LABEL[session.status] }),
    el('div', { class: 'today-actions' }, [
      el('button', {
        class: 'btn btn--primary btn--big',
        text: session.status === 'completed' ? 'Editar registro' : 'Registrar sesión',
        onClick: () => navigate(`#/session/${session.id}`)
      }),
      session.status !== 'skipped' ? el('button', {
        class: 'btn btn--ghost',
        text: 'Marcar como no realizada',
        onClick: async () => {
          const reason = await promptModal('Motivo (opcional, se ve en el historial):');
          if (reason === null) return;
          state.markSkipped(dateStr, type.id, { block, weekInBlock }, reason.trim() || null);
          renderToday(root, navigate);
        }
      }) : el('button', {
        class: 'btn btn--ghost',
        text: 'Deshacer "no realizada"',
        onClick: () => { state.unmarkSkipped(session.id); renderToday(root, navigate); }
      })
    ])
  ]));

  const suggestions = getSuggestions(state.getTypeHistory(type.id), type.id, target, settings)
    .filter(s => s.id !== 'not-enough-data');

  if (suggestions.length) {
    const card = el('div', { class: 'card' }, [el('h3', { text: 'Antes de la sesión' })]);
    const list = el('ul', { class: 'suggestion-list' });
    suggestions.forEach(s => {
      const li = el('li', {}, [el('span', { text: s.text })]);
      if (s.apply) {
        li.appendChild(el('button', {
          class: 'btn btn--secondary btn--small suggestion-apply',
          type: 'button',
          text: 'Aplicar',
          onClick: async () => {
            const ok = await confirmModal(`¿Aplicar este cambio al objetivo de ${type.id} en las 4 semanas del bloque ${block}?`);
            if (!ok) return;
            state.adjustBlockPace(block, s.apply.type, s.apply.deltaSecPerKm);
            toast('Objetivo actualizado');
            renderToday(root, navigate);
          }
        }));
      }
      list.appendChild(li);
    });
    card.appendChild(list);
    root.appendChild(card);
  }
}

// Si la sesión ya tenía un objetivo guardado (foto del momento en que se
// creó), se respeta ese; si no, se recalcula por si el bloque cambió después.
function getTargetOrSnapshot(session, typeId, block, weekInBlock) {
  return session.target || state.getTargetFor(typeId, block, weekInBlock);
}
