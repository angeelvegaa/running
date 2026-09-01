# Running

PWA instalable para seguir el entrenamiento de carrera: 4 sesiones semanales
(suave, series, umbral, larga), bloques de 4 semanas sincronizados a mano con el
bloque de fuerza, zonas de FC reales por Karvonen y un motor de sugerencias que
solo mira tu propio historial. Sin backend, sin cuentas: todo se guarda en el
dispositivo (localStorage). Funciona offline.

Tercera app del mismo conjunto, con el mismo enfoque que `gym track` y `dieta`:
HTML + CSS + JS con módulos ES nativos, sin build step ni dependencias.

## Probar en local

Los módulos ES no cargan desde `file://`, hace falta un servidor:

```bash
python3 -m http.server 8137
```

Abrir `http://localhost:8137`. Para instalarla como PWA de verdad hace falta
HTTPS, así que en local solo sirve para revisar la interfaz.

## Estructura

- `js/plan.js` — los 4 tipos de sesión, el Bloque 1 semana a semana (los números
  reales del documento del plan) y la derivación del bloque siguiente.
- `js/schedule.js` — bloques de 4 semanas a partir de la fecha de inicio (portado
  de `gym track`, con el arreglo de UTC para el cambio de hora).
- `js/zones.js` — zonas de FC por Karvonen y ventanas de FC por tipo de sesión.
- `js/suggestions.js` — reglas R0/R1/R2 sobre el historial. Todos los umbrales
  están en constantes al principio del archivo.
- `js/state.js` / `js/storage.js` — sesiones, ajustes y objetivos por bloque en
  localStorage (claves `run.*`).
- `js/ui/*.js` — las 5 pantallas (Hoy, Historial, Progreso, Zonas, Ajustes) más
  el formulario de sesión y el editor de bloque.

## El motor de sugerencias

Se evalúa por tipo de sesión. Un día no realizado o de montaña **corta la racha**:
las reglas de sesiones consecutivas solo miran desde el último de esos huecos.

- **R1 · ir más rápido** (prioridad 2): 3 sesiones seguidas del mismo tipo con
  ritmo ≥ 5 s/km más rápido que su objetivo, sensación "fácil" o "controlada", y
  el trabajo hecho. En suave/umbral/larga además la FC media no puede estar por
  encima de la ventana; en series la FC no se mira (llega tarde en repeticiones
  cortas). Propone bajar el objetivo 5 s/km, con botón "Aplicar".
- **R2 · mantener o aflojar** (prioridad 3, gana a R1): FC media ≥ techo de la
  ventana + 4 ppm dos sesiones seguidas (solo suave/umbral/larga), o sensación
  "muy duro" dos seguidas (todos los tipos).
- **R0**: menos de 2 sesiones en la racha → "registra 2 sesiones" (solo en
  Progreso).

## Zonas (Karvonen)

Por defecto usa la tabla del documento (FCmáx 190, FC reposo 48). Si cambias
FCmáx/FCreposo en Ajustes, "Recalcular con Karvonen" deriva los límites de nuevo:
`FC = FCreposo + %FCR · (FCmáx − FCreposo)`.

## Bloques

El Bloque 1 son los números del documento. Para el siguiente, Ajustes →
"Proponer bloque N+1" deriva una propuesta (semana 1 = pico del bloque anterior;
una sola palanca —ritmo o volumen— en la semana de pico de series y umbral;
deload en la semana 4) que revisas y editas antes de guardar.

## Copia de seguridad

Los datos viven solo en este dispositivo. Desde Ajustes se exporta todo a un JSON
y se vuelve a importar (por ejemplo al cambiar de móvil).

## Tests

```bash
npm install
npm run test:e2e        # Chromium y WebKit, en vertical
```

## Generar los iconos

```bash
node tools/make-icons.mjs
```

Solo hace falta si se cambia el diseño del icono.
