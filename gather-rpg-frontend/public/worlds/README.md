# Imágenes de mundos

**Una imagen por mundo, y nada más.** Ni las misiones ni los mapas llevan imagen:
serían demasiadas. La del mundo es la referencia visual que agrupa a sus misiones
y a su misión final.

## Formato

Cuadradas y de baja resolución: **256×256**, o 512×512 si las quieres nítidas en
pantallas retina. Formatos: png, jpg, webp.

## Nombres

Usa la `key` del mundo:

    mundo_1.png    la_ciudad.png

El nombre se escribe en **`/admin/worlds`** → editar mundo → campo *Imagen del
mundo*. La base de datos guarda únicamente ese nombre; el archivo se sirve desde
`/worlds/<archivo>` del propio frontend.

## Por qué viven aquí y no en el backend

Son pocas y estables, así que viajan versionadas en git junto al código y se
sirven desde el mismo dominio. No dependen del backend ni se pierden si se
reconstruye EC2. El precio: para añadir una hay que recompilar el frontend y
volver a subir `dist`.

## Ojo con la caché

Los archivos de `public/` se copian a `dist/` **sin hash de contenido**. Si
reemplazas una imagen conservando el nombre, los navegadores pueden seguir
sirviendo la versión antigua. Para forzar la actualización, cambia el nombre
(`mundo_1-v2.png`) y actualízalo en el admin.
