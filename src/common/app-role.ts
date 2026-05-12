/**
 * App Role — controls which features are active at runtime.
 *
 * Usage:
 *   APP_ROLE=api     → REST + WebSocket only   (multi-instance, behind LB)
 *   APP_ROLE=worker  → Cron + seed only         (single-instance)
 *   APP_ROLE=all     → Both API + Worker        (dev default)
 */

export enum AppRole {
  API = 'api',
  WORKER = 'worker',
  ALL = 'all',
}

export function getAppRole(): AppRole {
  const role = (process.env.APP_ROLE || 'all').toLowerCase();
  if (Object.values(AppRole).includes(role as AppRole)) {
    return role as AppRole;
  }
  return AppRole.ALL;
}

/** True when this instance should serve HTTP + WebSocket */
export function isApi(): boolean {
  const role = getAppRole();
  return role === AppRole.API || role === AppRole.ALL;
}

/** True when this instance should run cron jobs + seed */
export function isWorker(): boolean {
  const role = getAppRole();
  return role === AppRole.WORKER || role === AppRole.ALL;
}

/** True when running in production */
export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}
