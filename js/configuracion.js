
import { adminOnly } from './layout.js';
import { $, supabase, appConfig, loadConfig, escapeHtml } from './core.js';

adminOnly('configuracion', renderConfig);

async function renderConfig(c){
  await loadConfig();
  c.innerHTML = `<div class="topbar"><div><h1>Configuración</h1><p>Identidad visual, pantalla TV, carrusel de imágenes y franja inferior.</p></div></div>
  <section class="panel"><form id="configForm" class="form-grid">
    <label>Nombre entidad<input name="nombre_entidad" value="${escapeHtml(appConfig.nombre_entidad || '')}"></label>
    <label>Logo menú<input name="logo" value="${escapeHtml(appConfig.logo || '')}"></label>
    <label>Logo pantalla / Consultorio<input name="logo_pantalla" value="${escapeHtml(appConfig.logo_pantalla || '')}"></label>
    <label>Tiempo actualización ms<input type="number" name="tiempo_actualizacion" value="${appConfig.tiempo_actualizacion || 3000}"></label>
    <label class="full">Mensaje pantalla<textarea name="mensaje_pantalla">${escapeHtml(appConfig.mensaje_pantalla || '')}</textarea></label>
    <label class="full">Imágenes del carrusel, una ruta o URL por línea<textarea name="imagenes_pantalla" rows="5" placeholder="assets/img/imagen-1.jpg&#10;assets/img/imagen-2.jpg">${escapeHtml(appConfig.imagenes_pantalla || '')}</textarea></label>
    <label class="full">Franja inferior<textarea name="franja_inferior" rows="2">${escapeHtml(appConfig.franja_inferior || '')}</textarea></label>
    <div class="full action-row"><button class="btn btn-primary">Guardar configuración</button></div>
  </form></section>`;
  $('#configForm').addEventListener('submit', saveConfig);
}

async function saveConfig(e){
  e.preventDefault();
  const fd = Object.fromEntries(new FormData(e.target));
  fd.id_configuracion = 1;
  fd.tiempo_actualizacion = Number(fd.tiempo_actualizacion || 3000);
  const { error } = await supabase.from('configuracion').upsert(fd, { onConflict: 'id_configuracion' });
  if (error) return alert(error.message);
  await loadConfig();
  alert('Configuración guardada.');
}
