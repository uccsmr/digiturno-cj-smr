import {
  $, appRoot, initSupabase, appConfig, currentSession, escapeHtml,
  roleHome, supabase, renderNoProfile, showFatalError, loadProfile
} from './core.js';

(async () => {
  try {
    const ok = await initSupabase();
    if (!ok) return;

    // Si ya existe una sesión, enviar al usuario directamente a su página inicial.
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

function normalizeLogin(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return '';
  return raw.includes('@') ? raw : `${raw}@digiturno.local`;
}

function renderLogin(){
  appRoot().innerHTML = `<main class="login-page"><section class="login-card">
    <img src="${appConfig?.logo || 'assets/img/logo_ucc_horizontal.png'}" alt="UCC">
    <h1>Digiturno Jurídico</h1>
    <p>Acceso autorizado al sistema.</p>
    <div id="loginMsg"></div>
    <form id="loginForm" class="form-stack">
      <label>Usuario o correo
        <input name="email" type="text" required placeholder="asesor1, adminconsultorio, kiosco o correo" autocomplete="username">
      </label>
      <label>Contraseña
        <input name="password" type="password" required autocomplete="current-password">
      </label>
      <button class="btn btn-primary" type="submit">Ingresar</button>
    </form>
  </section></main>`;

  $('#loginForm').addEventListener('submit', async e => {
    e.preventDefault();

    const fd = new FormData(e.target);
    const msg = $('#loginMsg');
    const submitButton = e.target.querySelector('button[type="submit"]');
    const email = normalizeLogin(fd.get('email'));
    const password = String(fd.get('password') || '');

    msg.innerHTML = '';
    if (submitButton) submitButton.disabled = true;

    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (authError) {
        msg.innerHTML = `<div class="alert alert-danger">Usuario o contraseña incorrectos.</div>`;
        return;
      }

      // Consultar el perfil con el ID retornado por Auth evita depender de que
      // el evento onAuthStateChange haya terminado antes de la redirección.
      const userId = authData?.user?.id;
      if (!userId) {
        msg.innerHTML = `<div class="alert alert-danger">No fue posible identificar el usuario autenticado.</div>`;
        await supabase.auth.signOut();
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from('perfiles')
        .select('*, puntos_atencion(nombre_punto)')
        .eq('id_usuario', userId)
        .maybeSingle();

      if (profileError) {
        msg.innerHTML = `<div class="alert alert-danger">No fue posible consultar el perfil: ${escapeHtml(profileError.message)}</div>`;
        await supabase.auth.signOut();
        return;
      }

      if (!profile) {
        msg.innerHTML = `<div class="alert alert-danger">El usuario existe en Supabase Auth, pero no tiene un perfil configurado en el Digiturno.</div>`;
        await supabase.auth.signOut();
        return;
      }

      if (profile.estado !== 'Activo') {
        msg.innerHTML = `<div class="alert alert-danger">El usuario se encuentra inactivo.</div>`;
        await supabase.auth.signOut();
        return;
      }

      // Redirección real según el rol. Nunca enviar todos los perfiles al dashboard.
      window.location.replace(roleHome(profile));
    } catch (error) {
      console.error('Error de inicio de sesión:', error);
      msg.innerHTML = `<div class="alert alert-danger">No fue posible iniciar sesión. Intente nuevamente.</div>`;
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });
}
