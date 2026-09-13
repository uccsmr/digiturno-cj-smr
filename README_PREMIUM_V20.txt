DIGITURNO JURÍDICO UCC - VERSIÓN PREMIUM V2.0

Cambios principales:
1. Pantalla TV reemplaza video por carrusel de imágenes institucionales.
2. Kiosco solicita nombre del usuario antes de generar el turno.
3. El nombre aparece en Pantalla TV, Panel Asesor y Reportes.
4. El TTS anuncia: turno + nombre + punto de atención.
5. Se mantiene lógica clara: En espera -> Llamado -> En atención -> Atendido/Ausente.
6. Se refuerza homogeneidad visual y se reduce el parpadeo de carga entre páginas.
7. Se conserva estructura por páginas HTML + JS.

Archivos importantes:
- kiosco.html / js/kiosco.js
- pantalla.html / js/pantalla.js / css/pantalla-tv.css
- asesor.html / js/asesor.js
- dashboard.html / js/dashboard.js / js/layout.js / css/admin-dashboard.css
- configuracion.html / js/configuracion.js
- css/styles.css
- supabase/migracion_v20_premium.sql

Pasos de actualización:
1. Hacer copia/backup del repositorio actual.
2. Subir/reemplazar los archivos de esta versión al nuevo repositorio o rama.
3. Conservar tus valores reales en js/supabase-config.js si ya tenías el proyecto conectado.
4. En Supabase SQL Editor ejecutar: supabase/migracion_v20_premium.sql
5. En Configuración, registrar imágenes del carrusel, una ruta o URL por línea.
6. Recargar con Ctrl + F5.

Rutas sugeridas para imágenes:
assets/img/carrusel-1.jpg
assets/img/carrusel-2.jpg
assets/img/carrusel-3.jpg

Nota: el sistema ya no depende del video Balance_social_2025.mp4 para pantalla TV.
