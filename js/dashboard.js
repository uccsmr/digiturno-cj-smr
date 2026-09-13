import { adminOnly } from './layout.js';
import { supabase, today, escapeHtml } from './core.js';

adminOnly('dashboard', renderDashboard);

function fmtTime(value){
  if (!value) return '-';
  return new Date(value).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' });
}

function fmtDateLong(date = new Date()){
  return date.toLocaleDateString('es-CO', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });
}

function timeNow(){
  return new Date().toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' });
}

function statusClass(status){
  const value = String(status || '').toLowerCase();
  if (value.includes('espera')) return 'is-waiting';
  if (value.includes('llamado')) return 'is-called';
  if (value.includes('atención') || value.includes('atencion')) return 'is-progress';
  if (value.includes('atendido') || value.includes('finalizado')) return 'is-done';
  if (value.includes('ausente')) return 'is-absent';
  return 'is-neutral';
}

function percent(value, total){
  if (!total) return 0;
  return Math.round((value / total) * 100);
}

function activityIcon(status){
  const value = String(status || '').toLowerCase();
  if (value.includes('espera')) return '⏱';
  if (value.includes('llamado')) return '📣';
  if (value.includes('atención') || value.includes('atencion')) return '👤';
  if (value.includes('atendido') || value.includes('finalizado')) return '✓';
  if (value.includes('ausente')) return '✕';
  return '•';
}

async function renderDashboard(container){
  const currentDate = today();

  const { data: turns, error } = await supabase
    .from('turnos')
    .select(`
      id_turno,
      codigo_turno,
      estado,
      fecha,
      hora_generado,
      hora_llamado,
      hora_inicio_atencion,
      hora_fin_atencion,
      servicios(nombre_servicio, prefijo),
      puntos_atencion(nombre_punto)
    `)
    .eq('fecha', currentDate)
    .order('id_turno', { ascending: false });

  if (error) {
    container.innerHTML = `<div class="alert alert-danger">No fue posible cargar el resumen: ${escapeHtml(error.message)}</div>`;
    return;
  }

  const list = turns || [];
  const total = list.length;
  const espera = list.filter(t => t.estado === 'En espera').length;
  const llamados = list.filter(t => ['Llamado', 'En atención'].includes(t.estado)).length;
  const atendidos = list.filter(t => ['Atendido', 'Finalizado'].includes(t.estado)).length;
  const ausentes = list.filter(t => t.estado === 'Ausente').length;

  const avgMinutes = (() => {
    const completed = list.filter(t => t.hora_generado && t.hora_fin_atencion);
    if (!completed.length) return 0;
    const totalMs = completed.reduce((sum, t) => sum + Math.max(0, new Date(t.hora_fin_atencion) - new Date(t.hora_generado)), 0);
    return Math.max(1, Math.round(totalMs / completed.length / 60000));
  })();

  const recent = list.slice(0, 5);

  container.innerHTML = `
    <section class="admin-hero">
      <div>
        <span class="eyebrow">Bienvenido al sistema</span>
        <h1>Inicio</h1>
        <p>Panel principal del Digiturno Jurídico.</p>
      </div>
      <div class="hero-meta">
        <span>📅 ${escapeHtml(fmtDateLong())}</span>
        <span>🕘 <strong id="adminClock">${escapeHtml(timeNow())}</strong></span>
        <div class="clinic-card">
          <span class="clinic-icon">⚖</span>
          <div>
            <strong>Consultorio Jurídico</strong>
            <small>Centro de Conciliación</small>
          </div>
        </div>
      </div>
    </section>

    <section class="admin-stats-grid">
      ${statCard('🎟', 'Turnos hoy', total, '+100%', 'vs. ayer', 'blue')}
      ${statCard('⏱', 'En espera', espera, espera ? `${percent(espera,total)}% del total` : 'Sin turnos pendientes', '', 'orange')}
      ${statCard('📣', 'Llamados', llamados, llamados ? `${percent(llamados,total)}% del total` : 'Sin llamados', '', 'purple')}
      ${statCard('👥', 'Atendidos', atendidos, atendidos ? `${percent(atendidos,total)}% del total` : 'Sin atenciones', '', 'green')}
    </section>

    <section class="quick-panel">
      <div class="section-title">
        <span>⚡</span>
        <div>
          <h2>Accesos rápidos</h2>
          <p>Herramientas de uso frecuente para la gestión del sistema.</p>
        </div>
      </div>
      <div class="quick-actions-grid">
        <a class="quick-card kiosk" href="kiosco.html" target="_blank" rel="noopener">
          <span class="quick-icon">▣</span>
          <strong>Kiosco</strong>
          <small>Abrir módulo</small>
          <b>›</b>
        </a>
        <a class="quick-card tv" href="pantalla.html" target="_blank" rel="noopener">
          <span class="quick-icon">▣</span>
          <strong>Pantalla TV</strong>
          <small>Mostrar turnos</small>
          <b>›</b>
        </a>
        <a class="quick-card advisor" href="asesor.html">
          <span class="quick-icon">👥</span>
          <strong>Panel Asesor</strong>
          <small>Gestionar turnos</small>
          <b>›</b>
        </a>
      </div>
    </section>

    <section class="admin-bottom-grid">
      <article class="summary-panel">
        <div class="panel-heading-row">
          <div class="section-title compact">
            <span>▥</span>
            <div>
              <h2>Resumen del día</h2>
              <p>Estado general de la operación en tiempo real.</p>
            </div>
          </div>
          <a class="mini-link" href="reportes.html">Ver reportes →</a>
        </div>
        <div class="summary-metrics">
          ${summaryMetric('⏱', 'Turnos en espera', espera, percent(espera,total), 'orange')}
          ${summaryMetric('📣', 'Turnos llamados', llamados, percent(llamados,total), 'purple')}
          ${summaryMetric('✓', 'Turnos atendidos', atendidos, percent(atendidos,total), 'green')}
          ${summaryMetric('⏱', 'Tiempo promedio de atención', `${avgMinutes} min`, total ? 'Estimado del día' : 'Sin datos', 'blue', true)}
        </div>
      </article>

      <article class="activity-panel">
        <div class="panel-heading-row">
          <div class="section-title compact">
            <span>▤</span>
            <div>
              <h2>Actividad reciente</h2>
              <p>Últimos eventos registrados en el sistema.</p>
            </div>
          </div>
          <a class="mini-link" href="reportes.html">Ver toda la actividad →</a>
        </div>
        <div class="activity-list">
          ${recent.length ? recent.map(renderActivity).join('') : '<div class="empty-state">Sin actividad registrada hoy.</div>'}
        </div>
      </article>
    </section>

    <section class="system-strip">
      <div><span>ℹ</span> El sistema se encuentra en funcionamiento. Servicios operando con normalidad.</div>
      <strong><i></i> Sistema en línea</strong>
    </section>
  `;

  setInterval(() => {
    const clock = document.getElementById('adminClock');
    if (clock) clock.textContent = timeNow();
  }, 30000);
}

function statCard(icon, title, value, trend, trendLabel, tone){
  return `
    <article class="admin-stat ${tone}">
      <div class="stat-icon">${icon}</div>
      <div>
        <span>${escapeHtml(title)}</span>
        <strong>${escapeHtml(String(value))}</strong>
        <small>${escapeHtml(trend)} ${trendLabel ? `<em>${escapeHtml(trendLabel)}</em>` : ''}</small>
      </div>
    </article>`;
}

function summaryMetric(icon, label, value, pctOrText, tone, textMode = false){
  return `
    <div class="summary-metric ${tone}">
      <span class="metric-icon">${icon}</span>
      <div>
        <small>${escapeHtml(label)}</small>
        <strong>${escapeHtml(String(value))}</strong>
        <p>${textMode ? escapeHtml(String(pctOrText)) : `${escapeHtml(String(pctOrText))}% del total`}</p>
        ${textMode ? '' : `<div class="progress"><span style="width:${Math.min(100, Number(pctOrText) || 0)}%"></span></div>`}
      </div>
    </div>`;
}

function renderActivity(turn){
  const service = turn.servicios?.nombre_servicio || 'Servicio no definido';
  const point = turn.puntos_atencion?.nombre_punto || 'En espera';
  const when = turn.hora_fin_atencion || turn.hora_inicio_atencion || turn.hora_llamado || turn.hora_generado;
  const label = turn.estado === 'Atendido' || turn.estado === 'Finalizado'
    ? `Turno ${turn.codigo_turno} atendido`
    : turn.estado === 'Llamado'
      ? `Llamando turno ${turn.codigo_turno}`
      : turn.estado === 'En atención'
        ? `Turno ${turn.codigo_turno} en atención`
        : `Nuevo turno ${turn.codigo_turno}`;

  return `
    <div class="activity-item ${statusClass(turn.estado)}">
      <span class="activity-icon">${activityIcon(turn.estado)}</span>
      <div>
        <strong>${escapeHtml(label)}</strong>
        <small>${escapeHtml(point)} · ${escapeHtml(service)}</small>
      </div>
      <time>${escapeHtml(fmtTime(when))}</time>
    </div>`;
}
