/**
 * SalesIA Enterprise — Gestión del "Local Activo" (Sucursal de operativa).
 *
 * El local activo se persiste en localStorage (`salesia_local_activo`) y se
 * propaga a todos los módulos vía un evento de ventana personalizado. Esto
 * permite que Ventas emita comprobantes con la serie del local, el PDF muestre
 * la dirección del local y los tableros filtren por sede, sin base de datos.
 */
import { useEffect, useMemo, useState } from 'react';
import type { Local } from '../types';
import { getLocalesSync, getLocalByIdSync } from './mockDataService';

/** localStorage: identificador del local activo */
export const LOCAL_ACTIVO_KEY = 'salesia_local_activo';

/** Evento de ventana que notifica cambios de local activo o del catálogo */
export const EV_LOCAL_ACTIVO = 'salesia:local-activo';

export function notificarCambioLocal(): void {
  window.dispatchEvent(new Event(EV_LOCAL_ACTIVO));
}

/** Identificador del local activo persistido (default: el principal). */
export function getLocalActivoId(): number {
  const raw = localStorage.getItem(LOCAL_ACTIVO_KEY);
  const id = raw ? Number(raw) : NaN;
  if (!Number.isFinite(id)) {
    const principal = getLocalesSync().find(l => l.es_principal);
    return principal?.id ?? 1;
  }
  return id;
}

export function getLocalActivo(): Local | null {
  return getLocalByIdSync(getLocalActivoId());
}

/** Cambia el local activo (persistente) y notifica a toda la app. */
export function setLocalActivo(id: number): void {
  localStorage.setItem(LOCAL_ACTIVO_KEY, String(id));
  notificarCambioLocal();
}

/**
 * Hook de React: reacciona al cambio de local activo y al CRUD de locales.
 * Devuelve el local activo con fallback a la matriz, y utilidades de consulta.
 */
export function useLocalActivo(): {
  /** Local activo (o matriz si el activo ya no existe / se desactivó) */
  local: Local | null;
  /** id crudo persistido */
  localActivoId: number;
  /** Catálogo completo de locales (incluye inactivos) */
  locales: Local[];
  /** Solo locales habilitados para operar/emisión */
  localesActivos: Local[];
  /** Nombre del local por id (con fallback seguro) */
  nombreDe: (id?: number | string | null) => string;
  /** Cambia el local activo global */
  cambiar: (id: number) => void;
} {
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const handler = () => setVersion(v => v + 1);
    window.addEventListener(EV_LOCAL_ACTIVO, handler);
    window.addEventListener('storage', handler);
    return () => {
      window.removeEventListener(EV_LOCAL_ACTIVO, handler);
      window.removeEventListener('storage', handler);
    };
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const locales = useMemo(() => getLocalesSync(), [version]);
  const localesActivos = useMemo(() => locales.filter(l => l.is_active), [locales]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const local = useMemo(() => {
    const id = getLocalActivoId();
    const encontrado = localesActivos.find(l => l.id === id);
    return encontrado || localesActivos.find(l => l.es_principal) || localesActivos[0] || null;
  }, [locales, localesActivos, version]);

  const nombreDe = (id?: number | string | null): string => {
    if (id === undefined || id === null || id === '') return 'Local no asignado';
    const l = getLocalByIdSync(Number(id));
    return l ? l.nombre : 'Local no asignado';
  };

  const cambiar = (id: number): void => setLocalActivo(id);

  return { local, localActivoId: local?.id ?? getLocalActivoId(), locales, localesActivos, nombreDe, cambiar };
}

export default useLocalActivo;
