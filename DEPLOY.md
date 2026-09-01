# Desplegar en GitHub Pages

La app usa **rutas relativas** en todas partes (manifest, service worker,
`<link>`, `<script>`), así que funciona en cualquier subruta sin tocar nada:
`https://<usuario>.github.io/running/`.

## 1. Subir el código (lo hace Claude, o tú)

```bash
cd "ruta/al/proyecto/running app"
git init -b main
git add -A
git commit -m "Running: PWA de seguimiento de carrera con módulos ES"
gh repo create running --public --source=. --remote=origin --push
```

## 2. Activar GitHub Pages (esto lo haces tú en la web)

1. Abre `https://github.com/<usuario>/running`
2. **Settings** (pestaña superior) → menú lateral **Pages**
3. En **Build and deployment**:
   - **Source**: `Deploy from a branch`
   - **Branch**: `main` — carpeta `/ (root)` → **Save**
4. Espera ~1 minuto. En la misma página aparecerá:
   `Your site is live at https://<usuario>.github.io/running/`
5. Abre esa URL en el móvil e instálala:
   - **iPhone (Safari)**: botón Compartir → **Añadir a pantalla de inicio**
   - **Android (Chrome)**: menú ⋮ → **Instalar aplicación**

## 3. Comprobar que quedó bien

- Abre la URL, pon el móvil en modo avión → la app sigue abriendo (service worker).
- Instálala y ábrela: al confirmar cosas (borrar, marcar no realizada...) sale un
  cuadro propio dentro de la app, nunca un diálogo del sistema en blanco.

## Publicar cambios más adelante

```bash
# edita lo que sea; si tocaste HTML/CSS/JS, sube la versión del cache en sw.js:
#   const VERSION = 'v2';
git add -A && git commit -m "..." && git push
```

GitHub Pages re-despliega solo en 1-2 min. La próxima vez que abras la app
instalada, el service worker detecta la versión nueva, **se actualiza y recarga
sola** (el guardado es en cada interacción, no se pierde nada).

### Si un móvil se queda con una versión vieja

Cierra del todo la app instalada (deslízala fuera del multitarea) y vuelve a
abrirla un par de veces; o abre la URL normal en el navegador y desde ahí
*Ajustes del sitio → Borrar datos*, y reinstala.
