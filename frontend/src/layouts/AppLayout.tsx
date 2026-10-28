import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Package,
  Boxes,
  FileSpreadsheet,
  BadgeDollarSign,
  CreditCard,
  UserCheck,
  BarChart3,
  Percent,
  Sparkles,
  FileText,
  Settings,
  LogOut,
  Bell,
  Building2,
  Menu,
  X,
  MessageSquare
} from 'lucide-react';

import { useAuth } from '../contexts/AuthContext';
import { UserAvatar, extractUsernameFromEmail } from '../lib/userAvatar';
import { VoiceAssistantControl } from '../components/VoiceAssistantControl';
import { ScrollableDropdown } from '../modules/sales/components/ScrollableDropdown';
import { useLocalActivo } from '../services/localService';

/** Selector compacto de Local/Sucursal activo para la barra superior. */
const SelectorLocalTopbar: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { local, localesActivos, cambiar } = useLocalActivo();
  if (localesActivos.length === 0) return null;
  return (
    <ScrollableDropdown
      value={local?.id ?? 0}
      onSelect={(v) => cambiar(Number(v))}
      searchable
      placeholder="Local de operativa…"
      className={className}
      options={[
        ...localesActivos.map((l) => ({
          value: l.id,
          label: l.nombre,
          description: `${l.codigo}${l.es_principal ? ' · Matriz' : ''} · ${l.direccion}`,
        })),
      ]}
    />
  );
};

export const AppLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user: authUser, signOut } = useAuth();

  // Close mobile menu automatically on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // Close on Escape key and lock body scroll when mobile drawer is open
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileMenuOpen(false);
      }
    };

    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [mobileMenuOpen]);

  const rawUser = authUser || (localStorage.getItem('salesia_user') ? JSON.parse(localStorage.getItem('salesia_user')!) : {
    full_name: 'Administrador General',
    role: 'ADMINISTRADOR',
    roles: ['ADMINISTRADOR'],
    permisos: ['empresas:configurar'],
    email: 'admin@salesia.com'
  });

  const displayName = rawUser.full_name && !['Colaborador', 'Usuario Registrado'].includes(rawUser.full_name)
    ? rawUser.full_name
    : extractUsernameFromEmail(rawUser.email);

  const user = {
    ...rawUser,
    full_name: displayName,
  };

  const userPermisos: string[] = user.permisos || [];
  const userRoles: string[] = user.roles || (user.role ? [user.role] : []);
  const esAdmin = userRoles.some((r: string) => r.toUpperCase().includes('ADMIN')) || userPermisos.includes('empresas:configurar');
  const hasAnyRole = userRoles.length > 0 && !userRoles.some((r: string) => r.toUpperCase() === 'SIN_ROLES' || r.toUpperCase() === 'SOLICITUD_PENDIENTE');

  const tienePermiso = (codigo?: string) => {
    if (!codigo || esAdmin) return true;
    return userPermisos.includes(codigo);
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  interface NavItem {
    label: string;
    path: string;
    icon: React.ComponentType<{ className?: string }>;
    permiso?: string;
    requireRole?: boolean;
  }

  interface NavGroup {
    group: string;
    items: NavItem[];
  }

  const allNavGroups: NavGroup[] = [
    {
      group: 'PRINCIPAL',
      items: [
        { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard }
      ]
    },
    {
      group: 'COMUNICACIÓN',
      items: [
        { label: 'Chat Empresarial', path: '/chat', icon: MessageSquare, requireRole: true }
      ]
    },
    {
      group: 'GESTIÓN COMERCIAL',
      items: [
        { label: 'Clientes', path: '/customers', icon: Users, permiso: 'clientes:leer' },
        { label: 'Productos', path: '/products', icon: Package, permiso: 'productos:leer' },
        { label: 'Inventario', path: '/inventory', icon: Boxes, permiso: 'inventario:leer' },
        { label: 'Pedidos', path: '/orders', icon: FileSpreadsheet, permiso: 'pedidos:crear' },
        { label: 'Ventas', path: '/sales', icon: BadgeDollarSign, permiso: 'ventas:crear' },
        { label: 'Pagos', path: '/payments', icon: CreditCard, permiso: 'pagos:registrar' }
      ]
    },
    {
      group: 'PERSONAL',
      items: [
        { label: 'Vendedores', path: '/employees', icon: UserCheck, permiso: 'personal:administrar' }
      ]
    },
    {
      group: 'INTELIGENCIA COMERCIAL',
      items: [
        { label: 'Analytics', path: '/analytics', icon: BarChart3, permiso: 'analytics:ver' },
        { label: 'Probabilidades', path: '/probability', icon: Percent, permiso: 'probabilidad:calcular' },
        { label: 'Insights', path: '/insights', icon: Sparkles, permiso: 'insights:ver' },
        { label: 'Reportes', path: '/reports', icon: FileText, permiso: 'reportes:exportar' }
      ]
    },
    {
      group: 'ADMINISTRACIÓN',
      items: [
        { label: 'Locales & Sucursales', path: '/locales', icon: Building2, permiso: 'locales:administrar' },
        { label: 'Configuración & RBAC', path: '/settings', icon: Settings, permiso: 'empresas:configurar' }
      ]
    }
  ];

  const navGroups = allNavGroups
    .map(group => ({
      ...group,
      items: group.items.filter(item => {
        if (item.requireRole && !hasAnyRole) return false;
        return tienePermiso(item.permiso);
      })
    }))
    .filter(group => group.items.length > 0);

  return (
    <div className="flex h-screen w-full bg-slate-50 text-slate-800 antialiased overflow-hidden">
      {/* ==================================================================== */}
      {/* MOBILE DRAWER BACKDROP (Cierra al tocar fuera)                       */}
      {/* ==================================================================== */}
      {mobileMenuOpen && (
        <div
          id="mobile-drawer-backdrop"
          aria-hidden="true"
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-40 lg:hidden transition-opacity duration-300 animate-in fade-in"
        />
      )}

      {/* ==================================================================== */}
      {/* MOBILE SIDEBAR DRAWER (Panel lateral deslizable)                     */}
      {/* ==================================================================== */}
      <aside
        id="mobile-sidebar-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Menú de navegación móvil"
        className={`fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] bg-slate-900 border-r border-slate-800 text-slate-300 flex flex-col select-none shadow-2xl transition-transform duration-300 ease-in-out lg:hidden ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
      >
        {/* Brand Header with Close Button */}
        <div className="h-16 flex items-center justify-between px-4 sm:px-6 border-b border-slate-800 bg-slate-950/70 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-sky-600 via-cyan-500 to-sky-400 flex items-center justify-center text-white shadow-lg shadow-sky-500/20 shrink-0">
              <BadgeDollarSign className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-bold text-base tracking-tight text-white flex items-center gap-1.5">
                SalesIA <span className="text-[10px] uppercase font-semibold tracking-wider bg-cyan-950 text-cyan-400 px-1.5 py-0.5 rounded border border-cyan-800/60">Enterprise</span>
              </h1>
              <p className="text-[10px] text-slate-400">Plataforma Comercial & BI</p>
            </div>
          </div>
          <button
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Cerrar menú"
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation List for Mobile */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
          {navGroups.map((group) => (
            <div key={group.group}>
              <h2 className="px-3 text-[10px] font-semibold text-slate-400 tracking-wider uppercase mb-1.5">
                {group.group}
              </h2>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      onClick={() => setMobileMenuOpen(false)}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-all duration-150 ${isActive
                          ? 'bg-sky-600/90 text-white shadow-sm shadow-sky-600/30 font-semibold'
                          : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                        }`
                      }
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span>{item.label}</span>
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* User Card in Mobile Drawer Footer */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 overflow-hidden min-w-0">
            <UserAvatar nameOrEmail={user.full_name || user.email} size="sm" />
            <div className="overflow-hidden min-w-0">
              <p className="text-xs font-semibold text-slate-100 truncate">{user.full_name}</p>
              <p className="text-[10px] text-cyan-400 font-medium truncate">
                {user.roles && user.roles.length > 0 ? user.roles.join(' • ') : user.role}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setMobileMenuOpen(false);
              handleLogout();
            }}
            title="Cerrar sesión"
            className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-md transition-colors shrink-0"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* ==================================================================== */}
      {/* SIDEBAR DESKTOP (Inalterado en computadoras)                         */}
      {/* ==================================================================== */}
      <aside className="hidden lg:flex flex-col w-64 bg-slate-900 border-r border-slate-800 text-slate-300 select-none shrink-0">
        {/* Brand Header */}
        <div className="h-16 flex items-center px-6 gap-3 border-b border-slate-800 bg-slate-950/60 shrink-0">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-sky-600 via-cyan-500 to-sky-400 flex items-center justify-center text-white shadow-lg shadow-sky-500/20">
            <BadgeDollarSign className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-bold text-base tracking-tight text-white flex items-center gap-1.5">
              SalesIA <span className="text-[10px] uppercase font-semibold tracking-wider bg-cyan-950 text-cyan-400 px-1.5 py-0.5 rounded border border-cyan-800/60">Enterprise</span>
            </h1>
            <p className="text-[11px] text-slate-400">Plataforma Comercial & BI</p>
          </div>
        </div>

        {/* Navigation List */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          {navGroups.map((group) => (
            <div key={group.group}>
              <h2 className="px-3 text-[10px] font-semibold text-slate-400 tracking-wider uppercase mb-1.5">
                {group.group}
              </h2>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-150 ${isActive
                          ? 'bg-sky-600/90 text-white shadow-sm shadow-sky-600/30 font-semibold'
                          : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                        }`
                      }
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span>{item.label}</span>
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* User Card in Footer */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/40 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <UserAvatar nameOrEmail={user.full_name || user.email} size="sm" />
            <div className="overflow-hidden">
              <p className="text-xs font-semibold text-slate-100 truncate">{user.full_name}</p>
              <p className="text-[10px] text-cyan-400 font-medium truncate">
                {user.roles && user.roles.length > 0 ? user.roles.join(' • ') : user.role}
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            title="Cerrar sesión"
            className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-md transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* ==================================================================== */}
      {/* MAIN CONTAINER (Topbar + Outlet)                                     */}
      {/* ==================================================================== */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* TOPBAR */}
        <header className="h-16 bg-white border-b border-slate-200 px-3 sm:px-6 flex items-center justify-between shadow-xs z-10 shrink-0">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            {/* Hamburger button visible on mobile (< lg) */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Abrir menú de navegación"
              className="lg:hidden p-2 text-slate-700 hover:text-sky-600 hover:bg-slate-100 rounded-lg transition-colors shrink-0 focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              <Menu className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
            <div className="flex items-center gap-1.5 sm:gap-2 text-xs text-slate-500 font-medium min-w-0">
              <Building2 className="w-4 h-4 text-sky-600 shrink-0" />
              <span className="truncate max-w-[120px] sm:max-w-none">SalesIA Tech Solutions S.A.C.</span>
              <span className="text-slate-300 hidden sm:inline">/</span>
              <div className="hidden md:block w-44 lg:w-56 z-50 relative">
                <SelectorLocalTopbar className="z-50" />
              </div>
              <span className="hidden sm:inline bg-sky-50 text-sky-700 px-2 py-0.5 rounded-full text-[11px] font-semibold border border-sky-200 whitespace-nowrap">
                USD • IGV 18%
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Asistente de Voz Interactivo */}
            <VoiceAssistantControl />

            <div className="flex items-center gap-1.5 sm:gap-2 border border-slate-200 px-2 sm:px-3 py-1.5 rounded-lg bg-slate-50 text-[11px] sm:text-xs text-slate-600">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0"></div>
              <span className="hidden sm:inline">Base de datos Supabase Activa</span>
              <span className="sm:hidden font-medium">DB Activa</span>
            </div>

            {/* Logo de usuario e inicial en la cabecera */}
            <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
              <UserAvatar nameOrEmail={user.full_name || user.email} size="xs" />
              <div className="hidden md:flex flex-col text-left">
                <span className="text-xs font-bold text-slate-800 leading-tight">{user.full_name}</span>
                <span className="text-[10px] text-slate-400 leading-none">{user.email}</span>
              </div>
            </div>

            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 border border-slate-200">
              <Bell className="w-4 h-4" />
            </div>
          </div>
        </header>

        {/* PAGE CONTENT */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden bg-slate-50/50 p-3.5 sm:p-5 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

