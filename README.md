# Matemundo (MathLabs)

Juego web de matemáticas para niños, desde preescolar (5 años) hacia secundaria. El niño avanza **solo cuando demuestra dominio**, con potenciadores, combos, mascota y un guardado local.

> Esta versión incluye los **mundos 1 a 8** (preescolar a 7.º grado: 40 regiones y 40 habilidades, hasta fracciones, decimales, razones, números negativos, ecuaciones y descuentos). Los mundos 9 a 11 (hasta 12.º grado) aparecen como «Próximamente».

## Cómo se juega

- **Mapa**: 8 mundos, 5 regiones cada uno. Cada región tiene 3 niveles de 8 preguntas y un **Reto del Guardián**.
- **Corazones y combos** (solo en niveles): 3 corazones. Cada 3 aciertos seguidos se activa la **Chispa** (la siguiente vale doble). Cada 5, el **Rayo** devuelve un corazón.
- **Respuesta escrita**: en el nivel 3 de ecuaciones y descuentos, y en sus Guardianes, el niño escribe el resultado en vez de elegirlo (adivinar no sirve). Solo se aceptan números enteros; un texto inválido avisa y no cuenta como intento. La prueba de nivel y los repasos siguen con opciones.
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
public/       manifest PWA, service worker, icono y _headers
scripts/      build.mjs y serve.mjs
tests/        pruebas del motor y prueba E2E
```

Las pruebas recalculan cada respuesta con un solucionador independiente para 40 habilidades × 3 dificultades × 300 semillas.

## Publicar en Cloudflare Pages (gratis)

**Desde el panel (recomendado):** Workers y Pages → Crear → Pages → Conectar con Git → elige este repositorio.
- Comando de compilación: `npm run build`
- Directorio de salida: `dist`
- Variable de entorno: ninguna. Si te pide versión de Node, usa `NODE_VERSION=22`.

Cada `git push` a `main` vuelve a publicar.

**Con Wrangler:** `npm install` y luego `npx wrangler login` y `npm run deploy`.

## Pendiente

Mundos 9 a 11 (álgebra, funciones, geometría analítica, trigonometría…), sincronización en la nube con cuenta de familia (hoy el progreso vive en el dispositivo), y migrar el guardado a IndexedDB si crece.
