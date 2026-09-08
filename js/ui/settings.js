import { el, clear, toast } from './components.js';
import { confirmModal } from '../modal.js';
import * as state from '../state.js';
import * as storage from '../storage.js';
import { SESSION_TYPES } from '../plan.js';
import { getBlockPosition } from '../schedule.js';
import { renderCloudSync } from './cloud-sync.js';

const WEEKDAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

export function renderSettings(root, navigate) {
  clear(root);
  root.appendChild(el('h2', { text: 'Ajustes' }));
  const settings = state.getSettings();

  // Inicio del bloque
  const blockWrap = el('div', { class: 'card' }, [
    el('h4', { text: 'Inicio del bloque actual' }),
    el('p', { class: 'muted', text: 'Debe ser un lunes. Determina en qué semana del bloque de 4 estás. Se sincroniza a mano con el bloque de fuerza de la otra app.' })
  ]);
  const dateInput = el('input', { type: 'date', class: 'settings-date', value: settings.blockStart });
  dateInput.addEventListener('change', () => {
    if (!dateInput.value) return;
    state.updateSettings({ blockStart: dateInput.value });
    toast('Fecha de bloque actualizada');
  });
  blockWrap.appendChild(dateInput);
  root.appendChild(blockWrap);

  // Días de la semana por tipo de sesión
  const daysWrap = el('div', { class: 'card' }, [el('h4', { text: 'Días de carrera' })]);
  SESSION_TYPES.forEach(type => {
    const select = el('select', { class: 'settings-select' });
    WEEKDAY_NAMES.forEach((name, idx) => {
      select.appendChild(el('option', { value: idx, selected: idx === settings.weekdays[type.id] ? 'selected' : null, text: name }));
    });
    select.addEventListener('change', () => {
      state.updateSettings({ weekdays: { ...settings.weekdays, [type.id]: Number(select.value) } });
      toast(`${type.name} movido a ${WEEKDAY_NAMES[Number(select.value)]}`);
    });
    daysWrap.appendChild(el('div', { class: 'settings-row' }, [el('span', { text: type.name }), select]));
  });
  root.appendChild(daysWrap);

  // FC máxima / reposo -> zonas
  const hrWrap = el('div', { class: 'card' }, [
    el('h4', { text: 'FC máxima y de reposo' }),
    el('p', { class: 'muted', text: 'Si cambian, recalcula "Mis zonas" con el método Karvonen.' })
  ]);
  const hrMaxInput = el('input', { type: 'number', class: 'text-input', value: settings.hrMax });
  const hrRestInput = el('input', { type: 'number', class: 'text-input', value: settings.hrRest });
  hrWrap.appendChild(el('div', { class: 'settings-row' }, [el('span', { text: 'FC máxima (ppm)' }), hrMaxInput]));
  hrWrap.appendChild(el('div', { class: 'settings-row' }, [el('span', { text: 'FC reposo (ppm)' }), hrRestInput]));
  hrWrap.appendChild(el('button', {
    class: 'btn btn--secondary',
    text: 'Recalcular zonas con Karvonen',
    onClick: () => {
      const hrMax = Number(hrMaxInput.value), hrRest = Number(hrRestInput.value);
      if (!hrMax || !hrRest || hrMax <= hrRest) { toast('Revisa los valores de FC'); return; }
      state.updateSettings({ hrMax, hrRest });
      state.recalcZonesFromKarvonen();
      toast('Zonas recalculadas');
    }
  }));
  root.appendChild(hrWrap);

  // Objetivos del bloque
  const targetsWrap = el('div', { class: 'card' }, [
    el('h4', { text: 'Objetivos del bloque' }),
    el('p', { class: 'muted', text: `Bloque configurado más alto: ${state.highestConfiguredBlock()}.` }),
    el('button', {
      class: 'btn btn--secondary',
      text: `Editar bloque ${state.highestConfiguredBlock()}`,
      onClick: () => navigate(`#/block-editor/${state.highestConfiguredBlock()}`)
    }),
    el('button', {
      class: 'btn btn--secondary',
      text: `Proponer bloque ${state.highestConfiguredBlock() + 1}`,
      onClick: () => navigate('#/block-editor/propose')
    })
  ]);
  root.appendChild(targetsWrap);

  // Marcar varios días sin correr de golpe (viaje, lesión...)
  const rangeWrap = el('div', { class: 'card' }, [
    el('h4', { text: 'Marcar días sin correr' }),
    el('p', { class: 'muted', text: 'Para un viaje o parón: marca como "no realizado" todos los días de carrera del rango. No pisa sesiones ya registradas.' })
  ]);
  const fromInput = el('input', { type: 'date', class: 'settings-date' });
  const toInput = el('input', { type: 'date', class: 'settings-date' });
  const reasonInput = el('input', { type: 'text', class: 'settings-date', placeholder: 'Motivo (opcional): Viaje a...' });
  rangeWrap.appendChild(el('div', { class: 'settings-row' }, [el('span', { text: 'Desde' }), fromInput]));
  rangeWrap.appendChild(el('div', { class: 'settings-row' }, [el('span', { text: 'Hasta' }), toInput]));
  rangeWrap.appendChild(el('div', { class: 'settings-row' }, [el('span', { text: 'Motivo' }), reasonInput]));
  rangeWrap.appendChild(el('button', {
    class: 'btn btn--secondary',
    text: 'Marcar rango como no realizado',
    onClick: async () => {
      if (!fromInput.value || !toInput.value) { toast('Elige fecha de inicio y de fin'); return; }
      if (fromInput.value > toInput.value) { toast('"Desde" tiene que ser anterior a "Hasta"'); return; }
      const reason = reasonInput.value.trim() || null;
      const preview = state.previewRangeSkipped(fromInput.value, toInput.value);
      if (!preview.skipped.length) { toast('Ningún día de carrera cae en ese rango'); return; }
      const ok = await confirmModal(
        `Se marcarán ${preview.skipped.length} día(s) como "${reason || 'no realizado'}".` +
        (preview.keptExisting.length ? ` ${preview.keptExisting.length} con progreso ya registrado se dejan tal cual.` : '')
      );
      if (!ok) return;
      const currentSettings = state.getSettings();
      const result = state.applyRangeSkipped(
        fromInput.value, toInput.value,
        (dateStr) => getBlockPosition(dateStr, currentSettings.blockStart),
        reason
      );
      toast(`${result.skipped.length} día(s) marcados`);
      fromInput.value = ''; toInput.value = ''; reasonInput.value = '';
    }
  }));
  root.appendChild(rangeWrap);

  // Copia en la nube (opcional, apagada por defecto)
  const cloudCard = el('div', { class: 'card', id: 'cloudSyncCard' });
  renderCloudSync(cloudCard, {
    onMerged: () => { state.resetCache(); renderSettings(root, navigate); }
  });
  root.appendChild(cloudCard);

  // Backup
  root.appendChild(el('div', { class: 'card' }, [
    el('h4', { text: 'Copia de seguridad' }),
    el('p', { class: 'muted', text: 'Si no usas la copia en la nube, los datos viven solo en este dispositivo. Exporta de vez en cuando.' }),
    el('button', { class: 'btn btn--secondary', text: 'Exportar datos (JSON)', onClick: () => downloadExport() }),
    el('label', { class: 'btn btn--secondary btn--file' }, [
      'Importar datos (JSON)',
      (() => {
        const input = el('input', { type: 'file', accept: 'application/json', class: 'hidden-file-input' });
        input.addEventListener('change', () => handleImport(input, () => renderSettings(root, navigate)));
        return input;
      })()
    ])
  ]));

  // Borrado total
  root.appendChild(el('div', { class: 'card card--danger' }, [
    el('h4', { text: 'Borrar todo' }),
    el('button', {
      class: 'btn btn--danger',
      text: 'Borrar todos los datos',
      onClick: async () => {
        const ok = await confirmModal('Esto borra todas las sesiones, bloques y ajustes de este dispositivo. ¿Seguro?');
        if (!ok) return;
        storage.wipeAll();
        location.reload();
      }
    })
  ]));
}

function downloadExport() {
  const json = storage.exportAll();
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `running-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function handleImport(input, onDone) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      storage.importAll(reader.result);
      state.resetCache();
      toast('Datos importados');
      onDone();
    } catch (err) {
      toast('No se pudo importar: ' + err.message);
    }
  };
  reader.readAsText(file);
}
