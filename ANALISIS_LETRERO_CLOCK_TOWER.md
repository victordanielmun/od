# Análisis — Letrero en `clock_tower`

> Analiza el letrero que el jugador ve al interactuar con un mueble en
> `http://localhost:5173/lobby?map=clock_tower` (contenido pegado por el
> usuario: "🗣️ Learning Guide: Basic Greetings"). No se hizo ningún cambio.

## Dónde vive y cómo se renderiza (contexto técnico)

El texto está guardado como `readText` en un objeto `furniture`/`furniture2`/
`furniture3` dentro de `map_configs.walls_json` del mapa `clock_tower` (ver
[LETREROS_MUNDO_PUEBLO.md](LETREROS_MUNDO_PUEBLO.md)). Al presionar E:

1. El cliente dispara `lobby-open-read-popup` con el texto crudo
   ([LobbyLayout.jsx:243-251](gather-rpg-frontend/src/layouts/LobbyLayout.jsx#L243-L251)).
2. Ese texto se manda tal cual a `POST /info-translate` para traducirlo al
   idioma nativo del jugador (cacheado por hash en el backend).
3. **Tanto el original como la traducción se renderizan con el mismo
   componente**: `<InfoMarkdown content={...} />`
   ([LobbyLayout.jsx:628](gather-rpg-frontend/src/layouts/LobbyLayout.jsx#L628)).

`InfoMarkdown` ([InfoMarkdown.jsx](gather-rpg-frontend/src/components/common/InfoMarkdown.jsx))
es un parser **mínimo y a propósito limitado**, no `react-markdown` (esa
librería sí está en el proyecto, pero solo se usa en `AdminChallenges.jsx` y
`NinjaCardHUD.jsx` — no en los letreros). Soporta exactamente:

- `#`, `##`, `###` → encabezados
- `**negrita**`, `*cursiva*`
- `![alt](url)` → imágenes
- Cada línea suelta = un `<p>`; línea vacía = espacio.

**No soporta**: listas (`* item`), tablas (`| a | b |`), citas (`> texto`),
ni reglas horizontales (`---`).

## Hallazgo 1 — El tema no corresponde al mapa

El letrero enseña **saludos** (Hello/Hi/Hey, Good morning/afternoon/evening).
Pero la misión real de `clock_tower` ("Aprende sobre la Hora") y sus 5 NPCs
enseñan otra cosa completamente distinta — números 1-12, AM/PM, preguntar y
decir la hora, expresiones de hora relativa (ver
[MISIONES_MUNDO_PUEBLO.md](MISIONES_MUNDO_PUEBLO.md)). Este contenido de
saludos **es exactamente el de `the_village` / `the_village_2`** (Joy enseña
`Hi`/`Hey there`, Sam de `the_village_2` enseña `Good morning/afternoon/
evening`) — parece un letrero pensado para esos mapas y colocado en el
equivocado, o un remanente de una iteración anterior del contenido.

## Hallazgo 2 — La sintaxis Markdown usada no la soporta el renderer real

El letrero está escrito asumiendo Markdown completo (GFM), pero
`InfoMarkdown` no lo interpreta así. Con la lógica real del parser, esto es
lo que pasa línea por línea:

| Elemento usado en el letrero | Lo que hace `InfoMarkdown` con él | Resultado visible |
|---|---|---|
| `---` (separador de sección) | No matchea el regex de encabezado (`^#{1,3}\s`), cae a párrafo normal | Aparece el texto literal `---` como una línea más |
| `* **Hello:** Significa "Hola"...` (lista) | El `*` inicial no se reconoce como viñeta; solo se procesa el `**negrita**` que sigue | Se ve `* ` **pegado** antes del texto en negrita — un asterisco suelto, no una viñeta |
| `> 💡 **Dato de aprendizaje...**` (cita) | El `> ` no se elimina, es texto plano | Aparece literalmente `> 💡 Dato...` con el `>` visible |
| Tabla completa (`| Saludo | Significado | ¿Cuándo? | Tipo |` + fila separadora `| :--- | :--- |...|` + filas de datos) | Cada fila es una línea sin `#`, se procesa como párrafo | Cada fila se ve como una sola línea larga con todos los `\|` literales — incluida la fila separadora `:---:---:---` como ruido visual — dentro de un popup de `max-w-lg` (~450px), sin scroll horizontal |
| `* *"Hi, good morning!"* * *"Hello, good afternoon!"*` (última sección) | El regex de énfasis empareja `*...*` de izquierda a derecha sin saber que dos de esos asteriscos eran viñetas, no cursiva | Emparejamiento cruzado impredecible — probablemente una frase se trague de más o de menos texto en cursiva |

Es decir: los encabezados (`##`) y las negritas simples sí se ven bien —
pero la tabla, las listas y la cita (que son gran parte del contenido) se
van a ver como texto plano con símbolos de Markdown sueltos, no como la
guía prolija que se ve al leer el `.md` fuente.

### Riesgo adicional (no confirmado, solo señalado)

El texto completo —con `|`, `*`, `>`, `---` incluidos— se manda tal cual a
`POST /info-translate` para el jugador que no tenga inglés como nativo. Un
LLM de traducción puede alterar esos símbolos de formato al traducir (mover
un `**` de lugar, no preservar una tabla), lo que agravaría el problema
específicamente en la versión traducida. No lo verifiqué contra el backend
real — queda como hipótesis a confirmar si se decide tocar este letrero.

## Qué decidir (no ejecutado)

1. **Tema**: ¿mover este contenido de saludos a `the_village`/
   `the_village_2` (donde sí corresponde) y ponerle a `clock_tower` un
   letrero de horas/números? Ya existe un borrador listo y en sintaxis
   compatible con `InfoMarkdown` para eso en
   [LETREROS_MUNDO_PUEBLO.md](LETREROS_MUNDO_PUEBLO.md).
2. **Formato**: si se quiere conservar contenido con tablas/listas/citas en
   general (no solo este letrero), hay dos caminos independientes:
   - Reescribir el contenido a la sintaxis mínima que sí soporta
     `InfoMarkdown` (encabezados + negrita/cursiva + párrafos sueltos, sin
     tablas ni listas) — cambio de contenido, no de código.
   - O ampliar `InfoMarkdown.jsx` para soportar listas/tablas/citas — cambio
     de código, afecta a **todos** los letreros existentes del juego, no
     solo este.
