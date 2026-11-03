# Matemundo (MathLabs)

Juego web de matemáticas para niños, desde preescolar (5 años) hacia secundaria. El niño avanza **solo cuando demuestra dominio**, con potenciadores, combos, mascota y un guardado local.

> Esta versión incluye los **11 mundos** (preescolar a 12.º grado: 55 regiones y 55 habilidades). Pasa por conteo, sumas y restas, tablas, fracciones, decimales, razones, negativos, ecuaciones, sistemas, factorización, cuadráticas, funciones, pendiente, exponentes, trigonometría, logaritmos, progresiones, conteo y derivadas.

## Cómo se juega

- **Mapa**: 11 mundos, 5 regiones cada uno. Cada región tiene 3 niveles de 8 preguntas y un **Reto del Guardián**.
- **Energía ⚡ y Game Over** (solo en niveles): hay 5 energías que se conservan entre partidas. Cada error gasta una; con 0 es **Game Over**, y la pantalla muestra los errores con su respuesta correcta. No se puede empezar un nivel sin energía: se recarga **practicando** (5 preguntas fáciles, cada acierto devuelve 1 ⚡), esperando (1 ⚡ cada 5 minutos) o con bonos (nivel perfecto +1 ⚡, bono por rapidez +1 ⚡, cofre del día +2 ⚡, completar un mundo = energía llena). El Guardián y los repasos no gastan energía.
- **Combos**: cada 3 aciertos seguidos se activa la **Chispa** (la siguiente vale doble). Cada 5, el **Rayo** devuelve 1 ⚡.
- **Cronómetro y bonos por rapidez** (solo en niveles): el reloj cuenta el tiempo que el niño tarda en responder (una pausa larga cuenta 60 s como máximo). La meta depende del mundo (de 15 s por pregunta en el 1 a 40 s en el 11; +10 s por pregunta escrita). Con a lo sumo 1 error: terminar en la meta da el bono **Veloz** (+2 ⭐, +1 ⚡) y en el 60 % de la meta el bono **Rayo** (+4 ⭐, +1 ⚡ y un poder). Se guarda el mejor tiempo de cada nivel. El Guardián no se cronometra.
- **Resumen y premio del mundo**: al vencer por primera vez al Guardián de la quinta región se gana la medalla del mundo (oro, plata o bronce según las estrellas), +20 ⭐, un poder de cada tipo y la energía llena. El resumen (estrellas, Guardianes, dominio y tiempos) se puede volver a abrir desde el mapa; al terminar el mundo 11 aparece la celebración final.
- **Inicio**: el botón 🏠 está en el mapa y en cada pantalla; «Continuar como …» entra directo al mapa.
- **Seguir jugando**: una tarjeta grande en el mapa abre directamente lo siguiente del camino (el primer nivel sin estrellas o el Guardián pendiente). En el sendero, la región actual tiene la marca «¡Aquí!».
- **Misiones del día**: tres misiones al día (por ejemplo, «Responde bien 15 preguntas», «Juega un Contrarreloj», «Acierta 5 seguidas»), siempre las mismas durante el día. Cada una da +3 ⭐ y +1 ⚡ al cobrarla; cobrar las tres da un cofre con +5 ⭐ y un poder.
- **Contrarreloj**: 60 segundos para acertar todo lo posible con lo que el niño ya conoce (las primeras 8 fáciles). Un error no detiene: se ve la respuesta y sigue. Cada acierto vale ⭐ (tope de 15), guarda el récord y no gasta energía.
- **Logros y «Mi progreso»**: 21 logros a largo plazo (niveles, perfectos, aciertos, rachas, bonos, Guardianes, medallas, dominio…), +5 ⭐ cada uno, con barra de avance. La pantalla muestra aciertos, precisión, niveles, mejor racha, Guardianes y récord.
- **Música**: tres temas compuestos con Web Audio (mapa, niveles y Contrarreloj), en otra tonalidad en cada mundo, sin archivos de audio. Suena tras el primer toque, se pausa al salir de la app y se apaga con 🎵 en el mapa o en Familias.
- **Celebración y vibración**: confeti al lograr un nivel perfecto, un récord, un bono Rayo, un logro o un mundo (se apaga con «reducir movimiento»). En el móvil vibra al responder; se desactiva en el panel de familias.
- **Respuesta escrita**: en el nivel 3 de las habilidades de cálculo (ecuaciones, descuentos, sistemas, funciones, trigonometría, logaritmos, progresiones, conteo, derivadas…), y en sus Guardianes, el niño escribe el resultado en vez de elegirlo (adivinar no sirve). Solo se aceptan números enteros; un texto inválido avisa y no cuenta como intento. La prueba de nivel y los repasos siguen con opciones.
- **Dificultad adaptativa** (solo en niveles): empieza según el historial de la habilidad (más reto si ya es sólida, más calma si le cuesta). Con 3 aciertos seguidos sube un punto («🚀 Reto extra») y con 2 errores de 3 baja, siempre a ±1 de la dificultad del nivel. El Guardián **no se adapta**: es el examen. Los repasos priorizan lo que más cuesta, y el panel de familias marca con 🔧 las habilidades que conviene reforzar.
- **Potenciadores**: Lupa (tacha 2 opciones), Pista mágica y Escudo (un error no rompe la racha). Una vez por nivel; se ganan jugando.
- **Evidencia de dominio**: se sube de región solo al vencer al Guardián (10 preguntas **sin ayudas**, 9 aciertos para pasar). Las habilidades se confirman como «Dominadas» con **repasos espaciados** (1, 3, 7 y 14 días).
- **Prueba de nivel** (a partir de 7 años al crear el explorador, o desde el mapa): 5 preguntas por mundo sin ayudas; con 4 aciertos se salta al siguiente mundo y se detiene en el primero que no domine. No regala estrellas: los temas saltados quedan como «Familiar» y vuelven como repasos (5 por día) para confirmar el dominio. Solo sube el progreso, nunca lo baja.
- **Estrellas** para la tienda (trajes y pegatinas), cofre diario y racha con un congelador semanal. Nunca hay compras con dinero real.
- **Tiempo de juego**: límite por sesión configurable (10 a 45 min) con pantalla de descanso.
- **Familias**: el panel y las acciones de adultos están tras una puerta de multiplicar (6 a 9 × 6 a 9). Allí hay progreso por habilidad, últimos errores, copia de seguridad y ajustes.

## Privacidad

Sin anuncios, sin analíticas y sin peticiones a otros sitios (la política CSP de `public/_headers` lo impide). Solo se guarda un apodo y un avatar en el `localStorage` del navegador. Hay que usar un apodo, nunca el nombre real.

## Desarrollo

Necesita Node 22.18 o superior. **No hay dependencias en tiempo de ejecución ni para compilar**: Node quita los tipos de TypeScript con `stripTypeScriptTypes`.

```bash
npm start           # compila a dist/ y sirve en http://localhost:4173
npm run build       # solo compila
npm test            # pruebas del motor (node:test)
npm run typecheck   # tsc --noEmit (requiere `npm install` para tener typescript)
npm run test:e2e    # prueba en navegador real (requiere Playwright y Chrome)
```

La URL admite `?seed=N` (partidas reproducibles) y `?e2e=1` (gancho `window.__matemundo` para pruebas).

### Estructura

```
src/engine/   motor sin interfaz: generadores de preguntas, sesión, dominio, progreso y guardado
src/data/     mundos, regiones, tienda
src/ui/       vistas (HTML como texto), clase App, sonido y voz
assets/       íconos y splash para el APK (Capacitor)
public/       manifest PWA, service worker, íconos, fuente Fredoka (OFL) y _headers
scripts/      build.mjs y serve.mjs
tests/        pruebas del motor y prueba E2E
```

Las pruebas recalculan cada respuesta con un solucionador independiente para 55 habilidades × 3 dificultades × 300 semillas.

## Publicar en Cloudflare Pages (gratis)

**Desde el panel (recomendado):** Workers y Pages → Crear → Pages → Conectar con Git → elige este repositorio.
- Comando de compilación: `npm run build`
- Directorio de salida: `dist`
- Versión de Node: el archivo `.node-version` ya pide Node 22; si el panel pregunta, usa la variable `NODE_VERSION=22`.

Cada `git push` a `main` vuelve a publicar.

**Con la terminal (una sola vez, necesita Node 22 y una cuenta de Cloudflare):**

```bash
git clone https://github.com/YazterFranco/MathLabs.git && cd MathLabs
npm install
npx wrangler login          # abre el navegador para autorizar tu cuenta
npm run cf:create           # crea el proyecto «matemundo» en Cloudflare Pages
npm run deploy              # compila y sube dist/ → https://matemundo.pages.dev
```

Para publicar cambios después: `npm run deploy`.

## Generar el APK de Android

El juego se empaqueta con [Capacitor](https://capacitorjs.com/): los archivos van **dentro** de la app, así que funciona sin internet y no necesita configurar dominios. Para un juego infantil también es la vía más segura con las políticas de Google Play para apps de niños (una TWA abre el sitio web dentro de Chrome).

**Opción 1 (sin instalar nada): GitHub Actions.** En el repositorio, pestaña **Actions → «APK de Android» → Run workflow** (opcionalmente escribe las novedades que verá el niño). En unos 5 minutos:

- el APK firmado queda en **Releases** (`matemundo-v1.0.N.apk`),
- y se publica en `https://matemundo.pages.dev/descargas/matemundo.apk` junto con `version.json`.

Ábrelo en Android (pedirá permitir «instalar apps desconocidas»).

**Actualizaciones.** Cada compilación se firma con la misma llave y sube el número de versión, así la nueva se instala encima de la anterior **sin perder el progreso**. La app consulta `version.json` al abrirse (y al volver a ella, cada 6 horas como mucho); si hay una versión más nueva, el mapa muestra «¡Nueva versión!» con el botón **Actualizar**, que descarga el APK en el navegador del teléfono. La versión web se actualiza sola y no muestra el aviso.

La llave vive en dos secretos del repositorio (Settings → Secrets and variables → Actions): `ANDROID_KEYSTORE_BASE64` (el archivo `.jks` en base64) y `ANDROID_KEYSTORE_PASSWORD` (alias `matemundo`). Sin ellos el workflow genera un APK de prueba que no se puede actualizar encima. **Guarda una copia de la llave**: si se pierde, las apps instaladas no podrán recibir actualizaciones y habrá que desinstalar.

**Opción 2 (en tu computadora).** Necesitas Node 22, JDK 21 y Android Studio:

```bash
npm run build
npm install --no-save @capacitor/core@7 @capacitor/cli@7 @capacitor/android@7 @capacitor/assets@3
npx cap add android
npx capacitor-assets generate --android
npx cap sync android
npx cap open android      # en Android Studio: Build → Build APK(s)
```

Los íconos y la pantalla de inicio salen de `assets/` (icono 1024 px, primer plano, fondo y splash).

**Para Google Play** se sube un AAB firmado (`./gradlew bundleRelease` y firmar con la misma llave). La cuenta de desarrollador de Google Play cuesta 25 USD (pago único); al ser para niños, hay que completar el formulario de «Familias» y la política de privacidad (el juego no recoge datos: todo queda en el dispositivo).

**Alternativa rápida (TWA):** [PWABuilder](https://www.pwabuilder.com/) genera un paquete Android a partir de `https://matemundo.pages.dev`. Abre el sitio en Chrome, pero necesita publicar `/.well-known/assetlinks.json` con la huella de tu llave.

## Pendiente

Sincronización en la nube con cuenta de familia (hoy el progreso vive en el dispositivo), migrar el guardado a IndexedDB si crece.
