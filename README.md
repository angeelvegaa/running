# Running

PWA instalable para seguir el entrenamiento de carrera: 4 sesiones semanales
(suave, series, umbral, larga), bloques de 4 semanas sincronizados a mano con el
bloque de fuerza, zonas de FC reales por Karvonen y un motor de sugerencias que
solo mira tu propio historial. Por defecto, sin backend y sin cuentas: todo se
guarda en el dispositivo (localStorage) y funciona offline. La copia en la nube
cifrada es opcional y va apagada (ver más abajo).

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
  localStorage (claves `run.*`). `storage.js` expone además `onWrite` para la
  copia en la nube.
- `js/sync.js` / `js/ui/cloud-sync.js` — copia en la nube opcional (Supabase +
  AES-GCM, import dinámico). Ver más abajo.
- `js/autoexport.js` — vista de solo lectura en texto plano (ver más abajo).
- `js/ui/*.js` — las 6 pantallas (Hoy, Plan, Historial, Progreso, Zonas, Ajustes)
  más el formulario de sesión y el editor de bloque. **Plan** es de solo lectura:
  qué toca cada día para el bloque y la semana actual (o cualquier otra semana del
  bloque), sin registrar nada.

El formulario de registro cambia según el tipo de día: series pide repeticiones,
metros por repetición y ritmo de las repeticiones (sin distancia total); el resto
pide distancia total y ritmo medio. FC, sensación y nota en todos.

El ritmo se mete en dos casillas numéricas `[m] : [ss]` (como una hora), con
teclado numérico normal — sin depender de la tecla `:`. Auto-salta de minutos a
segundos al completar 2 dígitos, el retroceso desde segundos vacíos vuelve a
minutos, y los segundos se limitan a 0-59. Internamente se guarda como `m:ss`
(`js/pace.js`), sin cambios en el modelo de datos.

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

Si no usas la copia en la nube, los datos viven solo en este dispositivo. Desde
Ajustes se exporta todo a un JSON y se vuelve a importar (por ejemplo al cambiar
de móvil).

## Exportación en texto plano (`?autoexport=1`)

Abrir la app con `?autoexport=1` en la URL (p. ej.
`https://angeelvegaa.github.io/running/?autoexport=1`) no muestra la interfaz:
pinta un único bloque de texto plano dentro de un `<pre>`, sin estilos ni
JavaScript interactivo, con un resumen estructurado de las últimas ~5 semanas
(plan actual, zonas de FC, actividad por tipo, lista de sesiones y las
sugerencias del motor local). Está pensado para que lo lea una automatización
externa (un Atajo de iPhone que se lo pasa a otra IA), no una persona.

Es **solo lectura**: transforma lo que ya hay en `localStorage`, no escribe
nada, no toca la copia en la nube ni el cifrado y no hace ninguna llamada de
red. Sin el parámetro, la app se comporta exactamente igual que siempre
(`js/autoexport.js` ni se carga). El interruptor está en `index.html`.

## Copia en la nube (opcional)

Apagada por defecto: quien no la active tiene la app 100% local, sin ninguna
llamada de red ni cuenta, exactamente igual que antes de que existiera esta
función. El SDK de Supabase se carga con `import()` dinámico, así que ni siquiera
llega al navegador mientras el interruptor está apagado (`js/sync.js`).

Quien la activa desde **Ajustes → Copia en la nube**:

- El asistente pregunta primero: **crear una cuenta nueva** o **iniciar sesión
  con una cuenta que ya existe**. Ambas con el mismo formulario email + contraseña
  + widget de Cloudflare Turnstile (`signUp` vs `signInWithPassword`). "Iniciar
  sesión" es imprescindible: el email de confirmación se abre en Safari, no en la
  PWA instalada, y en iOS los dos `localStorage` están aislados — tras confirmar
  en Safari hay que volver a la app e iniciar sesión ahí por separado.
- Contraseña y **no magic link** a propósito: esta app usa router de hash
  (`#/today`, `#/session/...`), con el que un magic link chocaría. Además así el
  flujo es idéntico al de `gym track` y `dieta`.
- El enlace de confirmación apunta fijo en el código a
  `https://angeelvegaa.github.io/running/` (constante `EMAIL_REDIRECT_TO`, nunca
  `window.location`). Ese origen tiene que estar en la lista de *Redirect URLs*
  del proyecto de Supabase (Authentication → URL Configuration).
- **Cifrado de extremo a extremo** con AES-GCM (Web Crypto): la clave se genera
  en el dispositivo y nunca sale de él; a Supabase solo sube el valor ya cifrado.
  Se muestra una vez como **código de recuperación**. En un dispositivo nuevo con
  datos ya en la nube se **pega** ese código para adoptar la clave existente, en
  vez de generar otra (que dejaría ilegible lo ya subido).
- `js/sync.js` sube (debounce 2 s) cada escritura de las claves sincronizables
  — `run.sessions`, `run.settings`, `run.blocks` — y al abrir la app baja y
  fusiona con **"último cambio gana"** por clave. `run.weekBannerShown` se queda
  fuera: es un aviso propio del dispositivo.
- En `localhost`/`127.0.0.1` exactos (comparación por igualdad de hostname, nunca
  por prefijo) el widget usa la Site Key de test oficial de Cloudflare; en
  cualquier otro dominio, la real (`0x4AAAAAAEroqMIQUWfcnssE`).
- El proyecto de Supabase está **compartido con la app de `dieta`**: la tabla
  `sync_data` tiene una columna `app` (aquí siempre `'running'`) para no mezclar
  datos. La seguridad va por RLS sobre `user_id`, verificada en la base de datos;
  la tabla y sus políticas ya existían — no hace falta ninguna migración.

## Tests

```bash
npm install
npm run test:e2e        # Chromium y WebKit, en vertical
```

`e2e/cloud-sync.spec.js` cubre la copia en la nube: cero red con el interruptor
apagado, el widget de Turnstile resolviendo con la clave de test, y los flujos
completos de registro y de inicio de sesión (Supabase simulado con un override
de `window.fetch`).

## Generar los iconos

```bash
node tools/make-icons.mjs
```

Solo hace falta si se cambia el diseño del icono.
