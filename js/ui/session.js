import { el, clear, chipSelect, labeledField, toast } from './components.js';
import { confirmModal } from '../modal.js';
import * as state from '../state.js';
import { sessionType } from '../plan.js';
import { formatTarget } from '../format.js';
import { paceToSeconds, secondsToPace } from '../pace.js';

const TERRAIN_OPTIONS = [
  { value: 'llano', label: 'Llano' },
  { value: 'montana', label: 'Montaña' }
];

const EFFORT_OPTIONS = [
  { value: 'facil', label: 'Fácil' },
  { value: 'controlado', label: 'Exigente pero controlado' },
  { value: 'muy_duro', label: 'Muy duro' }
];

// Input numérico enlazado directamente al borrador: escribe en draft[key] en
// cada cambio, así un redibujado (al tocar un chip) no pierde lo ya tecleado.
function boundNumber(draft, key, opts = {}) {
  const input = el('input', {
    type: 'number', inputmode: 'decimal', class: 'text-input',
    value: draft[key] ?? '', step: opts.step ?? 'any', min: opts.min ?? 0, placeholder: '—'
  });
  const write = () => { draft[key] = input.value === '' ? null : Number(input.value); };
  input.addEventListener('input', write);
  input.addEventListener('change', write);
  return input;
}

function boundText(draft, key, placeholder) {
  const input = el('input', { type: 'text', inputmode: 'numeric', class: 'text-input', placeholder, value: draft[key] || '' });
  const write = () => { draft[key] = input.value; };
  input.addEventListener('input', write);
  input.addEventListener('change', write);
  return input;
}

export function renderSession(root, sessionId, navigate) {
  clear(root);
  const session = state.getSession(sessionId);
  if (!session) {
    root.appendChild(el('p', { text: 'Sesión no encontrada.' }));
    return;
  }
  const type = sessionType(session.type);
  const target = session.target;

  // Borrador local: se guarda todo junto al pulsar "Guardar", no campo a campo.
  const draft = {
    terrain: session.terrain || 'llano',
    distanceKm: session.distanceKm,
    paceStr: session.paceSecPerKm != null ? secondsToPace(session.paceSecPerKm) : '',
    hrAvg: session.hrAvg,
    hrMax: session.hrMax,
    effort: session.effort,
    note: session.note || '',
    repsDone: session.repsDone,
    repMeters: session.repMeters ?? (target && target.repMeters) ?? 400,
    repPaceStr: session.repPaceSecPerKm != null ? secondsToPace(session.repPaceSecPerKm) : ''
  };

  function draw() {
    clear(root);
    root.appendChild(el('div', { class: 'session-header' }, [
      el('button', { class: 'btn btn--ghost btn--small', text: '← Hoy', onClick: () => navigate('#/today') }),
      el('h2', { text: type.name }),
      el('p', { class: 'muted', text: `${session.date} · Semana ${session.weekInBlock} de 4 · Bloque ${session.block}` })
    ]));

    root.appendChild(el('div', { class: 'card' }, [
      el('p', { class: 'muted', text: `Objetivo: ${formatTarget(type.id, target)}` })
    ]));

    const form = el('div', { class: 'card' });

    form.appendChild(labeledField('Terreno', chipSelect({
      options: TERRAIN_OPTIONS, value: draft.terrain,
      onChange: (v) => { draft.terrain = v; draw(); }
    })));

    if (draft.terrain === 'montana') {
      form.appendChild(el('p', { class: 'muted onboarding-disclaimer', text:
        'Día de montaña: el terreno invalida el ritmo, así que no se pide ni se compara. Guíate por la FC de Z2 y anota solo lo que quieras del resto.' }));
    }

    form.appendChild(labeledField('Distancia (km)', boundNumber(draft, 'distanceKm', { step: '0.1' })));

    if (draft.terrain !== 'montana') {
      if (type.metric === 'reps') {
        form.appendChild(labeledField('Repeticiones hechas', boundNumber(draft, 'repsDone', { step: '1' })));
        form.appendChild(labeledField('Metros por repetición', boundNumber(draft, 'repMeters', { step: '50' })));
        form.appendChild(labeledField('Ritmo medio de las repeticiones (m:ss/km)', boundText(draft, 'repPaceStr', 'p.ej. 3:55')));
      } else {
        form.appendChild(labeledField('Ritmo medio (m:ss/km)', boundText(draft, 'paceStr', 'p.ej. 5:15')));
      }
    }

    form.appendChild(labeledField('FC media (ppm)', boundNumber(draft, 'hrAvg', { step: '1' })));
    form.appendChild(labeledField('FC máxima (ppm)', boundNumber(draft, 'hrMax', { step: '1' })));

    form.appendChild(labeledField('Sensación', chipSelect({
      options: EFFORT_OPTIONS, value: draft.effort, wide: true,
      onChange: (v) => { draft.effort = v === draft.effort ? null : v; draw(); }
    })));

    const noteInput = el('textarea', { class: 'text-input textarea', rows: 2, placeholder: 'Cómo te encontraste, viento, calor...' }, draft.note);
    noteInput.addEventListener('input', () => { draft.note = noteInput.value; });
    form.appendChild(labeledField('Nota (opcional)', noteInput));

    root.appendChild(form);

    root.appendChild(el('div', { class: 'form-actions' }, [
      el('button', {
        class: 'btn btn--danger btn--small',
        text: 'Eliminar sesión',
        onClick: async () => {
          const ok = await confirmModal(`¿Eliminar el registro de ${type.name} del ${session.date}?`);
          if (!ok) return;
          state.deleteSession(session.id);
          toast('Sesión eliminada');
          navigate('#/today');
        }
      }),
      el('button', { class: 'btn btn--primary', text: 'Guardar', onClick: () => save() })
    ]));
  }

  function save() {
    const patch = {
      terrain: draft.terrain,
      distanceKm: draft.distanceKm,
      hrAvg: draft.hrAvg,
      hrMax: draft.hrMax,
      effort: draft.effort,
      note: draft.note ? String(draft.note).trim() || null : null
    };

    if (draft.terrain === 'montana') {
      patch.paceSecPerKm = null;
      patch.repPaceSecPerKm = null;
      patch.repsDone = null;
    } else if (type.metric === 'reps') {
      const repPace = paceToSeconds(draft.repPaceStr);
      if (draft.repPaceStr && repPace == null) { toast('Ritmo de repeticiones inválido, usa m:ss'); return; }
      patch.repPaceSecPerKm = repPace;
      patch.repsDone = draft.repsDone;
      patch.repMeters = draft.repMeters;
      patch.paceSecPerKm = null;
    } else {
      const pace = paceToSeconds(draft.paceStr);
      if (draft.paceStr && pace == null) { toast('Ritmo inválido, usa el formato m:ss'); return; }
      patch.paceSecPerKm = pace;
    }

    state.saveSessionLog(session.id, patch);
    toast('Sesión guardada');
    navigate('#/today');
  }

  draw();
}
