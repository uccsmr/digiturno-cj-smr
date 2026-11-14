import { adminOnly } from './layout.js';
import { $, supabase, today, escapeHtml } from './core.js';

adminOnly('reportes', renderReports);

async function renderReports(c){
  c.innerHTML = `<div class="topbar"><div><h1>Reportes</h1><p>Indicadores por rango de fecha.</p></div></div>
  <section class="panel"><form id="reportForm" class="form-grid">
    <label>Desde<input type="date" name="desde" value="${today()}"></label>
    <label>Hasta<input type="date" name="hasta" value="${today()}"></label>
    <div class="action-row"><button class="btn btn-primary">Consultar</button><button type="button" class="btn btn-outline" id="exportCsv">Exportar CSV</button></div>
  </form></section>
  <section id="reportResult"></section>`;
  $('#reportForm').addEventListener('submit', e => { e.preventDefault(); loadReports(); });
  $('#exportCsv').addEventListener('click', exportCsv);
  await loadReports();
}

async function loadReports(){
  const fd = new FormData($('#reportForm'));
  const desde = fd.get('desde'), hasta = fd.get('hasta');
  const { data = [], error } = await supabase
    .from('turnos')
    .select('*, servicios(nombre_servicio)')
    .gte('fecha', desde)
    .lte('fecha', hasta)
    .order('fecha');
  if (error) {
    $('#reportResult').innerHTML = `<div class="alert alert-danger">${escapeHtml(error.message)}</div>`;
    return;
  }
  const byStatus = data.reduce((a, t) => ((a[t.estado] = [...(a[t.estado] || []), t]), a), {});
  const byService = data.reduce((a, t) => ((a[t.servicios?.nombre_servicio || 'Sin servicio'] = (a[t.servicios?.nombre_servicio || 'Sin servicio'] || 0) + 1), a), {});
  $('#reportResult').innerHTML = `<section class="grid stats-grid"><article class="stat-card"><span>Total</span><strong>${data.length}</strong></article><article class="stat-card"><span>Atendidos</span><strong>${byStatus.Atendido?.length || 0}</strong></article><article class="stat-card"><span>Ausentes</span><strong>${byStatus.Ausente?.length || 0}</strong></article><article class="stat-card"><span>En espera</span><strong>${byStatus['En espera']?.length || 0}</strong></article></section>
  <section class="grid two-columns"><article class="panel"><h2>Por servicio</h2><table><tbody>${Object.entries(byService).map(([k, v]) => `<tr><td>${escapeHtml(k)}</td><td><b>${v}</b></td></tr>`).join('')}</tbody></table></article><article class="panel"><h2>Detalle</h2><div class="table-responsive"><table><thead><tr><th>Fecha</th><th>Turno</th><th>Usuario</th><th>Servicio</th><th>Estado</th></tr></thead><tbody>${data.map(t => `<tr><td>${t.fecha}</td><td>${escapeHtml(t.codigo_turno)}</td><td>${escapeHtml(t.nombre_usuario || '-')}</td><td>${escapeHtml(t.servicios?.nombre_servicio || '')}</td><td>${escapeHtml(t.estado)}</td></tr>`).join('')}</tbody></table></div></article></section>`;
}

async function exportCsv(){
  const fd = new FormData($('#reportForm'));
  const { data = [], error } = await supabase
    .from('turnos')
    .select('*, servicios(nombre_servicio)')
    .gte('fecha', fd.get('desde'))
    .lte('fecha', fd.get('hasta'))
    .order('fecha');
  if (error) return alert(error.message);
  const rows = [['fecha', 'turno', 'usuario', 'servicio', 'estado', 'hora_generado', 'hora_llamado'], ...data.map(t => [t.fecha, t.codigo_turno, t.nombre_usuario || '', t.servicios?.nombre_servicio || '', t.estado, t.hora_generado || '', t.hora_llamado || ''])];
  const csv = rows.map(r => r.map(v => `"${String(v).replaceAll('"', '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'reporte_digiturno.csv';
  a.click();
  URL.revokeObjectURL(a.href);
}
