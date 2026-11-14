import './styles/base.css';
import './styles/topbar.css';
import { startShell } from './core/shell.js';
import { init as initServices } from './services/index.js';

const ctx = startShell(document.getElementById('app'));

// Servicios opcionales (Supabase, sincronización). Si fallan, la app sigue con localStorage.
initServices(ctx).catch((err) => console.warn('[services] desactivados:', err));
