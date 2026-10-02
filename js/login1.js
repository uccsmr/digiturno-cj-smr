import { $, appRoot, initSupabase, loadProfile, appConfig, currentSession, escapeHtml, roleHome, supabase, renderNoProfile, showFatalError } from './core.js';

(async () => {
  try {
    const ok = await initSupabase();
    if (!ok) return;
    if (currentSession) {
      const profile = await loadProfile().catch(() => null);
      if (profile) {
        window.location.replace(roleHome(profile));
        return;
      }
      return renderNoProfile();
    }
    renderLogin();
  } catch (error) {
    showFatalError(error, 'No fue posible iniciar sesión');
  }
})();

function renderLogin(){
  appRoot().innerHTML = `<main class="login-page"><section class="login-card">
    <img src="${appConfig?.logo || 'assets/img/logo_ucc_horizontal.png'}" alt="UCC">
    <h1>Digiturno Jurídico</h1>
    <p>Acceso para administradores y asesores.</p>
    <div id="loginMsg"></div>
    <form id="loginForm" class="form-stack">
      <label>Correo<input name="email" type="email" required placeholder="admin@correo.com" autocomplete="username"></label>
      <label>Contraseña<input name="password" type="password" required autocomplete="current-password"></label>
      <button class="btn btn-primary" type="submit">Ingresar</button>
    </form>
    <div class="action-row" style="justify-content:center;margin-top:16px">
      <a class="btn btn-outline" href="kiosco.html">Abrir Kiosco</a>
      <a class="btn btn-outline" href="pantalla.html">Abrir Pantalla TV</a>
    </div>
  </section></main>`;

  $('#loginForm').addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const msg = $('#loginMsg');
    msg.innerHTML = '';
    const { error } = await supabase.auth.signInWithPassword({
      email: fd.get('email'),
      password: fd.get('password')
    });
    if (error) {
      msg.innerHTML = `<div class="alert alert-danger">${escapeHtml(error.message)}</div>`;
      return;
    }
    window.location.href = 'dashboard.html';
  });
}
