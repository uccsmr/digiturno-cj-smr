import { adminOnly } from './layout.js';
import { $, supabase, today, escapeHtml } from './core.js';

adminOnly('reportes', renderReports);

let reportData = [];
let reportPage = 1;
const REPORT_PAGE_SIZE = 10;

async function renderReports(c){
  c.innerHTML = `<div class="topbar"><div><h1>Reportes</h1><p>Indicadores por rango de fecha.</p></div></div>
  <section class="panel"><form id="reportForm" class="form-grid">
    <label>Desde<input type="date" name="desde" value="${today()}"></label>
    <label>Hasta<input type="date" name="hasta" value="${today()}"></label>
    <div class="action-row">
      <button class="btn btn-primary">Consultar</button>
      <button type="button" class="btn btn-outline" id="exportCsv">Exportar CSV</button>
    </div>
  </form></section>
  <section id="reportResult"></section>`;

  $('#reportForm').addEventListener('submit', e => {
    e.preventDefault();
    reportPage = 1;
    loadReports();
  });

  $('#exportCsv').addEventListener('click', exportCsv);
  await loadReports();
}

async function loadReports(){
  const fd = new FormData($('#reportForm'));
  const desde = fd.get('desde');
  const hasta = fd.get('hasta');

  const { data = [], error } = await supabase
    .from('turnos')
    .select('*, servicios(nombre_servicio)')
    .gte('fecha', desde)
    .lte('fecha', hasta)
    .order('fecha')
    .order('hora_generado');

  if (error) {
    $('#reportResult').innerHTML = `<div class="alert alert-danger">${escapeHtml(error.message)}</div>`;
    return;
  }

  reportData = data || [];
  reportPage = 1;
  renderReportContent();
}

function renderReportContent(){
  const data = reportData;

  const byStatus = data.reduce((a, t) => {
    a[t.estado] = [...(a[t.estado] || []), t];
    return a;
  }, {});

  const byService = data.reduce((a, t) => {
    const service = t.servicios?.nombre_servicio || 'Sin servicio';
    a[service] = (a[service] || 0) + 1;
    return a;
  }, {});

  const totalPages = Math.max(1, Math.ceil(data.length / REPORT_PAGE_SIZE));
  if (reportPage > totalPages) reportPage = totalPages;
  if (reportPage < 1) reportPage = 1;

  const start = (reportPage - 1) * REPORT_PAGE_SIZE;
  const end = Math.min(start + REPORT_PAGE_SIZE, data.length);
  const pageRows = data.slice(start, end);

  $('#reportResult').innerHTML = `
    <section class="grid stats-grid">
      <article class="stat-card"><span>Total</span><strong>${data.length}</strong></article>
      <article class="stat-card"><span>Atendidos</span><strong>${byStatus.Atendido?.length || 0}</strong></article>
      <article class="stat-card"><span>Ausentes</span><strong>${byStatus.Ausente?.length || 0}</strong></article>
      <article class="stat-card"><span>En espera</span><strong>${byStatus['En espera']?.length || 0}</strong></article>
    </section>

    <section class="panel" style="margin-bottom:18px">
      <div class="panel-header">
        <h2>Por servicio</h2>
        <span class="badge">${Object.keys(byService).length} servicios</span>
      </div>
      <div class="table-responsive">
        <table>
          <thead>
            <tr><th>Servicio</th><th style="width:120px">Turnos</th><th style="width:140px">% del total</th></tr>
          </thead>
          <tbody>
            ${Object.entries(byService)
              .sort((a,b) => b[1] - a[1])
              .map(([service, count]) => {
                const pct = data.length ? Math.round((count / data.length) * 100) : 0;
                return `<tr>
                  <td>${escapeHtml(service)}</td>
                  <td><b>${count}</b></td>
                  <td><span class="badge">${pct}%</span></td>
                </tr>`;
              }).join('') || '<tr><td colspan="3">Sin datos para el rango seleccionado.</td></tr>'}
          </tbody>
        </table>
      </div>
    </section>

    <section class="panel">
      <div class="panel-header">
        <h2>Detalle</h2>
        <span class="badge">${data.length} registros</span>
      </div>

      <div class="table-responsive">
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Turno</th>
              <th>Usuario</th>
              <th>Servicio</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            ${pageRows.map(t => `
              <tr>
                <td>${escapeHtml(t.fecha || '')}</td>
                <td><b>${escapeHtml(t.codigo_turno || '')}</b></td>
                <td>${escapeHtml(t.nombre_usuario || '-')}</td>
                <td>${escapeHtml(t.servicios?.nombre_servicio || '')}</td>
                <td>${escapeHtml(t.estado || '')}</td>
              </tr>`).join('') || '<tr><td colspan="5">Sin registros para el rango seleccionado.</td></tr>'}
          </tbody>
        </table>
      </div>

      <div class="pagination-v21">
        <span>
          Mostrando ${data.length ? start + 1 : 0} - ${end} de ${data.length}
        </span>
        <div>
          <button class="btn btn-small btn-outline" id="reportFirst" ${reportPage <= 1 ? 'disabled' : ''}>«</button>
          <button class="btn btn-small btn-outline" id="reportPrev" ${reportPage <= 1 ? 'disabled' : ''}>‹</button>
          <b title="Página actual">${reportPage}</b>
          <span style="font-weight:800;color:#607184">de ${totalPages}</span>
          <button class="btn btn-small btn-outline" id="reportNext" ${reportPage >= totalPages ? 'disabled' : ''}>›</button>
          <button class="btn btn-small btn-outline" id="reportLast" ${reportPage >= totalPages ? 'disabled' : ''}>»</button>
        </div>
      </div>
    </section>`;

  $('#reportFirst')?.addEventListener('click', () => changeReportPage(1));
  $('#reportPrev')?.addEventListener('click', () => changeReportPage(reportPage - 1));
  $('#reportNext')?.addEventListener('click', () => changeReportPage(reportPage + 1));
  $('#reportLast')?.addEventListener('click', () => changeReportPage(totalPages));
}

function changeReportPage(page){
  const totalPages = Math.max(1, Math.ceil(reportData.length / REPORT_PAGE_SIZE));
  reportPage = Math.min(totalPages, Math.max(1, page));
  renderReportContent();

  document.querySelector('#reportResult')?.scrollIntoView({
    behavior: 'smooth',
    block: 'start'
  });
}

async function exportCsv(){
  const fd = new FormData($('#reportForm'));

  const { data = [], error } = await supabase
    .from('turnos')
    .select('*, servicios(nombre_servicio)')
    .gte('fecha', fd.get('desde'))
    .lte('fecha', fd.get('hasta'))
    .order('fecha')
    .order('hora_generado');

  if (error) return alert(error.message);

  const rows = [
    ['Fecha','Turno','Usuario','Servicio','Estado','Hora generado','Hora llamado'],
    ...data.map(t => [
      t.fecha,
      t.codigo_turno,
      t.nombre_usuario || '',
      t.servicios?.nombre_servicio || '',
      t.estado,
      t.hora_generado || '',
      t.hora_llamado || ''
    ])
  ];

  const csv = rows
    .map(row => row.map(value => `"${String(value ?? '').replaceAll('"', '""')}"`).join(';'))
    .join('\r\n');

  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'reporte_digiturno.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
