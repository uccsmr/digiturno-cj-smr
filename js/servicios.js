import { adminOnly } from './layout.js';
import { $, $$, supabase, escapeHtml, fillForm, jsonAttr } from './core.js';

adminOnly('servicios', renderServices);

async function renderServices(c){
  const { data = [], error } = await supabase.from('servicios').select('*').order('nombre_servicio');
  if (error) {
    c.innerHTML = `<div class="alert alert-danger">${escapeHtml(error.message)}</div>`;
    return;
  }

  c.innerHTML = `<div class="topbar"><div><h1>Servicios</h1><p>Gestión de servicios y prefijos visibles en el Kiosco.</p></div></div>
  <section class="grid two-columns">
    <article class="panel"><h2>Crear / editar</h2>
      <form id="serviceForm" class="form-stack">
        <input type="hidden" name="id_servicio">
        <label>Nombre<input name="nombre_servicio" required></label>
        <label>Prefijo<input name="prefijo" maxlength="8" required></label>
        <label>Descripción<textarea name="descripcion"></textarea></label>
        <label>Color<input type="color" name="color" value="#0A84FF"></label>
        <label>Estado<select name="estado"><option>Activo</option><option>Inactivo</option></select></label>
        <button class="btn btn-primary">Guardar</button>
        <button class="btn btn-outline" type="button" id="btnClear">Limpiar</button>
      </form>
    </article>
    <article class="panel"><h2>Listado</h2><div class="table-responsive"><table><thead><tr><th>Servicio</th><th>Prefijo</th><th>Estado</th><th></th></tr></thead><tbody>
      ${data.map(s => `<tr><td>${escapeHtml(s.nombre_servicio)}<br><span class="muted">${escapeHtml(s.descripcion || '')}</span></td><td><b>${escapeHtml(s.prefijo)}</b></td><td>${escapeHtml(s.estado)}</td><td><button class="btn btn-small btn-outline" data-edit-service="${jsonAttr(s)}">Editar</button></td></tr>`).join('')}
    </tbody></table></div></article>
  </section>`;

  $('#serviceForm').addEventListener('submit', saveService);
  $('#btnClear').addEventListener('click', () => $('#serviceForm').reset());
  $$('[data-edit-service]').forEach(b => b.addEventListener('click', () => fillForm('serviceForm', JSON.parse(b.dataset.editService))));
}

async function saveService(e){
  e.preventDefault();
  const fd = Object.fromEntries(new FormData(e.target));
  fd.prioridad = Number(fd.prioridad || 1);
  const id = fd.id_servicio;
  delete fd.id_servicio;
  const query = id
    ? supabase.from('servicios').update(fd).eq('id_servicio', id)
    : supabase.from('servicios').insert(fd);
  const { error } = await query;
  if (error) return alert(error.message);
  await renderServices($('#content'));
}
