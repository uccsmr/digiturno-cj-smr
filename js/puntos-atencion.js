import { adminOnly } from './layout.js';
import { $, $$, supabase, escapeHtml, fillForm, jsonAttr } from './core.js';

adminOnly('puntos', renderPoints);

async function renderPoints(c){
  const { data = [], error } = await supabase.from('puntos_atencion').select('*').order('nombre_punto');
  if (error) {
    c.innerHTML = `<div class="alert alert-danger">${escapeHtml(error.message)}</div>`;
    return;
  }

  c.innerHTML = `<div class="topbar"><div><h1>Puntos de atención</h1><p>Módulos, consultorios, ventanillas o salas de atención.</p></div></div>
  <section class="grid two-columns">
    <article class="panel"><h2>Crear / editar</h2>
      <form id="pointForm" class="form-stack">
        <input type="hidden" name="id_punto">
        <label>Nombre<input name="nombre_punto" required></label>
        <label>Descripción<textarea name="descripcion"></textarea></label>
        <label>Estado<select name="estado"><option>Activo</option><option>Inactivo</option></select></label>
        <button class="btn btn-primary">Guardar</button>
        <button class="btn btn-outline" type="button" id="btnClear">Limpiar</button>
      </form>
    </article>
    <article class="panel"><h2>Listado</h2><div class="table-responsive"><table><thead><tr><th>Punto</th><th>Estado</th><th></th></tr></thead><tbody>
      ${data.map(p => `<tr><td><b>${escapeHtml(p.nombre_punto)}</b><br><span class="muted">${escapeHtml(p.descripcion || '')}</span></td><td>${escapeHtml(p.estado)}</td><td><button class="btn btn-small btn-outline" data-edit-point="${jsonAttr(p)}">Editar</button></td></tr>`).join('')}
    </tbody></table></div></article>
  </section>`;

  $('#pointForm').addEventListener('submit', savePoint);
  $('#btnClear').addEventListener('click', () => $('#pointForm').reset());
  $$('[data-edit-point]').forEach(b => b.addEventListener('click', () => fillForm('pointForm', JSON.parse(b.dataset.editPoint))));
}

async function savePoint(e){
  e.preventDefault();
  const fd = Object.fromEntries(new FormData(e.target));
  const id = fd.id_punto;
  delete fd.id_punto;
  const query = id
    ? supabase.from('puntos_atencion').update(fd).eq('id_punto', id)
    : supabase.from('puntos_atencion').insert(fd);
  const { error } = await query;
  if (error) return alert(error.message);
  await renderPoints($('#content'));
}
