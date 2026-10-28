/**
 * Dropdown personalizado reutilizable de SalesIA Enterprise.
 *
 * Características:
 *  - Se despliega al pasar el cursor sobre el control y también por clic.
 *  - El desplazamiento con la RUEDA dentro de la lista afecta ÚNICAMENTE a la lista:
 *    nunca encadena el scroll hacia el resto de la página
 *    (CSS overscroll-behavior: contain + bloqueo nativo de wheel a mano).
 *  - Filtro de BÚSQUEDA POR PALABRAS en tiempo real dentro del desplegable.
 */
import React, { useState, useRef, useMemo } from 'react';
import { ChevronDown, Search, Check } from 'lucide-react';

export interface DropdownOption {
  value: string | number;
  label: string;
  description?: string;
}

interface ScrollableDropdownProps {
  value: string | number;
  onSelect: (value: string | number) => void;
  options: DropdownOption[];
  placeholder?: string;
  /** Muestra el campo de búsqueda por palabras dentro del desplegable */
  searchable?: boolean;
  className?: string;
}

/** Normaliza texto: minúsculas y sin acentos, para búsqueda robusta */
function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export const ScrollableDropdown: React.FC<ScrollableDropdownProps> = ({
  value,
  onSelect,
  options,
  placeholder = 'Seleccionar…',
  searchable = false,
  className = '',
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const seleccionada = options.find((o) => String(o.value) === String(value));

  // Filtrado por palabras (múltiples términos deben coincidir todos)
  const opcionesFiltradas = useMemo(() => {
    const q = normalizar(query.trim());
    if (!q) return options;
    const terminos = q.split(/\s+/).filter(Boolean);
    return options.filter((o) => {
      const objetivo = normalizar(o.label + ' ' + (o.description || ''));
      return terminos.every((t) => objetivo.includes(t));
    });
  }, [options, query]);

  // ------------------------------------------------------------------
  // Apertura por hover (con gracia para permitir el paso del cursor)
  // ------------------------------------------------------------------
  const abrirAlHover = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    setOpen(true);
  };

  const cerrarConRetraso = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpen(false), 220);
  };

  // ------------------------------------------------------------------
  // RUEDA DEL MOUSE: scroll SOLO dentro de la lista, sin arrastrar la página
  // ------------------------------------------------------------------
  React.useEffect(() => {
    const list = listRef.current;
    if (!open || !list) return;
    const handler = (e: WheelEvent) => {
      const scrollable = list.scrollHeight > list.clientHeight;
      if (!scrollable) {
        e.preventDefault(); // nada que desplazar: tampoco debe moverse la página
        return;
      }
      const goingDown = e.deltaY > 0;
      const arriba = list.scrollTop <= 0 && !goingDown;
      const abajo = list.scrollTop + list.clientHeight >= list.scrollHeight - 1 && goingDown;
      if (arriba || abajo) e.preventDefault(); // bloquea el encadenado hacia la página
    };
    list.addEventListener('wheel', handler, { passive: false });
    return () => list.removeEventListener('wheel', handler);
  }, [open]);

  // Cierre con ESC y con clic fuera
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [open]);

  const elegir = (v: string | number) => {
    onSelect(v);
    setOpen(false);
    setQuery('');
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}
      onMouseEnter={abrirAlHover}
      onMouseLeave={cerrarConRetraso}
    >
      {/* Control: apariencia de un select nativo */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-2 bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs text-left focus:outline-none focus:border-sky-500 hover:border-slate-300 transition-colors cursor-pointer"
      >
        <span className={`truncate ${seleccionada ? 'text-slate-800' : 'text-slate-400'}`}>
          {seleccionada ? seleccionada.label : placeholder}
        </span>
        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Panel desplegable */}
      {open && (
        <div className="absolute z-40 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden max-h-64 flex flex-col">
          {searchable && (
            <div className="p-2 border-b border-slate-100 bg-slate-50/70 flex items-center gap-2">
              <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por palabra…"
                className="w-full text-xs bg-transparent border-none focus:outline-none placeholder-slate-400 text-slate-800"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          )}

          <div ref={listRef} className="overflow-y-auto overscroll-contain" style={{ overscrollBehavior: 'contain' }}>
            {opcionesFiltradas.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4">Sin resultados para "{query}"</p>
            ) : (
              opcionesFiltradas.map((o) => {
                const activo = String(o.value) === String(value);
                return (
                  <button
                    key={String(o.value)}
                    type="button"
                    onClick={() => elegir(o.value)}
                    className={`w-full text-left px-3 py-2 flex items-start justify-between gap-2 text-xs transition-colors cursor-pointer ${
                      activo ? 'bg-sky-50' : 'hover:bg-slate-50'
                    }`}
                  >
                    <span className={`min-w-0 ${activo ? 'text-sky-700 font-semibold' : 'text-slate-700'}`}>
                      <span className="block truncate">{o.label}</span>
                      {o.description && <span className="block text-[10px] text-slate-400 truncate">{o.description}</span>}
                    </span>
                    {activo && <Check className="w-3.5 h-3.5 text-sky-600 shrink-0 mt-0.5" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ScrollableDropdown;
