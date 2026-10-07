import { advisorPage } from './layout.js';
import { $, $$, supabase, currentProfile, loadProfile, today, fmtTime, escapeHtml } from './core.js';

let advisorTimer = null;
let historyPage = 1;
const HISTORY_PAGE_SIZE = 6;
let legalAdvisors = [];

advisorPage('asesor', renderAdvisor);

async function renderAdvisor(c){
  c.innerHTML = `<div class="advisor-v21" id="advisorContent"></div>`;
  await loadLegalAdvisors();
  await loadAdvisor();
  clearInterval(advisorTimer);
  advisorTimer = setInterval(loadAdvisor, 3000);
  window.addEventListener('beforeunload', () => clearInterval(advisorTimer));
}

async function loadLegalAdvisors(){
  const { data, error } = await supabase.rpc('asesores_asesoria_juridica');
  if (error) {
    console.warn('No se pudieron cargar asesores jurídicos:', error.message);
    legalAdvisors = [];
  } else {
    legalAdvisors = data || [];
  }
}

async function advisorServiceIds(){
  if (currentProfile?.rol === 'Administrador') {
    const { data } = await supabase.from('servicios').select('id_servicio').eq('estado', 'Activo');
    return (data || []).map(x => x.id_servicio);
  }
  const { data } = await supabase
    .from('usuario_servicio')
    .select('id_servicio')
    .eq('id_usuario', currentProfile.id_usuario);
  return (data || []).map(x => x.id_servicio);
}

async function pendingQuery(serviceIds){
  let query = supabase
    .from('turnos')
    .select('*, servicios(nombre_servicio,prefijo)')
    .eq('fecha', today())
    .in('estado', ['En espera', 'Transferido'])
    .in('id_servicio', serviceIds)
    .order('prioridad', { ascending: false })
    .order('hora_generado', { ascending: true })
    .limit(30);

  if (currentProfile?.rol !== 'Administrador') {
    query = query.or(`id_asesor_destino.is.null,id_asesor_destino.eq.${currentProfile.id_usuario}`);
  }
  return await query;
}

async function loadAdvisor(){
  await loadProfile(true);
  const box = $('#advisorContent');
  if (!box) return;

  if (!currentProfile?.id_punto_atencion) {
    box.innerHTML = `<div class="alert alert-danger">Este asesor no tiene punto de atención asignado. Así se evita que el sistema muestre “Punto pendiente”.</div>`;
    return;
  }

  const serviceIds = await advisorServiceIds();
  if (!serviceIds.length) {
    box.innerHTML = `<div class="alert alert-danger">Este asesor no tiene servicios asignados.</div>`;
    return;
  }

  const [{ data: active }, pendingResult, { data: historyAll }] = await Promise.all([
    supabase
      .from('turnos')
      .select('*, servicios(nombre_servicio,prefijo), puntos_atencion(nombre_punto)')
      .eq('id_usuario_asesor', currentProfile.id_usuario)
      .in('estado', ['Llamado', 'En atención'])
      .order('hora_llamado', { ascending: false })
      .limit(1)
      .maybeSingle(),
    pendingQuery(serviceIds),
    supabase
      .from('turnos')
      .select('*, servicios(nombre_servicio,prefijo)')
      .eq('fecha', today())
      .eq('id_usuario_asesor', currentProfile.id_usuario)
      .in('estado', ['Atendido', 'Ausente'])
      .order('hora_fin_atencion', { ascending: false })
      .limit(60)
  ]);

  if (pendingResult.error) {
    box.innerHTML = `<div class="alert alert-danger">Error cargando turnos pendientes: ${escapeHtml(pendingResult.error.message)}</div>`;
    return;
  }

  const pending = pendingResult.data || [];
  const history = historyAll || [];
  const pageCount = Math.max(1, Math.ceil(history.length / HISTORY_PAGE_SIZE));
  if (historyPage > pageCount) historyPage = pageCount;
  const historySlice = history.slice((historyPage - 1) * HISTORY_PAGE_SIZE, historyPage * HISTORY_PAGE_SIZE);
  const advisorName = currentProfile.nombre || currentProfile.email || 'Asesor';
  const point = currentProfile.puntos_atencion?.nombre_punto || 'Sin punto';

  box.innerHTML = `
    <div class="topbar advisor-topbar-v21">
      <div>
        <span class="eyebrow">Consultorio Jurídico</span>
        <h1>Panel Asesor</h1>
        <p>Gestión del llamado, atención, redirección y cierre de turnos.</p>
      </div>
      <div class="advisor-identity-chip">
        <span>👤</span>
        <div><strong>${escapeHtml(advisorName)}</strong><small>${escapeHtml(point)} · En línea</small></div>
      </div>
    </div>

    <section class="grid two-columns advisor-main-row-v21">
      <article class="panel advisor-card current-card-v21">
        <div class="panel-header"><h2>🎫 Turno actual</h2><span class="badge">${escapeHtml(point)}</span></div>
        ${renderCurrentTurn(active)}
        ${renderRedirectBox(active)}
      </article>
      <article class="panel advisor-card actions-card-v21">
        <div class="panel-header"><h2>⚡ Acciones</h2><span class="badge">Seleccione una opción</span></div>
        <div class="advisor-actions-grid">
          <button class="btn btn-primary advisor-action-btn" id="btnCallNext" ${active ? 'disabled' : ''}>▶<span>Llamar<br>siguiente</span></button>
          <button class="btn btn-warning advisor-action-btn" id="btnRepeat" ${!active ? 'disabled' : ''}>↻<span>Repetir<br>llamado</span></button>
          <button class="btn btn-secondary advisor-action-btn" id="btnStart" ${!active || active.estado !== 'Llamado' ? 'disabled' : ''}>👤<span>Usuario<br>presente</span></button>
          <button class="btn btn-primary advisor-action-btn" id="btnFinish" ${!active ? 'disabled' : ''}>✓<span>Finalizar</span></button>
          <button class="btn btn-danger advisor-action-btn" id="btnAbsent" ${!active ? 'disabled' : ''}>×<span>Ausente</span></button>
        </div>
        <p class="muted">El botón “Usuario presente” confirma la atención y repite el llamado en pantalla.</p>
      </article>
    </section>

    <section class="panel advisor-card">
      <div class="panel-header"><h2>☰ Turnos pendientes</h2><span class="badge">${pending.length} en espera</span></div>
      <div class="table-responsive"><table class="advisor-table"><thead><tr><th>#</th><th>Turno</th><th>Usuario</th><th>Servicio</th><th>Hora</th><th>Condición</th><th>Asignación</th><th>Acción</th></tr></thead><tbody>
        ${pending.map((t, i) => renderPendingRow(t, i, !!active)).join('') || '<tr><td colspan="8">No hay turnos pendientes.</td></tr>'}
      </tbody></table></div>
    </section>

    <section class="panel advisor-card">
      <div class="panel-header"><h2>↺ Historial del día</h2><span class="badge">${history.length} atendidos</span></div>
      <div class="table-responsive"><table class="advisor-table"><thead><tr><th>#</th><th>Turno</th><th>Usuario</th><th>Servicio</th><th>Estado</th><th>Fin</th></tr></thead><tbody>
        ${historySlice.map((t, i) => `<tr><td>${(historyPage - 1) * HISTORY_PAGE_SIZE + i + 1}</td><td><b>${escapeHtml(t.codigo_turno)}</b></td><td>${escapeHtml(t.nombre_usuario || '-')}</td><td>${escapeHtml(t.servicios?.nombre_servicio || '')}</td><td><span class="badge ${t.estado === 'Ausente' ? 'badge-red' : 'badge-green'}">${escapeHtml(t.estado)}</span></td><td>${fmtTime(t.hora_fin_atencion)}</td></tr>`).join('') || '<tr><td colspan="6">Sin historial.</td></tr>'}
      </tbody></table></div>
      <div class="pagination-v21">
        <span>Mostrando ${history.length ? ((historyPage - 1) * HISTORY_PAGE_SIZE + 1) : 0} - ${Math.min(historyPage * HISTORY_PAGE_SIZE, history.length)} de ${history.length}</span>
        <div><button class="btn btn-small btn-outline" id="historyPrev" ${historyPage <= 1 ? 'disabled' : ''}>‹</button><b>${historyPage}</b><button class="btn btn-small btn-outline" id="historyNext" ${historyPage >= pageCount ? 'disabled' : ''}>›</button></div>
      </div>
    </section>`;

  $('#btnCallNext')?.addEventListener('click', () => callNext(pending?.[0]?.id_turno));
  $('#btnRepeat')?.addEventListener('click', () => repeatCall(active?.id_turno, active?.llamado_version || 0));
  $('#btnStart')?.addEventListener('click', () => startAttention(active?.id_turno));
  $('#btnFinish')?.addEventListener('click', () => closeTurn(active?.id_turno, 'Atendido'));
  $('#btnAbsent')?.addEventListener('click', () => closeTurn(active?.id_turno, 'Ausente'));
  $('#btnRedirect')?.addEventListener('click', () => redirectActiveTurn(active));
  $('#historyPrev')?.addEventListener('click', () => { historyPage = Math.max(1, historyPage - 1); loadAdvisor(); });
  $('#historyNext')?.addEventListener('click', () => { historyPage += 1; loadAdvisor(); });
  $$('[data-call]').forEach(b => b.addEventListener('click', () => callNext(Number(b.dataset.call))));
}

function renderPendingRow(t, i, hasActive){
  const priority = Number(t.prioridad || 0) > 0;
  const directed = t.id_asesor_destino ? 'Dirigido a este asesor' : 'Libre para asesores';
  return `<tr>
    <td>${i + 1}</td>
    <td><b>${escapeHtml(t.codigo_turno)}</b></td>
    <td>${escapeHtml(t.nombre_usuario || '-')}</td>
    <td>${escapeHtml(t.servicios?.nombre_servicio || '')}</td>
    <td>${fmtTime(t.hora_generado)}</td>
    <td>${priority ? '<span class="badge priority-soft">Prioritario</span>' : '<span class="badge">Normal</span>'}</td>
    <td><span class="badge">${escapeHtml(directed)}</span></td>
    <td><button class="btn btn-small btn-primary" data-call="${t.id_turno}" ${hasActive ? 'disabled' : ''}>Llamar</button></td>
  </tr>`;
}

function renderCurrentTurn(t){
  if (!t) return `<div class="alert alert-info">No hay turno activo.</div>`;
  return `<div class="current-turn-box-v21">
    <div><small>Turno</small><strong>${escapeHtml(t.codigo_turno)}</strong></div>
    <div><small>Usuario</small><strong>${escapeHtml(t.nombre_usuario || 'Usuario sin nombre')}</strong></div>
    <div><small>Servicio</small><strong>${escapeHtml(t.servicios?.nombre_servicio || '')}</strong></div>
    <div><small>Estado</small><span class="badge">${escapeHtml(t.estado)}</span></div>
  </div>`;
}

function renderRedirectBox(t){
  if (!t || String(t.servicios?.prefijo || '').toUpperCase() !== 'ASE') return '';
  const options = legalAdvisors
    .filter(a => a.id_usuario !== currentProfile.id_usuario)
    .map(a => `<option value="${escapeHtml(a.id_usuario)}">${escapeHtml(a.nombre)}${a.nombre_punto ? ' · ' + escapeHtml(a.nombre_punto) : ''}</option>`)
    .join('');
  if (!options) return '';
  return `<div class="redirect-box-v21">
    <label>Redireccionar a otro asesor jurídico
      <select id="redirectAdvisor"><option value="">Seleccione asesor destino</option>${options}</select>
    </label>
    <button class="btn btn-outline" id="btnRedirect" type="button">Redireccionar turno</button>
  </div>`;
}

async function callNext(idTurno){
  if (!idTurno) return alert('No hay turnos pendientes.');
  const { data: active } = await supabase
    .from('turnos')
    .select('id_turno')
    .eq('id_usuario_asesor', currentProfile.id_usuario)
    .in('estado', ['Llamado', 'En atención'])
    .limit(1);
  if (active?.length) return alert('Tiene un turno activo. Finalícelo o márquelo ausente antes de llamar otro.');

  const now = new Date();
  const { data: turno, error: loadError } = await supabase
    .from('turnos')
    .select('hora_generado,llamado_version,id_asesor_destino')
    .eq('id_turno', idTurno)
    .single();
  if (loadError) return alert(loadError.message);
  if (turno?.id_asesor_destino && turno.id_asesor_destino !== currentProfile.id_usuario && currentProfile.rol !== 'Administrador') {
    return alert('Este turno fue dirigido a otro asesor.');
  }
  const wait = turno?.hora_generado ? Math.max(0, Math.round((now - new Date(turno.hora_generado)) / 1000)) : 0;
  const { error } = await supabase.from('turnos').update({
    estado: 'Llamado',
    id_usuario_asesor: currentProfile.id_usuario,
    id_asesor_destino: currentProfile.id_usuario,
    id_punto_atencion: currentProfile.id_punto_atencion,
    hora_llamado: now.toISOString(),
    tiempo_espera: wait,
    llamado_version: (turno?.llamado_version || 0) + 1
  }).eq('id_turno', idTurno);
  if (error) return alert(error.message);
  await loadAdvisor();
}

async function repeatCall(idTurno, version){
  if (!idTurno) return;
  const { error } = await supabase
    .from('turnos')
    .update({ hora_llamado: new Date().toISOString(), llamado_version: version + 1 })
    .eq('id_turno', idTurno);
  if (error) alert(error.message); else await loadAdvisor();
}

async function startAttention(idTurno){
  if (!idTurno) return;
  const { data: turno } = await supabase
    .from('turnos')
    .select('llamado_version')
    .eq('id_turno', idTurno)
    .single();

  const now = new Date().toISOString();
  const { error } = await supabase
    .from('turnos')
    .update({
      estado: 'En atención',
      hora_inicio_atencion: now,
      hora_llamado: now,
      llamado_version: (turno?.llamado_version || 0) + 1
    })
    .eq('id_turno', idTurno);
  if (error) alert(error.message); else await loadAdvisor();
}

async function closeTurn(idTurno, estado){
  if (!idTurno) return;
  const now = new Date();
  const { data: turno } = await supabase.from('turnos').select('hora_inicio_atencion').eq('id_turno', idTurno).single();
  const attention = turno?.hora_inicio_atencion ? Math.max(0, Math.round((now - new Date(turno.hora_inicio_atencion)) / 1000)) : 0;
  const { error } = await supabase
    .from('turnos')
    .update({ estado, hora_fin_atencion: now.toISOString(), tiempo_atencion: attention })
    .eq('id_turno', idTurno);
  if (error) alert(error.message); else await loadAdvisor();
}

async function redirectActiveTurn(turno){
  if (!turno?.id_turno) return;
  const targetId = $('#redirectAdvisor')?.value;
  if (!targetId) return alert('Seleccione el asesor destino.');
  const target = legalAdvisors.find(a => a.id_usuario === targetId);
  if (!target) return alert('No se encontró el asesor destino.');
  if (!confirm(`¿Redireccionar el turno ${turno.codigo_turno} hacia ${target.nombre}?`)) return;

  const { error } = await supabase.from('turnos').update({
    estado: 'En espera',
    id_asesor_destino: targetId,
    id_usuario_asesor: null,
    id_punto_atencion: null,
    hora_llamado: null,
    hora_inicio_atencion: null,
    observacion: `Redireccionado hacia ${target.nombre}`
  }).eq('id_turno', turno.id_turno);
  if (error) return alert(error.message);

  await supabase.from('transferencias').insert({
    id_turno: turno.id_turno,
    id_servicio_origen: turno.id_servicio,
    id_servicio_destino: turno.id_servicio,
    id_usuario_origen: currentProfile.id_usuario,
    id_usuario_destino: targetId,
    observacion: `Redireccionado hacia ${target.nombre}`
  });

  await loadAdvisor();
}
