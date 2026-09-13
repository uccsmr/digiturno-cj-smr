import { adminOnly } from './layout.js';
import { $, $$, supabase, escapeHtml } from './core.js';

let profilesCache = [];
let assignmentMap = new Map();
let servicesCache = [];

adminOnly('usuarios', renderUsers);

async function renderUsers(c){
  const [{ data: profiles = [], error: e1 }, { data: points = [], error: e2 }, { data: services = [], error: e3 }, { data: assigned = [], error: e4 }] = await Promise.all([
    supabase.from('perfiles').select('*, puntos_atencion(nombre_punto)').order('nombre'),
    supabase.from('puntos_atencion').select('*').eq('estado', 'Activo').order('nombre_punto'),
    supabase.from('servicios').select('*').eq('estado', 'Activo').order('nombre_servicio'),
    supabase.from('usuario_servicio').select('id_usuario,id_servicio')
  ]);

  const firstError = e1 || e2 || e3 || e4;
  if (firstError) {
    c.innerHTML = `<div class="alert alert-danger">${escapeHtml(firstError.message)}</div>`;
    return;
  }

  profilesCache = profiles;
  servicesCache = services;
  assignmentMap = new Map();
  assigned.forEach(row => {
    if (!assignmentMap.has(row.id_usuario)) assignmentMap.set(row.id_usuario, new Set());
    assignmentMap.get(row.id_usuario).add(row.id_servicio);
  });

  c.innerHTML = `<div class="topbar"><div><h1>Usuarios</h1><p>Perfiles, roles, puntos de atención y servicios asignados.</p></div></div>
  <section class="panel">
    <div class="alert alert-info">Cree primero el usuario en <b>Supabase Authentication</b>. Con la migración V1.2, el perfil se crea automáticamente y aquí solo debe asignar rol, punto y servicios.</div>
    <form id="profileForm" class="form-grid">
      <label>Usuario existente
        <select name="id_usuario" required>
          <option value="">Seleccione un perfil</option>
          ${profiles.map(p => `<option value="${escapeHtml(p.id_usuario)}">${escapeHtml(p.nombre || p.email || p.id_usuario)} · ${escapeHtml(p.email || '')}</option>`).join('')}
        </select>
      </label>
      <label>Nombre<input name="nombre" required></label>
      <label>Email<input name="email" type="email"></label>
      <label>Rol<select name="rol"><option>Administrador</option><option>Asesor</option><option>Pantalla</option></select></label>
      <label>Punto<select name="id_punto_atencion"><option value="">Sin punto</option>${points.map(p => `<option value="${p.id_punto}">${escapeHtml(p.nombre_punto)}</option>`).join('')}</select></label>
      <label>Estado<select name="estado"><option>Activo</option><option>Inactivo</option></select></label>
      <div class="full"><b>Servicios asignados</b><div class="checkbox-grid">${services.map(s => `<label><input type="checkbox" name="servicios" value="${s.id_servicio}"> ${escapeHtml(s.nombre_servicio)}</label>`).join('')}</div></div>
      <div class="full action-row"><button class="btn btn-primary">Guardar cambios del perfil</button><button class="btn btn-outline" type="button" id="btnClear">Limpiar</button></div>
    </form>
  </section>
  <section class="panel"><h2>Perfiles registrados</h2><div class="table-responsive"><table><thead><tr><th>Usuario</th><th>Rol</th><th>Punto</th><th>Estado</th><th></th></tr></thead><tbody>
    ${profiles.map(p => `<tr><td><b>${escapeHtml(p.nombre)}</b><br><span class="muted">${escapeHtml(p.email || p.id_usuario)}</span></td><td>${escapeHtml(p.rol)}</td><td>${escapeHtml(p.puntos_atencion?.nombre_punto || '-')}</td><td>${escapeHtml(p.estado)}</td><td><button class="btn btn-small btn-outline" data-user="${escapeHtml(p.id_usuario)}">Editar</button></td></tr>`).join('') || '<tr><td colspan="5">No hay perfiles creados.</td></tr>'}
  </tbody></table></div></section>`;

  $('#profileForm').addEventListener('submit', saveProfile);
  $('#profileForm').elements.id_usuario.addEventListener('change', e => hydrateForm(e.target.value));
  $('#btnClear').addEventListener('click', clearForm);
  $$('[data-user]').forEach(b => b.addEventListener('click', () => {
    $('#profileForm').elements.id_usuario.value = b.dataset.user;
    hydrateForm(b.dataset.user);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }));
}

function hydrateForm(userId){
  const f = $('#profileForm');
  const profile = profilesCache.find(p => p.id_usuario === userId);
  if (!profile) return clearForm(false);

  f.elements.nombre.value = profile.nombre || '';
  f.elements.email.value = profile.email || '';
  f.elements.rol.value = profile.rol || 'Asesor';
  f.elements.id_punto_atencion.value = profile.id_punto_atencion || '';
  f.elements.estado.value = profile.estado || 'Activo';

  const selected = assignmentMap.get(userId) || new Set();
  $$('input[name="servicios"]', f).forEach(chk => {
    chk.checked = selected.has(Number(chk.value));
  });
}

function clearForm(resetUser = true){
  const f = $('#profileForm');
  const selectedUser = f.elements.id_usuario.value;
  f.reset();
  if (!resetUser) f.elements.id_usuario.value = selectedUser;
}

async function saveProfile(e){
  e.preventDefault();
  const fd = new FormData(e.target);
  const id = fd.get('id_usuario');
  if (!id) return alert('Seleccione un usuario existente.');

  const perfil = {
    id_usuario: id,
    nombre: fd.get('nombre'),
    email: fd.get('email'),
    rol: fd.get('rol'),
    id_punto_atencion: fd.get('id_punto_atencion') || null,
    estado: fd.get('estado')
  };
  const servicios = fd.getAll('servicios').map(Number);

  const { error } = await supabase.from('perfiles').upsert(perfil, { onConflict: 'id_usuario' });
  if (error) return alert(error.message);

  const { error: delError } = await supabase.from('usuario_servicio').delete().eq('id_usuario', id);
  if (delError) return alert(delError.message);

  if (servicios.length) {
    const { error: insError } = await supabase.from('usuario_servicio').insert(servicios.map(s => ({ id_usuario: id, id_servicio: s })));
    if (insError) return alert(insError.message);
  }

  alert('Perfil actualizado correctamente.');
  await renderUsers($('#content'));
}
