import { $, $$, appRoot, initSupabase, loadConfig, appConfig, supabase, escapeHtml } from './core.js';

let selectedService = null;
let servicesCache = [];
let legalAdvisorsCache = [];

(async () => {
  const ok = await initSupabase();
  if (!ok) return;
  await renderKiosk();
})();

async function renderKiosk(){
  await loadConfig();
  const { data: services, error } = await supabase
    .from('servicios')
    .select('*')
    .eq('estado', 'Activo')
    .order('prioridad', { ascending: true })
    .order('nombre_servicio', { ascending: true });

  if (error) {
    appRoot().innerHTML = `<main class="login-page"><section class="login-card"><h1>Error</h1><div class="alert alert-danger">${escapeHtml(error.message)}</div></section></main>`;
    return;
  }

  servicesCache = services || [];
  await loadLegalAdvisors();

  appRoot().innerHTML = `<main class="kiosk-page premium-kiosk kiosk-v21"><section class="kiosk premium-kiosk-shell kiosk-v21-shell">
    <header class="kiosk-header premium-kiosk-header kiosk-v21-header">
      <div class="kiosk-branding">
        <img class="kiosk-logo-main" src="${escapeHtml(appConfig.logo || 'assets/img/logo_ucc_horizontal.png')}" alt="Universidad Cooperativa de Colombia">
        <span class="kiosk-brand-divider"></span>
        <img class="kiosk-logo-clinic" src="${escapeHtml(appConfig.logo_pantalla || 'assets/img/logo_consultorio_juridico.png')}" alt="Consultorio Jurídico">
      </div>
      <div class="kiosk-title-block">
        
        <h1>Generar Turno</h1>
        <p>Seleccione el servicio, registre el nombre del usuario y genere el turno de atención.</p>
      </div>
     
    </header>

    <section class="kiosk-v21-content">
      <section class="service-grid premium-service-grid kiosk-service-list">
        ${servicesCache.map((s, idx) => serviceButton(s, idx + 1)).join('') || '<article class="panel"><h2>Sin servicios activos</h2><p>Configure los servicios desde administración.</p></article>'}
      </section>
      <aside class="kiosk-info-panel">
        <h2>Datos del usuario</h2>
        <p>Después de seleccionar un servicio se solicitará el nombre, prioridad y direccionamiento si aplica.</p>
        <div class="kiosk-mini-card"><strong>Atención prioritaria</strong><span>Disponible para todos los servicios.</span></div>
        <div class="kiosk-mini-card"><strong>Asesoría Jurídica</strong><span>Puede dirigirse a un asesor específico o quedar disponible para cualquiera de los 4 asesores.</span></div>
        <div class="kiosk-mini-card"><strong>Llamado por voz</strong><span>La pantalla anunciará turno, nombre y punto de atención.</span></div>
      </aside>
    </section>

    <footer class="kiosk-v21-footer">Consultorio Jurídico y Centro de Conciliación · Universidad Cooperativa de Colombia</footer>
  </section></main>`;

  $$('.service-button').forEach(btn => btn.addEventListener('click', () => openTicketModal(Number(btn.dataset.service))));
}

function serviceButton(s, number){
  const icon = serviceIcon(s.prefijo);
  return `<button class="service-button premium-service-button kiosk-service-card" style="--service-color:${escapeHtml(s.color || '#00ACC9')}" data-service="${s.id_servicio}">
    <span class="service-visual" aria-hidden="true">${icon}</span>
    <span class="service-order">${number}</span>
    <span class="service-copy">
      <strong>${escapeHtml(s.nombre_servicio)}</strong>
      <small>${escapeHtml(s.descripcion || 'Atención disponible en el Consultorio Jurídico.')}</small>
    </span>
    <span class="service-go" aria-hidden="true">›</span>
  </button>`;
}

function serviceIcon(prefijo = ''){
  const p = String(prefijo).toUpperCase();
  if (p === 'ASE') return '⚖';
  if (p === 'CON') return '🤝';
  if (p === 'PUR' || p === 'VBG') return '🟣';
  if (p === 'PRO') return '📄';
  return '🎫';
}

async function loadLegalAdvisors(){
  const { data, error } = await supabase.rpc('asesores_asesoria_juridica');
  if (error) {
    console.warn('No se pudieron cargar asesores jurídicos:', error.message);
    legalAdvisorsCache = [];
    return;
  }
  legalAdvisorsCache = data || [];
}

function openTicketModal(serviceId){
  selectedService = servicesCache.find(s => Number(s.id_servicio) === Number(serviceId));
  if (!selectedService) return;

  const isLegalAdvice = String(selectedService.prefijo || '').toUpperCase() === 'ASE';
  const advisorOptions = legalAdvisorsCache.map(a => `<option value="${escapeHtml(a.id_usuario)}">${escapeHtml(a.nombre)}${a.nombre_punto ? ' · ' + escapeHtml(a.nombre_punto) : ''}</option>`).join('');

  const modal = document.createElement('div');
  modal.className = 'ticket-modal premium-ticket-modal';
  modal.innerHTML = `<section class="ticket-card premium-ticket-form-card ticket-form-v21">
    <button class="modal-close" type="button" id="cancelTicket" aria-label="Cerrar">×</button>
    <div class="ticket-service-head" style="--service-color:${escapeHtml(selectedService.color || '#00ACC9')}">
      <span>${serviceIcon(selectedService.prefijo)}</span>
      <div><small>Servicio seleccionado</small><h3>${escapeHtml(selectedService.nombre_servicio)}</h3></div>
    </div>
    <p class="muted">Ingrese el nombre de la persona que será llamada por la pantalla del Digiturno.</p>
    <form id="ticketForm" class="ticket-form">
      <label>Nombre del usuario
        <input name="nombre_usuario" type="text" maxlength="100" placeholder="Ejemplo: Ana Pérez" autocomplete="off" required>
      </label>
      <label class="priority-option">
        <input name="prioritario" type="checkbox" value="1">
        <span><strong>Atención prioritaria</strong><small>Adulto mayor, discapacidad, gestante u otro criterio institucional.</small></span>
      </label>
      ${isLegalAdvice ? `<label class="advisor-target-field">Dirigir a asesor jurídico <small>Opcional. Si no selecciona asesor, cualquiera de los 4 asesores podrá llamar este turno.</small>
        <select name="id_asesor_destino">
          <option value="">Cualquiera de los 4 asesores</option>
          ${advisorOptions}
        </select>
      </label>` : ''}
      <div class="ticket-preview-box" id="ticketPreview">
        <b>Vista previa:</b> ${escapeHtml(selectedService.prefijo)}-### · ${escapeHtml(selectedService.nombre_servicio)} · En espera
      </div>
      <div class="action-row ticket-actions">
        <button type="button" class="btn btn-outline" id="cancelTicket2">Cancelar</button>
        <button type="submit" class="btn btn-primary">Generar turno</button>
      </div>
    </form>
  </section>`;
  document.body.appendChild(modal);
  $('input[name="nombre_usuario"]', modal)?.focus();
  $('#cancelTicket', modal)?.addEventListener('click', () => modal.remove());
  $('#cancelTicket2', modal)?.addEventListener('click', () => modal.remove());
  $('#ticketForm', modal)?.addEventListener('submit', async (e) => {
    e.preventDefault();
    await generateTicket(modal, new FormData(e.target));
  });
}

async function generateTicket(modal, fd){
  const btn = modal.querySelector('button[type="submit"]');
  btn.disabled = true;
  btn.textContent = 'Generando...';
  const nombreUsuario = String(fd.get('nombre_usuario') || '').trim().replace(/\s+/g, ' ');
  const prioritario = fd.get('prioritario') ? 1 : 0;
  const asesorDestino = String(fd.get('id_asesor_destino') || '').trim() || null;

  try {
    let result = await supabase.rpc('generar_turno_cliente', {
      p_id_servicio: Number(selectedService.id_servicio),
      p_nombre_usuario: nombreUsuario,
      p_prioridad: prioritario,
      p_id_asesor_destino: asesorDestino
    });

    if (result.error && /function .*generar_turno_cliente|p_id_asesor_destino|schema cache/i.test(String(result.error.message || ''))) {
      result = await supabase.rpc('generar_turno_cliente', {
        p_id_servicio: Number(selectedService.id_servicio),
        p_nombre_usuario: nombreUsuario,
        p_prioridad: prioritario
      });
    }
    if (result.error) throw result.error;

    const data = Array.isArray(result.data) ? result.data[0] : result.data;
    const asesor = asesorDestino ? legalAdvisorsCache.find(a => a.id_usuario === asesorDestino) : null;
    modal.remove();
    showTicket(data.codigo_turno, selectedService.nombre_servicio, nombreUsuario, prioritario, asesor);
  } catch (err) {
    alert(err.message || 'No fue posible generar el turno.');
    btn.disabled = false;
    btn.textContent = 'Generar turno';
  }
}

function showTicket(codigo, servicio, nombreUsuario, prioritario, asesorDestino){
  const modal = document.createElement('div');
  modal.className = 'ticket-modal';
  modal.innerHTML = `<section class="ticket-card premium-ticket-result ticket-result-v21">
    <span class="ticket-ok">✓</span>
    <h3>Turno generado</h3>
    <h2>${escapeHtml(codigo)}</h2>
    <p><strong>${escapeHtml(nombreUsuario || 'Usuario')}</strong></p>
    <p>${escapeHtml(servicio)}</p>
    ${prioritario ? '<p><span class="badge priority-soft">Prioritario</span></p>' : ''}
    ${asesorDestino ? `<p><span class="badge">Dirigido a ${escapeHtml(asesorDestino.nombre)}</span></p>` : ''}
    <p class="muted">Tome asiento. Espere a que su turno sea llamado en la pantalla.</p>
    <button class="btn btn-primary" id="closeTicket">Aceptar</button>
  </section>`;
  document.body.appendChild(modal);
  $('#closeTicket', modal).addEventListener('click', () => modal.remove());
  setTimeout(() => modal.remove(), 12000);
}
