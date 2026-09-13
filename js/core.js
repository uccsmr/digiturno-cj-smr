import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_CONFIG_READY } from './supabase-config.js';

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const today = () => new Date().toISOString().slice(0, 10);
export const fmtTime = v => v ? new Date(v).toLocaleTimeString('es-CO') : '-';
export const pad = n => String(n).padStart(2, '0');
export const escapeHtml = (s = '') => String(s).replace(/[&<>'"]/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
}[c]));

export let supabase = null;
export let currentSession = null;
export let currentProfile = null;
export let appConfig = null;

export function appRoot(){
  return $('#app');
}

export function setupPendingView(){
  return `<main class="login-page"><section class="login-card">
    <img src="assets/img/logo_ucc_horizontal.png" alt="Universidad Cooperativa de Colombia">
    <h1>Digiturno Jurídico</h1>
    <div class="alert alert-info">Falta configurar Supabase.</div>
    <p>Abra <b>js/supabase-config.js</b>, pegue la URL y la llave pública anon/publishable, y cambie <b>SUPABASE_CONFIG_READY</b> a <b>true</b>.</p>
  </section></main>`;
}

export async function initSupabase(){
  if (!SUPABASE_CONFIG_READY) {
    appRoot().innerHTML = setupPendingView();
    return false;
  }
  if (!supabase) {
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true }
    });
  }
  const { data } = await supabase.auth.getSession();
  currentSession = data.session;
  await loadConfig();
  supabase.auth.onAuthStateChange(async (_event, session) => {
    currentSession = session;
    currentProfile = null;
    await loadConfig();
  });
  return true;
}

export async function loadConfig(){
  if (!supabase) return null;
  const { data } = await supabase
    .from('configuracion')
    .select('*')
    .eq('id_configuracion', 1)
    .maybeSingle();
  appConfig = data || {
    nombre_entidad: 'Consultorio Jurídico y Centro de Conciliación',
    logo: 'assets/img/logo_ucc_horizontal.png',
    logo_pantalla: 'assets/img/logo_consultorio_juridico.png',
    mensaje_pantalla: 'Bienvenido. Tome asiento y esté atento al llamado de su turno.',
    videos_pantalla: 'assets/videos/Balance_social_2025.mp4',
    imagenes_pantalla: 'assets/img/logo_ucc_horizontal.png\nassets/img/logo_consultorio_juridico.png',
    franja_inferior: 'Consultorio Jurídico y Centro de Conciliación · Tome asiento y esté atento al llamado de su turno',
    tiempo_actualizacion: 3000
  };
  return appConfig;
}

export async function loadProfile(force = false){
  if (currentProfile && !force) return currentProfile;
  if (!currentSession) return null;
  const { data, error } = await supabase
    .from('perfiles')
    .select('*, puntos_atencion(nombre_punto)')
    .eq('id_usuario', currentSession.user.id)
    .maybeSingle();
  if (error) {
    console.warn('Error cargando perfil:', error.message);
    throw error;
  }
  currentProfile = data;
  return currentProfile;
}

export function isAdmin(){
  return currentProfile?.rol === 'Administrador';
}

export function isAdvisor(){
  return ['Administrador', 'Asesor'].includes(currentProfile?.rol);
}

export async function signOut(){
  if (supabase) await supabase.auth.signOut();
  window.location.href = 'login.html';
}

export function roleHome(profile = currentProfile){
  if (!profile) return 'login.html';
  if (profile.rol === 'Asesor') return 'asesor.html';
  if (profile.rol === 'Pantalla') return 'pantalla.html';
  return 'dashboard.html';
}

export function renderNoProfile(){
  appRoot().innerHTML = `<main class="login-page"><section class="login-card">
    <img src="${appConfig?.logo || 'assets/img/logo_ucc_horizontal.png'}" alt="UCC">
    <h1>Perfil pendiente</h1>
    <div class="alert alert-info">Su cuenta existe en Supabase Auth, pero todavía no tiene perfil en la tabla <b>perfiles</b>.</div>
    <p>Solicite al administrador crear o activar su perfil con el ID:</p>
    <code>${escapeHtml(currentSession?.user?.id || '')}</code>
    <div class="action-row" style="justify-content:center;margin-top:18px">
      <button class="btn btn-danger" id="logoutBtn">Cerrar sesión</button>
    </div>
  </section></main>`;
  $('#logoutBtn')?.addEventListener('click', signOut);
}

export function renderForbidden(message = 'No tiene permisos para este módulo.'){
  appRoot().innerHTML = `<main class="login-page"><section class="login-card">
    <img src="${appConfig?.logo || 'assets/img/logo_ucc_horizontal.png'}" alt="UCC">
    <h1>Acceso restringido</h1>
    <div class="alert alert-danger">${escapeHtml(message)}</div>
    <div class="action-row" style="justify-content:center;margin-top:18px">
      <a class="btn btn-primary" href="${roleHome()}">Volver</a>
      <button class="btn btn-danger" id="logoutBtn">Cerrar sesión</button>
    </div>
  </section></main>`;
  $('#logoutBtn')?.addEventListener('click', signOut);
}

export function showFatalError(error, context = 'Ocurrió un error'){
  console.error(context, error);
  appRoot().innerHTML = `<main class="login-page"><section class="login-card">
    <img src="${appConfig?.logo || 'assets/img/logo_ucc_horizontal.png'}" alt="UCC">
    <h1>Error</h1>
    <div class="alert alert-danger">${escapeHtml(context)}: ${escapeHtml(error?.message || error || 'Error desconocido')}</div>
    <div class="action-row" style="justify-content:center;margin-top:18px">
      <a class="btn btn-outline" href="login.html">Volver al inicio</a>
    </div>
  </section></main>`;
}

export function fillForm(formId, data){
  const f = $(`#${formId}`);
  if (!f || !data) return;
  Object.entries(data).forEach(([k, v]) => {
    if (f.elements[k]) f.elements[k].value = v ?? '';
  });
}

export function jsonAttr(obj){
  return escapeHtml(JSON.stringify(obj || {}));
}
