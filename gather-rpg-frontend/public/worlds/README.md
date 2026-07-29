# Arte de mundos y mapas

Imágenes **cuadradas** de baja resolución (256×256, o 512×512 si las quieres
nítidas en pantallas retina). Formatos: png, jpg, webp.

Se sirven desde el propio frontend (`/worlds/<archivo>`), viajan versionadas en
git con el build y no dependen del backend. La base de datos guarda únicamente
el **nombre del archivo**.

## Nombres

Uno por mapa, con el `scene_key` del mapa:

    castle.png    lobby.png    main.png

En `/admin/maps` se escribe ese nombre en la columna de arte. El catálogo de
mundos reutiliza automáticamente la imagen del mapa de la misión final de cada
mundo, así que **no hace falta arte aparte por mundo** (aunque en `/admin/worlds`
se puede indicar uno propio como override).

## Ojo con la caché

Los archivos de `public/` se copian a `dist/` **sin hash de contenido**. Si
reemplazas una imagen conservando el nombre, los navegadores pueden seguir
sirviendo la versión antigua. Para forzar la actualización, cambia el nombre
(`castle-v2.png`) y actualízalo en el admin.
