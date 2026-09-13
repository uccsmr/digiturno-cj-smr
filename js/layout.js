import {
  $, appRoot, initSupabase, loadProfile, appConfig,
  escapeHtml, signOut, renderNoProfile, renderForbidden, showFatalError
} from './core.js';

const menuItems = [
  { key: 'dashboard', label: 'Inicio', icon: '⌂', href: 'dashboard.html', roles: ['Administrador'] },
  { key: 'asesor', label: 'Panel Asesor', icon: '👥', href: 'asesor.html', roles: ['Administrador', 'Asesor'] },
  { key: 'servicios', label: 'Servicios', icon: '▤', href: 'servicios.html', roles: ['Administrador'] },
  { key: 'puntos', label: 'Puntos de atención', icon: '⌖', href: 'puntos-atencion.html', roles: ['Administrador'] },
  { key: 'usuarios', label: 'Usuarios', icon: '☷', href: 'usuarios.html', roles: ['Administrador'] },
  { key: 'reportes', label: 'Reportes', icon: '▥', href: 'reportes.html', roles: ['Administrador'] },
  { key: 'configuracion', label: 'Configuración', icon: '⚙', href: 'configuracion.html', roles: ['Administrador'] }
];

function renderMenu(profile, active){
  const mainLinks = menuItems
    .filter(item => item.roles.includes(profile.rol))
    .map(item => `
      <a href="${item.href}" data-nav="${item.key}" class="${item.key === active ? 'active' : ''}">
        <span class="nav-icon" aria-hidden="true">${item.icon}</span>
        <span>${item.label}</span>
      </a>
    `).join('');

  const externalLinks = profile.rol === 'Administrador'
    ? `<div class="nav-separator"></div>
       <a href="kiosco.html" target="_blank" rel="noopener">
        <span class="nav-icon" aria-hidden="true">▣</span>
        <span>Abrir Kiosco</span>
       </a>
       <a href="pantalla.html" target="_blank" rel="noopener">
        <span class="nav-icon" aria-hidden="true">▣</span>
        <span>Abrir Pantalla TV</span>
       </a>`
    : '';

  return `${mainLinks}${externalLinks}`;
}

export async function renderProtectedPage({ active, allowedRoles = ['Administrador'], render }){
  try {
    const ok = await initSupabase();
    if (!ok) return;

    const { currentSession } = await import('./core.js');
    if (!currentSession) {
      window.location.href = 'login.html';
      return;
    }

    const profile = await loadProfile();
    if (!profile) return renderNoProfile();

    if (allowedRoles.length && !allowedRoles.includes(profile.rol)) {
      return renderForbidden('Su rol no tiene acceso a esta página.');
    }

    const logo = appConfig?.logo || 'assets/img/logo_ucc_horizontal.png';
    const initials = (profile.nombre || profile.email || 'U')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map(p => p[0]?.toUpperCase() || '')
      .join('');

    appRoot().innerHTML = `
      <div class="app-layout admin-shell">
        <aside class="sidebar admin-sidebar">
          <div class="brand admin-brand">
            <div class="brand-logo"><img src="${logo}" alt="Universidad Cooperativa de Colombia"></div>
            <div>
              <strong>Digiturno Jurídico</strong>
              <small>${escapeHtml(profile.rol)}</small>
            </div>
          </div>

          <div class="sidebar-user-card">
            <div class="user-avatar">${escapeHtml(initials || 'U')}</div>
            <div>
              <strong>${escapeHtml(profile.nombre || 'Usuario')}</strong>
              <small>${escapeHtml(profile.rol || '')}</small>
              <span><i></i> En línea</span>
            </div>
          </div>

          <nav class="admin-nav">
            ${renderMenu(profile, active)}
          </nav>

          <div class="sidebar-art" aria-hidden="true">
            <div class="art-curve art-blue"></div>
            <div class="art-curve art-green"></div>
            <p>Formamos<br><strong>profesionales</strong><br>con sentido social</p>
            <b></b>
          </div>

          <div class="sidebar-footer admin-sidebar-footer">
            <span>${escapeHtml(profile.nombre || profile.email || '')}</span>
            <button class="btn btn-danger btn-small" id="logoutBtn">Cerrar sesión</button>
          </div>
        </aside>
        <main class="content admin-content" id="content"></main>
      </div>`;

    $('#logoutBtn')?.addEventListener('click', signOut);
    await render($('#content'), profile);
  } catch (error) {
    showFatalError(error, 'No fue posible cargar la página');
  }
}

export function adminOnly(active, render){
  return renderProtectedPage({ active, allowedRoles: ['Administrador'], render });
}

export function advisorPage(active, render){
  return renderProtectedPage({ active, allowedRoles: ['Administrador', 'Asesor'], render });
}
