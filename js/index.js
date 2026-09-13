import { initSupabase, currentSession, loadProfile, roleHome } from './core.js';

(async () => {
  const ok = await initSupabase();
  if (!ok) return;
  if (!currentSession) {
    window.location.replace('login.html');
    return;
  }
  const profile = await loadProfile().catch(() => null);
  window.location.replace(roleHome(profile));
})();
