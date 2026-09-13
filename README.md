# Digiturno Jurídico UCC · Supabase + GitHub Pages V1.2

Versión modular del sistema de turnos para el Consultorio Jurídico y Centro de Conciliación.

## Cambio principal de esta versión

La aplicación deja de funcionar como una sola vista dentro de `index.html` y queda organizada por páginas HTML independientes, cada una con su archivo JavaScript complementario.

```text
index.html
login.html
dashboard.html
kiosco.html
pantalla.html
asesor.html
servicios.html
puntos-atencion.html
usuarios.html
reportes.html
configuracion.html

css/styles.css
js/core.js
js/layout.js
js/login.js
js/dashboard.js
js/kiosco.js
js/pantalla.js
js/asesor.js
js/servicios.js
js/puntos-atencion.js
js/usuarios.js
js/reportes.js
js/configuracion.js
js/supabase-config.js
```

## Configuración inicial

1. Cree o use su proyecto en Supabase.
2. Ejecute en Supabase SQL Editor, en este orden:

```text
supabase/schema.sql
supabase/rls_policies.sql
```

3. Cree el administrador en Supabase Authentication.
4. Copie el UUID del administrador y ejecute `supabase/bootstrap_admin.sql`, reemplazando el UUID y correo si aplica.
5. Configure `js/supabase-config.js`:

```js
export const SUPABASE_URL = 'https://TU-PROYECTO.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_o_anon_key';
export const SUPABASE_CONFIG_READY = true;
```

6. Suba el contenido del proyecto al repositorio de GitHub Pages.

## Migración para una instalación que ya existe

Si ya tiene la versión anterior funcionando, ejecute:

```text
supabase/migracion_v12_paginas_html_usuarios.sql
```

Esta migración realiza estos ajustes:

- habilita o repara políticas RLS de servicios y puntos de atención;
- crea el trigger para que los perfiles se creen automáticamente al crear usuarios en Supabase Authentication;
- reemplaza el servicio Bienestar por Derecho de Familia;
- agrega servicios jurídicos base y puntos de atención base;
- conserva las tablas y datos existentes.

## Usuarios sin escribir manualmente el UUID

En esta versión, el panel `usuarios.html` ya no pide escribir manualmente el UUID como campo de texto principal.

Flujo recomendado:

1. Cree el usuario en Supabase Authentication.
2. El trigger `crear_perfil_usuario()` crea automáticamente el perfil en `public.perfiles`.
3. Entre a `usuarios.html`.
4. Seleccione el usuario existente.
5. Asigne rol, punto de atención, estado y servicios.

## Páginas principales

- `login.html`: acceso para administradores y asesores.
- `dashboard.html`: resumen administrativo.
- `kiosco.html`: generación pública de turnos.
- `pantalla.html`: pantalla TV con llamado, voz y video institucional.
- `asesor.html`: llamado, repetición, atención, cierre y ausente.
- `servicios.html`: administración de servicios del Kiosco.
- `puntos-atencion.html`: administración de módulos, consultorios o ventanillas.
- `usuarios.html`: perfiles, roles, puntos y servicios asignados.
- `reportes.html`: indicadores y exportación CSV.
- `configuracion.html`: identidad institucional, videos, mensaje y franja inferior.

## Observación importante

GitHub Pages no ejecuta PHP ni MySQL. Esta versión usa HTML, CSS y JavaScript en GitHub Pages, y Supabase gestiona autenticación, base de datos PostgreSQL, políticas RLS y actualizaciones en tiempo real.


## Premium V2.1

Incluye nombre de usuario, prioridad, direccionamiento opcional de Asesoría Jurídica a Asesor 1-4, redirección entre asesores jurídicos, paginador en historial del asesor y ajustes de homogeneidad visual. Ejecutar `supabase/migracion_v21_final_premium.sql` antes de probar.
