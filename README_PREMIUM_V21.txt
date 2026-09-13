DIGITURNO JURÍDICO UCC PREMIUM V2.1
====================================

Versión final de ajuste funcional y visual para evaluación/entrega.

CAMBIOS PRINCIPALES
-------------------
1. Kiosco:
   - Permite registrar el nombre del usuario.
   - Permite marcar atención prioritaria.
   - Para Asesoría Jurídica permite dirigir el turno a Asesor 1, Asesor 2, Asesor 3 o Asesor 4.
   - Si no se selecciona asesor, el turno queda disponible para cualquiera de los 4 asesores jurídicos.

2. Panel Asesor:
   - El asesor ve los turnos generales de sus servicios.
   - Para Asesoría Jurídica, también ve los turnos dirigidos específicamente a él.
   - Si está atendiendo un turno de Asesoría Jurídica, puede redireccionarlo a otro asesor jurídico.
   - El botón Usuario presente mantiene el comportamiento aprobado: pasa el turno a En atención y repite el llamado en Pantalla TV.

3. Pantalla TV:
   - Mantiene la lógica aprobada:
     En espera -> Llamado -> En atención -> Atendido/Ausente.
   - Los turnos generados aparecen como En espera.
   - El módulo/punto aparece solo cuando el asesor llama el turno.
   - El TTS anuncia turno, nombre y punto de atención.

4. Diseño:
   - Se fortaleció la homogeneidad visual del Kiosco y Panel Asesor.
   - Botones de acción del asesor con tamaño uniforme.
   - Historial del asesor con paginador.
   - Línea institucional UCC + Consultorio Jurídico.

ARCHIVOS MODIFICADOS
--------------------
- js/kiosco.js
- js/asesor.js
- css/styles.css
- supabase/migracion_v21_final_premium.sql

ANTES DE PROBAR
---------------
1. Conservar las credenciales reales en js/supabase-config.js.
2. Ejecutar en Supabase SQL Editor:
   supabase/migracion_v21_final_premium.sql
3. Subir los archivos a GitHub.
4. Recargar con Ctrl + F5.

PRUEBA RECOMENDADA
------------------
1. Ingresar a kiosco.html.
2. Seleccionar Asesoría Jurídica.
3. Escribir nombre del usuario.
4. Marcar prioridad, si aplica.
5. Seleccionar Asesor 2 o dejar “Cualquiera de los 4 asesores”.
6. Generar turno.
7. Validar que el turno aparece:
   - Si fue dirigido: solo en el asesor destino.
   - Si fue libre: en cualquiera de los asesores 1 a 4.
8. Llamar el turno desde el asesor.
9. Validar Pantalla TV con código, nombre y módulo.
10. Probar Usuario presente.
11. Probar redireccionamiento a otro asesor.
12. Finalizar y validar que desaparece de la Pantalla TV.
