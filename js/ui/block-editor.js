import { el, clear, chipSelect, toast } from './components.js';
import { confirmModal } from '../modal.js';
import * as state from '../state.js';
import { SESSION_TYPES, LEVERS, DEFAULT_LEVERS } from '../plan.js';
import { paceToSeconds, secondsToPace } from '../pace.js';

const clone = v => JSON.parse(JSON.stringify(v));

function numInput(value, onInput, step = '0.5') {
  const input = el('input', { type: 'number', class: 'text-input editor-num', value: value ?? '', step, inputmode: 'decimal' });
  input.addEventListener('input', () => onInput(input.value === '' ? null : Number(input.value)));
  return input;
}

function paceInputs(pair, onChange) {
  const lo = el('input', { type: 'text', class: 'text-input editor-pace', placeholder: 'm:ss', value: pair[0] ?? '' });
  const hi = el('input', { type: 'text', class: 'text-input editor-pace', placeholder: 'm:ss', value: pair[1] ?? '' });
  lo.addEventListener('input', () => onChange(0, lo.value));
  hi.addEventListener('input', () => onChange(1, hi.value));
  return el('div', { class: 'editor-pace-pair' }, [lo, el('span', { text: '–' }), hi, el('span', { class: 'muted', text: '/km' })]);
}

// param: número de bloque existente a editar, o 'propose' para partir de la
// propuesta derivada del bloque más alto ya configurado.
export function renderBlockEditor(root, navigate, param) {
  clear(root);
  const isProposal = param === 'propose';
  let levers = { ...(state.getBlock(state.highestConfiguredBlock()).levers || DEFAULT_LEVERS) };
  let block = isProposal ? state.proposeNextBlock(levers) : clone(state.getBlock(Number(param)));
  // Ritmos como texto mientras se editan (m:ss), convertidos a s/km al guardar.
  let paceStrs = buildPaceStrs(block);

  function buildPaceStrs(b) {
    const out = {};
    for (const w of [1, 2, 3, 4]) {
      out[w] = {};
      SESSION_TYPES.forEach(t => {
        const range = b.weeks[w][t.id].paceSecPerKm;
        out[w][t.id] = range ? [secondsToPace(range[0]), secondsToPace(range[1])] : ['', ''];
      });
    }
    return out;
  }

  function regenerateProposal() {
    block = state.proposeNextBlock(levers);
    paceStrs = buildPaceStrs(block);
    draw();
  }

  function draw() {
    clear(root);
    root.appendChild(el('div', { class: 'session-header' }, [
      el('button', { class: 'btn btn--ghost btn--small', text: '← Ajustes', onClick: () => navigate('#/settings') }),
      el('h2', { text: isProposal ? `Bloque ${block.block} propuesto` : `Editar bloque ${block.block}` })
    ]));

    if (isProposal) {
      root.appendChild(el('div', { class: 'card' }, [
        el('p', { class: 'muted', text: `Semana 1 parte del pico del bloque ${block.derivedFrom}. Elige la palanca de la semana de pico para series y umbral, y ajusta cualquier número antes de guardar.` }),
        el('div', { class: 'settings-row' }, [el('span', { text: 'Series' }), chipSelect({
          options: LEVERS.map(l => ({ value: l, label: l })), value: levers.series,
          onChange: (v) => { levers = { ...levers, series: v }; regenerateProposal(); }
        })]),
        el('div', { class: 'settings-row' }, [el('span', { text: 'Umbral' }), chipSelect({
          options: LEVERS.map(l => ({ value: l, label: l })), value: levers.umbral,
          onChange: (v) => { levers = { ...levers, umbral: v }; regenerateProposal(); }
        })])
      ]));
    }

    [1, 2, 3, 4].forEach(w => {
      const card = el('div', { class: 'card' }, [el('h4', { text: `Semana ${w} · ${{ 1: 'Base', 2: 'Base', 3: 'Pico', 4: 'Deload' }[w]}` })]);
      SESSION_TYPES.forEach(t => {
        const target = block.weeks[w][t.id];
        const row = el('div', { class: 'editor-target-row' }, [el('span', { class: 'editor-target-type', text: t.name })]);
        if (t.metric === 'reps') {
          row.appendChild(numInput(target.reps[0], v => { target.reps[0] = v ?? target.reps[0]; }, '1'));
          row.appendChild(el('span', { text: '–' }));
          row.appendChild(numInput(target.reps[1], v => { target.reps[1] = v ?? target.reps[1]; }, '1'));
          row.appendChild(el('span', { class: 'muted', text: '×' }));
          row.appendChild(numInput(target.repMeters, v => { target.repMeters = v ?? target.repMeters; }, '50'));
          row.appendChild(el('span', { class: 'muted', text: 'm' }));
        } else {
          row.appendChild(numInput(target.distanceKm[0], v => { target.distanceKm[0] = v ?? target.distanceKm[0]; }, '0.5'));
          row.appendChild(el('span', { text: '–' }));
          row.appendChild(numInput(target.distanceKm[1], v => { target.distanceKm[1] = v ?? target.distanceKm[1]; }, '0.5'));
          row.appendChild(el('span', { class: 'muted', text: 'km' }));
        }
        row.appendChild(paceInputs(paceStrs[w][t.id], (idx, val) => { paceStrs[w][t.id][idx] = val; }));
        card.appendChild(row);
      });
      root.appendChild(card);
    });

    root.appendChild(el('div', { class: 'form-actions' }, [
      el('span', { class: 'bottom-bar-progress', text: isProposal ? 'Sin guardar' : 'Editando' }),
      el('button', {
        class: 'btn btn--primary',
        text: 'Guardar bloque',
        onClick: async () => {
          const ok = await confirmModal(`¿Fijar estos objetivos para el bloque ${block.block}?`);
          if (!ok) return;
          applyPaceStrs();
          state.saveBlock({ ...block, levers });
          toast(`Bloque ${block.block} guardado`);
          navigate('#/settings');
        }
      })
    ]));
  }

  function applyPaceStrs() {
    for (const w of [1, 2, 3, 4]) {
      SESSION_TYPES.forEach(t => {
        const [loStr, hiStr] = paceStrs[w][t.id];
        const lo = paceToSeconds(loStr), hi = paceToSeconds(hiStr);
        block.weeks[w][t.id].paceSecPerKm = (lo != null && hi != null) ? [lo, hi] : null;
      });
    }
  }

  draw();
}
