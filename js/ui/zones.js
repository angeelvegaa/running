import { el, clear } from './components.js';
import * as state from '../state.js';

export function renderZones(root) {
  clear(root);
  const settings = state.getSettings();

  root.appendChild(el('h2', { text: 'Mis zonas' }));
  root.appendChild(el('p', { class: 'muted', text:
    `Calculadas con el método Karvonen sobre tu FC máxima real (${settings.hrMax} ppm) y de reposo (${settings.hrRest} ppm). Edítalas en Ajustes si cambian.` }));

  const table = el('div', { class: 'zones' });
  settings.zones.forEach(z => {
    table.appendChild(el('div', { class: 'zrow' }, [
      el('div', { class: `ztag z${z.z}bg`, text: `Z${z.z}` }),
      el('div', { class: 'zname', text: z.name }),
      el('div', { class: 'zhr' }, [el('b', { text: `${z.lo}-${z.hi}` }), ' ppm']),
      el('div', { class: 'zpace', text: z.pace })
    ]));
  });
  root.appendChild(table);

  root.appendChild(el('div', { class: 'mtn-note' }, [
    el('b', { text: 'En terreno con desnivel: ' }),
    'ignora el ritmo de la tabla por completo y guíate solo por la FC. Ajusta estas cifras con cada sesión real que registres.'
  ]));
}
