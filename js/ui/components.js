// Helpers DOM reutilizables. Sin frameworks: crear elementos a mano.

// WebKit móvil (confirmado en Safari y en la PWA instalada) puede despachar
// el 'click' de un tap sobre un elemento SIN listener propio dirigido a otro
// botón cercano en vez de a él, con retraso variable. pointerup/touchend sí
// resuelven bien el elemento tocado en todos los casos probados, así que son
// el único evento del que nos fiamos para touch y ratón (con Enter/Espacio
// de respaldo para teclado, sin depender de 'click').
const DRAG_THRESHOLD_PX = 10;

function bindTap(node, handler) {
  let startX = 0, startY = 0, dragged = false;
  node.addEventListener('pointerdown', (e) => { startX = e.clientX; startY = e.clientY; dragged = false; });
  node.addEventListener('pointermove', (e) => {
    if (Math.hypot(e.clientX - startX, e.clientY - startY) > DRAG_THRESHOLD_PX) dragged = true;
  });
  node.addEventListener('pointerup', (e) => { if (!dragged) handler(e); });
  node.addEventListener('keyup', (e) => { if (e.key === 'Enter' || e.key === ' ') handler(e); });
}

export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key === 'onClick' && typeof value === 'function') bindTap(node, value);
    else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2).toLowerCase(), value);
    else if (value !== null && value !== undefined) node.setAttribute(key, value);
  }
  (Array.isArray(children) ? children : [children]).forEach(child => {
    if (child === null || child === undefined) return;
    node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
  });
  return node;
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

export function toast(message, ms = 2200) {
  const node = el('div', { class: 'toast', text: message });
  document.body.appendChild(node);
  requestAnimationFrame(() => node.classList.add('toast--visible'));
  setTimeout(() => {
    node.classList.remove('toast--visible');
    setTimeout(() => node.remove(), 250);
  }, ms);
}

// Chips de una sola selección entre varias opciones { value, label }.
export function chipSelect({ options, value, onChange, wide = false }) {
  const wrap = el('div', { class: 'rpe-chips' });
  options.forEach(opt => {
    wrap.appendChild(el('button', {
      class: `chip${wide ? ' chip--wide' : ''}${value === opt.value ? ' chip--active' : ''}`,
      type: 'button',
      text: opt.label,
      onClick: () => {
        wrap.querySelectorAll('.chip').forEach(c => c.classList.remove('chip--active'));
        onChange(opt.value);
      }
    }));
  });
  return wrap;
}

export function labeledField(labelText, node) {
  return el('div', { class: 'field' }, [
    el('label', { class: 'field-label', text: labelText }),
    node
  ]);
}
