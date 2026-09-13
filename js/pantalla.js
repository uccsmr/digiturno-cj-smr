
import { $, appRoot, initSupabase, loadConfig, appConfig, supabase, today, pad, escapeHtml } from './core.js';

let clockTimer = null;
let refreshTimer = null;
let tvChannel = null;
let soundEnabled = true;
let lastSpokenKey = null;
let carousel = [];
let carouselIndex = 0;
let carouselTimer = null;

(async () => {
  const ok = await initSupabase();
  if (!ok) return;
  await renderScreen();
})().catch(error => {
  console.error('Error iniciando pantalla TV:', error);
  appRoot().innerHTML = `<main class="tv-fatal"><section><h1>Error en Pantalla TV</h1><p>${escapeHtml(error.message || error)}</p></section></main>`;
});

async function renderScreen(){
  await loadConfig();
  const message = cleanWelcome(appConfig.mensaje_pantalla || 'Bienvenido. Tome asiento y esté atento al llamado de su turno.');
  appRoot().innerHTML = `
    <main class="tv-page-premium" aria-label="Pantalla TV del Digiturno Jurídico">
      <section class="tv-shell-premium">
        <header class="tv-header-premium">
          <div class="tv-branding-premium">
            <img class="tv-logo-ucc" src="${escapeHtml(appConfig.logo || 'assets/img/logo_ucc_horizontal.png')}" alt="Universidad Cooperativa de Colombia">
            <span class="tv-brand-separator"></span>
            <img class="tv-logo-clinic" src="${escapeHtml(appConfig.logo_pantalla || 'assets/img/logo_consultorio_juridico.png')}" alt="Consultorio Jurídico">
          </div>
          <div class="tv-welcome-premium">
            <span>Bienvenido</span>
            <strong>${escapeHtml(message.replace(/^Bienvenido\.\s*/i, ''))}</strong>
          </div>
          <div class="tv-clock-premium">
            <strong id="tvClock">--:--</strong>
            <span id="tvDate">--</span>
          </div>
        </header>

        <section class="tv-body-premium">
          <aside class="tv-queue-premium">
            <div class="tv-section-title">
              <span>Turnos activos</span>
              <b id="activeCount">0</b>
            </div>
            <div id="activeList" class="tv-active-list">
              <article class="tv-empty-card">Sin turnos activos</article>
            </div>
          </aside>

          <section class="tv-main-premium">
            <div class="tv-carousel-card">
              <div id="imageCarousel" class="tv-image-carousel" aria-label="Carrusel institucional"></div>
              <div class="carousel-dots" id="carouselDots"></div>
            </div>
            <article class="tv-current-call-premium" id="currentCall">
              <div>
                <span>LLAMANDO</span>
                <strong>En espera de llamados</strong>
                <small>Diríjase a: --</small>
              </div>
            </article>
          </section>
        </section>

        <footer class="tv-footer-premium">
          <button class="tv-sound-btn is-on" id="soundBtn" type="button">🔊 Sonido activo</button>
          <div class="tv-footer-text" id="footerText">${escapeHtml(appConfig.franja_inferior || 'Consultorio Jurídico y Centro de Conciliación · Tome asiento y esté atento al llamado de su turno')}</div>
        </footer>
      </section>
    </main>`;

  $('#soundBtn')?.addEventListener('click', toggleSound);
  startClock();
  setupCarousel();
  await refreshTurns();
  setupRealtime();
  const ms = Math.max(2000, Number(appConfig.tiempo_actualizacion || 3000));
  clearInterval(refreshTimer);
  refreshTimer = setInterval(refreshTurns, ms);
}

function cleanWelcome(text){
  return String(text || '').replace(/^(Bienvenido\.\s*){2,}/i, 'Bienvenido. ');
}

function startClock(){
  function paint(){
    const now = new Date();
    const clock = $('#tvClock');
    const date = $('#tvDate');
    if (clock) clock.textContent = now.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
    if (date) date.textContent = now.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }
  paint();
  clearInterval(clockTimer);
  clockTimer = setInterval(paint, 30000);
}

function setupCarousel(){
  const raw = appConfig.imagenes_pantalla || appConfig.videos_pantalla || '';
  carousel = String(raw).split(/\n|,|;/).map(x => x.trim()).filter(Boolean)
    .filter(path => !/\.mp4($|\?)/i.test(path));
  if (!carousel.length) {
    carousel = [
      'assets/img/logo_ucc_horizontal.png',
      'assets/img/logo_consultorio_juridico.png'
    ];
  }
  carouselIndex = 0;
  renderCarousel();
  clearInterval(carouselTimer);
  carouselTimer = setInterval(() => {
    carouselIndex = (carouselIndex + 1) % carousel.length;
    renderCarousel();
  }, 6500);
}

function renderCarousel(){
  const box = $('#imageCarousel');
  const dots = $('#carouselDots');
  if (!box) return;
  const src = carousel[carouselIndex];
  box.innerHTML = `<div class="carousel-gradient"></div><img src="${escapeHtml(src)}" alt="Imagen institucional" onerror="this.style.display='none'; this.parentElement.classList.add('no-image');">`;
  if (dots) {
    dots.innerHTML = carousel.map((_, i) => `<span class="${i === carouselIndex ? 'active' : ''}"></span>`).join('');
  }
}

async function refreshTurns(){
  const { data: actual, error: actualError } = await supabase
    .from('turnos')
    .select('*, servicios(nombre_servicio,prefijo), puntos_atencion(nombre_punto)')
    .eq('fecha', today())
    .in('estado', ['Llamado', 'En atención'])
    .order('hora_llamado', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (actualError) console.warn('Error cargando turno llamado:', actualError.message);

  const { data: activos, error: activosError } = await supabase
    .from('turnos')
    .select('*, servicios(nombre_servicio,prefijo), puntos_atencion(nombre_punto)')
    .eq('fecha', today())
    .in('estado', ['En espera', 'Transferido', 'Llamado', 'En atención'])
    .order('prioridad', { ascending: false })
    .order('hora_generado', { ascending: true })
    .limit(14);

  if (activosError) console.warn('Error cargando turnos activos:', activosError.message);

  renderCurrentCall(actual);
  renderActiveList(activos || []);
}

function getTurnUser(t){
  return t?.nombre_usuario || t?.nombre_cliente || t?.usuario_nombre || '';
}

function renderActiveList(turnos){
  const list = $('#activeList');
  const count = $('#activeCount');
  if (count) count.textContent = String(turnos.length || 0);
  if (!list) return;
  if (!turnos.length) {
    list.innerHTML = '<article class="tv-empty-card">Sin turnos activos</article>';
    return;
  }

  list.innerHTML = turnos.map((t, i) => {
    const service = t.servicios?.nombre_servicio || 'Servicio';
    const userName = getTurnUser(t);
    const isWaiting = ['En espera', 'Transferido'].includes(t.estado);
    const pointText = isWaiting ? 'En espera' : (t.puntos_atencion?.nombre_punto || 'Punto pendiente');
    const stateClass = isWaiting ? 'is-waiting' : (t.estado === 'En atención' ? 'is-attending' : 'is-called');
    const priority = Number(t.prioridad || 0) > 0;
    return `
      <article class="tv-active-card ${stateClass} ${priority ? 'is-priority' : ''}">
        <div class="tv-active-index">${pad(i + 1)}</div>
        <div class="tv-active-info">
          <strong>${escapeHtml(t.codigo_turno)}</strong>
          ${userName ? `<span class="tv-user-name">${escapeHtml(userName)}</span>` : ''}
          <small>${escapeHtml(service)}</small>
        </div>
        <div class="tv-active-target">
          ${priority ? '<em>Prioritario</em>' : ''}
          <b>${escapeHtml(pointText)}</b>
        </div>
      </article>`;
  }).join('');
}

function renderCurrentCall(t){
  const box = $('#currentCall');
  if (!box) return;
  if (!t) {
    box.innerHTML = `<div><span>LLAMANDO</span><strong>En espera de llamados</strong><small>Diríjase a: --</small></div>`;
    return;
  }
  const userName = getTurnUser(t);
  const point = t.puntos_atencion?.nombre_punto || 'Punto pendiente';
  const service = t.servicios?.nombre_servicio || '';
  box.innerHTML = `
    <div>
      <span>LLAMANDO</span>
      <strong>${escapeHtml(t.codigo_turno)}</strong>
      ${userName ? `<p>${escapeHtml(userName)}</p>` : ''}
      <small>${escapeHtml(service)} · Diríjase a: ${escapeHtml(point)}</small>
    </div>`;
  speakTurn(t);
}

function speakTurn(t){
  if (!soundEnabled || !('speechSynthesis' in window) || !t) return;
  const key = `${t.id_turno}-${t.llamado_version || 0}-${t.hora_llamado || ''}`;
  if (lastSpokenKey === key) return;
  lastSpokenKey = key;
  const userName = getTurnUser(t);
  const point = t.puntos_atencion?.nombre_punto || 'punto de atención';
  const text = userName
    ? `Turno ${t.codigo_turno}. ${userName}. Diríjase a ${point}.`
    : `Turno ${t.codigo_turno}. Diríjase a ${point}.`;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'es-CO';
  utterance.rate = 0.9;
  utterance.pitch = 1;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

function toggleSound(){
  soundEnabled = !soundEnabled;
  const btn = $('#soundBtn');
  if (!btn) return;
  btn.classList.toggle('is-on', soundEnabled);
  btn.textContent = soundEnabled ? '🔊 Sonido activo' : '🔇 Sonido pausado';
}

function setupRealtime(){
  if (tvChannel) supabase.removeChannel(tvChannel);
  tvChannel = supabase
    .channel('pantalla-tv-premium-turnos')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'turnos' }, refreshTurns)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'configuracion' }, async () => { await loadConfig(); setupCarousel(); await refreshTurns(); })
    .subscribe();
}
