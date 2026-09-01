// Modal propio. iOS bloquea en silencio confirm()/prompt()/alert() en apps
// instaladas en la pantalla de inicio (modo standalone), así que NO se usan
// en ningún sitio de esta app: todo pasa por aquí. Crea su propio overlay,
// no depende de nada en index.html.

let overlay = null;

function build() {
  overlay = document.createElement('div');
  overlay.id = 'modalOverlay';
  overlay.hidden = true;
  overlay.innerHTML = `
    <div class="modal-box" role="dialog" aria-modal="true">
      <p id="modalMsg" class="modal-msg"></p>
      <input id="modalInput" class="modal-input" type="text" hidden />
      <div class="modal-actions">
        <button id="modalCancel" type="button" class="btn btn--ghost">Cancelar</button>
        <button id="modalOk" type="button" class="btn btn--primary">Aceptar</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
}

export function showModal({ message, withInput = false, defaultValue = '', okLabel = 'Aceptar', cancelLabel = 'Cancelar' }) {
  if (!overlay) build();
  return new Promise((resolve) => {
    const input = overlay.querySelector('#modalInput');
    overlay.querySelector('#modalMsg').textContent = message;
    input.hidden = !withInput;
    input.value = defaultValue || '';
    const ok = overlay.querySelector('#modalOk');
    const cancel = overlay.querySelector('#modalCancel');
    ok.textContent = okLabel;
    cancel.textContent = cancelLabel;
    cancel.hidden = !cancelLabel;
    overlay.hidden = false;

    const cleanup = (result) => {
      overlay.hidden = true;
      ok.onclick = null;
      cancel.onclick = null;
      resolve(result);
    };
    ok.onclick = () => cleanup(withInput ? input.value : true);
    cancel.onclick = () => cleanup(withInput ? null : false);
    if (withInput) setTimeout(() => input.focus(), 60);
  });
}

export const confirmModal = (msg, okLabel = 'Aceptar') => showModal({ message: msg, okLabel });
export const promptModal = (msg, def = '') => showModal({ message: msg, withInput: true, defaultValue: def });
export const alertModal = (msg) => showModal({ message: msg, cancelLabel: '', okLabel: 'Vale' }).then(() => {});
