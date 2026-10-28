import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp,
  CreditCard,
  Clock,
  AlertTriangle,
  ShoppingBag,
  Package,
  ShieldCheck,
  CheckCircle2,
  Info,
  ArrowRight,
  Sparkles,
  HelpCircle,
  Calculator,
  ChevronDown,
  ChevronUp,
  Activity,
  BarChart3,
  Percent,
  CheckCircle,
  FileSpreadsheet,
  SlidersHorizontal,
  PieChart as PieChartIcon,
  LineChart as LineChartIcon
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, CartesianGrid, Legend
} from 'recharts';
import { getDashboardSummary, getSales, getAllPayments } from '../../services/mockDataService';
import { useLocalActivo } from '../../services/localService';
import { DashboardSummary, Sale } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { useVoiceAssistant } from '../../contexts/VoiceAssistantContext';
import { ScrollableDropdown } from '../sales/components/ScrollableDropdown';

import { ProjectLoadingScreen } from '../../components/ProjectLoadingScreen';

// ---------------------------------------------------------------------------
// WIDGETS ACTIVABLES DEL DASHBOARD (persistencia por usuario en localStorage)
// ---------------------------------------------------------------------------
type WidgetId = 'chartTrend' | 'chartCategories' | 'chartPayments' | 'chartCollection' | 'panelRecent' | 'panelRotation' | 'panelCobranza';

const DASHBOARD_WIDGETS: Array<{ id: WidgetId; label: string; description: string }> = [
  { id: 'chartTrend', label: 'Tendencia Mensual de Ventas', description: 'Gráfico de área: evolución de la facturación mes a mes.' },
  { id: 'chartCategories', label: 'Ventas por Categoría', description: 'Gráfico de barras: ingresos consolidados por línea de producto.' },
  { id: 'chartPayments', label: 'Métodos de Pago', description: 'Gráfico circular: distribución de la recaudación por canal de cobro.' },
  { id: 'chartCollection', label: 'Cobrado vs Pendiente', description: 'Gráfico comparativo: tesorería recaudada frente a saldo por cobrar.' },
  { id: 'panelCobranza', label: 'Cobranza Pendiente (Cartera)', description: 'Saldo por cobrar, deuda viva y principales deudores según el local.' },
  { id: 'panelRecent', label: 'Ventas Recientes (Tabla)', description: 'Listado auditado de las últimas 5 operaciones.' },
  { id: 'panelRotation', label: 'Rotación de Artículos', description: 'Ranking de productos por volumen despachado.' },
];

const WIDGETS_STORAGE_KEY = 'salesia_dashboard_widgets';

const DEFAULT_WIDGETS_ON: Record<WidgetId, boolean> = {
  chartTrend: true,
  chartCategories: true,
  chartPayments: true,
  chartCollection: true,
  panelCobranza: true,
  panelRecent: true,
  panelRotation: true,
};

function cargarWidgets(): Record<WidgetId, boolean> {
  try {
    const guardado = localStorage.getItem(WIDGETS_STORAGE_KEY);
    if (guardado) return { ...DEFAULT_WIDGETS_ON, ...JSON.parse(guardado) };
  } catch { /* Estado por defecto */ }
  return { ...DEFAULT_WIDGETS_ON };
}

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [showGuide, setShowGuide] = useState(true);
  const [activeTab, setActiveTab] = useState<'todos' | 'financiero' | 'almacen'>('todos');
  const [widgets, setWidgets] = useState<Record<WidgetId, boolean>>(cargarWidgets);
  const [widgetsPanelOpen, setWidgetsPanelOpen] = useState(false);
  const { user } = useAuth();
  const { playDashboardWelcome, stopAll } = useVoiceAssistant();
  // Local/Sucursal de operativa: los KPIs y gráficos se recortan a esa sede
  const { local: localActivo, localesActivos, cambiar } = useLocalActivo();

  const toggleWidget = (id: WidgetId) => {
    setWidgets(prev => {
      const next = { ...prev, [id]: !prev[id] };
      localStorage.setItem(WIDGETS_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  const activeWidgetCount = DASHBOARD_WIDGETS.filter(w => widgets[w.id]).length;

  const { data, isLoading, error } = useQuery<DashboardSummary>({
    queryKey: ['dashboardSummary'],
    queryFn: async () => {
      return await getDashboardSummary();
    },
    refetchInterval: 30000,
  });

  // Historial comercial (fuente de datos de los gráficos activables)
  const { data: allSales = [] } = useQuery<Sale[]>({
    queryKey: ['sales'],
    queryFn: async () => await getSales(),
  });

  const pagosRegistrados = useMemo(() => getAllPayments(), []);

  // --- RECORTE POR LOCAL: ventas y pagos de la sede activa (o todo si es global) ---
  const salesFiltradasLocal = useMemo(
    () => (!localActivo ? allSales : allSales.filter(s => s.local_id === localActivo.id)),
    [allSales, localActivo]
  );
  const pagosFiltrados = useMemo(() => {
    if (!localActivo) return pagosRegistrados;
    const ids = new Set(salesFiltradasLocal.map(s => s.id));
    return pagosRegistrados.filter(p => ids.has(p.sale_id));
  }, [pagosRegistrados, salesFiltradasLocal, localActivo]);

  // KPIs recalculados para el local activo; en vista global usa el resumen estático
  const kpis = useMemo<DashboardSummary>(() => {
    if (!data) return data as unknown as DashboardSummary; // aún cargando
    if (!localActivo) return data;
    const confirmadas = salesFiltradasLocal.filter(s => s.status === 'CONFIRMED');
    const recientes = [...salesFiltradasLocal]
      .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
      .slice(0, 5)
      .map(s => ({
        id: s.id,
        sale_code: s.sale_code,
        customer_name: s.customer_name,
        total_amount: s.total_amount,
        payment_status: s.payment_status,
        created_at: s.created_at,
      }));
    const porProducto = new Map<string, { product_id: number; sku: string; product_name: string; units_sold: number; revenue: number }>();
    confirmadas.forEach(s => (s.items || []).forEach((it: any) => {
      const k = String(it.product_id);
      const cur = porProducto.get(k) || { product_id: it.product_id, sku: it.product_sku, product_name: it.product_name, units_sold: 0, revenue: 0 };
      cur.units_sold += Number(it.quantity || 0);
      cur.revenue += Number(it.line_total || 0);
      porProducto.set(k, cur);
    }));
    return {
      ...data,
      confirmed_sales_total: confirmadas.reduce((acc, s) => acc + Number(s.total_amount), 0),
      collected_cash_total: pagosFiltrados.reduce((acc, p) => acc + Number(p.amount), 0),
      active_customers_count: new Set(salesFiltradasLocal.map(s => s.customer_id)).size,
      recent_sales: recientes,
      top_selling_products: Array.from(porProducto.values())
        .sort((a, b) => b.units_sold - a.units_sold)
        .slice(0, 5)
        .map(t => ({ product_id: t.product_id, sku: t.sku, product_name: t.product_name, units_sold: t.units_sold, total_revenue: Math.round(t.revenue * 100) / 100 })),
      // Pedidos e inventario no dependen del local en este modelo: se conservan globales
      pending_orders_count: data.pending_orders_count,
      active_products_count: data.active_products_count,
      low_stock_products_count: data.low_stock_products_count,
      low_stock_alerts: data.low_stock_alerts,
    };
  }, [data, localActivo, salesFiltradasLocal, pagosFiltrados]);

  // --- Tendencia mensual de facturación (ventas confirmadas por mes) ---
  const datosTendencia = useMemo(() => {
    const porMes = new Map<string, number>();
    salesFiltradasLocal
      .filter(s => s.status === 'CONFIRMED')
      .forEach(s => {
        const clave = new Date(s.created_at).toLocaleDateString('es-PE', { month: 'short', year: '2-digit' });
        // Ordenar correctamente usa la fecha ISO, así que guardamos también el mes real
        porMes.set(clave, (porMes.get(clave) || 0) + Number(s.total_amount));
      });
    // Orden cronológico por fecha ISO del primer registro de cada mes
    const ordenMeses = new Map<string, number>();
    salesFiltradasLocal.forEach(s => {
      const clave = new Date(s.created_at).toLocaleDateString('es-PE', { month: 'short', year: '2-digit' });
      const ts = new Date(s.created_at).getTime();
      ordenMeses.set(clave, Math.min(ordenMeses.get(clave) ?? Number.MAX_SAFE_INTEGER, ts));
    });
    return Array.from(porMes.entries())
      .sort((a, b) => (ordenMeses.get(a[0]) || 0) - (ordenMeses.get(b[0]) || 0))
      .map(([mes, total]) => ({ mes: mes.replace('.', ''), total: Math.round(total * 100) / 100 }));
  }, [salesFiltradasLocal]);

  // --- Consolidado de ingresos por categoría de producto ---
  const datosCategorias = useMemo(() => {
    const porCategoria = new Map<string, number>();
    salesFiltradasLocal
      .filter(s => s.status === 'CONFIRMED')
      .forEach(s => {
        (s.items || []).forEach((it: any) => {
          const cat = it.category_name || 'General';
          porCategoria.set(cat, (porCategoria.get(cat) || 0) + Number(it.line_total || it.line_subtotal || 0));
        });
      });
    const palette = ['#0ea5e9', '#f59e0b', '#10b981', '#8b5cf6', '#ef4444', '#0f172a'];
    return Array.from(porCategoria.entries())
      .map(([categoria, total], i) => ({ categoria, total: Math.round(total * 100) / 100, fill: palette[i % palette.length] }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);
  }, [salesFiltradasLocal]);

  // --- Distribución de la recaudación por método de pago ---
  const datosMetodosPago = useMemo(() => {
    const porMetodo = new Map<string, number>();
    pagosFiltrados.forEach(p => {
      porMetodo.set(p.payment_method_name, (porMetodo.get(p.payment_method_name) || 0) + Number(p.amount));
    });
    const palette = ['#0f172a', '#0ea5e9', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444'];
    return Array.from(porMetodo.entries())
      .map(([metodo, monto], i) => ({ metodo, monto: Math.round(monto * 100) / 100, fill: palette[i % palette.length] }))
      .sort((a, b) => b.monto - a.monto);
  }, [pagosFiltrados]);

  // --- Cobrado frente a pendiente de cobro ---
  const datosCobranza = useMemo(() => {
    const confirmadas = salesFiltradasLocal.filter(s => s.status === 'CONFIRMED');
    const cobrado = confirmadas.reduce((acc, s) => acc + Number(s.paid_amount || 0), 0);
    const pendiente = confirmadas.reduce((acc, s) => acc + Number(s.pending_balance || 0), 0);
    return [
      { concepto: 'Cobrado', monto: Math.round(cobrado * 100) / 100, fill: '#10b981' },
      { concepto: 'Pendiente', monto: Math.round(pendiente * 100) / 100, fill: '#f59e0b' },
    ];
  }, [salesFiltradasLocal]);

  // --- Cartera de cobranza pendiente (deuda viva por local activo) ---
  const carteraPendiente = useMemo(() => {
    const pendientes = salesFiltradasLocal
      .filter(s => s.status === 'CONFIRMED' && Number(s.pending_balance || 0) > 0)
      .sort((a, b) => Number(b.pending_balance) - Number(a.pending_balance));
    return {
      total: pendientes.reduce((acc, s) => acc + Number(s.pending_balance || 0), 0),
      operaciones: pendientes.length,
      deudores: pendientes.slice(0, 5).map(s => ({
        id: s.id,
        sale_code: s.sale_code,
        customer_name: s.customer_name,
        saldo: Number(s.pending_balance || 0),
        payment_status: s.payment_status,
        serie: s.document_series ? `${s.document_series}-${String(s.document_number || 0).padStart(8, '0')}` : s.sale_code,
      })),
    };
  }, [salesFiltradasLocal]);

  const fmtDolares = (v: number) => `$${Number(v).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

  // Bienvenida por voz al ingresar al Dashboard principal (con nombre y dato de la empresa)
  useEffect(() => {
    if (data && !isLoading) {
      const cleanName = user?.full_name || (user?.email ? user.email.split('@')[0] : 'Administrador');
      const companyStat = kpis?.confirmed_sales_total
        ? `La facturación confirmada de la empresa es de ${Math.round(Number(kpis.confirmed_sales_total)).toLocaleString()} dólares.`
        : 'Las operaciones de ventas e inventario se encuentran sincronizadas.';
      playDashboardWelcome(cleanName, companyStat);
    }
  }, [data, kpis, isLoading, user, playDashboardWelcome]);

  // Al desmontar o salir del Dashboard, detener inmediatamente cualquier locución
  useEffect(() => {
    return () => {
      stopAll();
    };
  }, [stopAll]);

  if (isLoading) {
    return (
      <ProjectLoadingScreen
        inline
        message="Sincronizando consola operativa y métricas de seguridad..."
        subtitle="CloudGuard • AWS Security Console"
      />
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-xs flex items-center gap-3">
        <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
        <span>Error al cargar los indicadores operativos del Dashboard.</span>
      </div>
    );
  }

  // Tasa de efectividad de cobranza (según el local activo)
  const salesTotal = Number(kpis?.confirmed_sales_total) || 1;
  const cashTotal = Number(kpis?.collected_cash_total) || 0;
  const collectionRate = Math.min(100, Math.round((cashTotal / salesTotal) * 100));

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* ========================================================================= */}
      {/* HEADER MINIMALISTA CON INDICADORES Y SELECTOR DE VISTA                   */}
      {/* ========================================================================= */}
      <div className="bg-white p-5 sm:p-6 rounded-3xl border border-neutral-200/80 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-neutral-900 text-white flex items-center justify-center shadow-xs">
                <Activity className="w-4 h-4" />
              </div>
              <h1 className="text-xl font-bold text-neutral-900 tracking-tight">Dashboard General</h1>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />

              </span>
            </div>
            <p className="text-xs text-neutral-500">
              Consola de supervisión ejecutiva: ventas, tesorería, reservas e inventario físico auditado.
            </p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">Local de operativa:</span>
              <div className="w-52">
                <ScrollableDropdown
                  value={localActivo?.id ?? ''}
                  onSelect={(v) => cambiar(Number(v))}
                  searchable
                  placeholder="Consolidado Global"
                  options={localesActivos.map(l => ({
                    value: l.id,
                    label: l.nombre,
                    description: `${l.codigo}${l.es_principal ? ' · Matriz' : ''} · ${l.direccion}`,
                  }))}
                />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-start sm:self-auto">
            {/* Panel de activación de widgets (gráficos on/off) */}
            <div className="relative">
              <button
                onClick={() => setWidgetsPanelOpen(!widgetsPanelOpen)}
                className={`inline-flex items-center gap-1.5 text-xs border px-3 py-2 rounded-xl font-medium transition-colors cursor-pointer ${
                  widgetsPanelOpen
                    ? 'bg-neutral-900 text-white border-neutral-900'
                    : 'bg-neutral-50 hover:bg-neutral-100 border-neutral-200 text-neutral-700'
                }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Personalizar</span>
                <span className={`px-1.5 rounded-full text-[10px] font-bold ${widgetsPanelOpen ? 'bg-white/20' : 'bg-neutral-200 text-neutral-700'}`}>
                  {activeWidgetCount}/{DASHBOARD_WIDGETS.length}
                </span>
              </button>

              {widgetsPanelOpen && (
                <div className="absolute right-0 top-full mt-2 w-72 bg-white border border-neutral-200 rounded-2xl shadow-xl z-20 p-3 space-y-1.5 max-h-80 overflow-y-auto">
                  <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider px-1 pb-1.5 border-b border-neutral-100">
                    Activar / Desactivar Gráficos
                  </p>
                  {DASHBOARD_WIDGETS.map((w) => (
                    <div key={w.id} className="flex items-start justify-between gap-2 p-2 rounded-xl hover:bg-neutral-50 transition-colors">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-neutral-900 leading-tight">{w.label}</p>
                        <p className="text-[10px] text-neutral-400 leading-snug mt-0.5">{w.description}</p>
                      </div>
                      {/* Switch minimalist style */}
                      <button
                        onClick={() => toggleWidget(w.id)}
                        role="switch"
                        aria-checked={widgets[w.id]}
                        className={`relative w-9 h-5 rounded-full shrink-0 transition-colors cursor-pointer ${widgets[w.id] ? 'bg-emerald-500' : 'bg-neutral-300'}`}
                      >
                        <span
                          className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${widgets[w.id] ? 'translate-x-[18px] left-0.5' : 'left-0.5'}`}
                        />
                      </button>
                    </div>
                  ))}
                  <p className="text-[10px] text-neutral-400 px-1 pt-1 border-t border-neutral-100">
                    Tu configuración se guarda automáticamente.
                  </p>
                </div>
              )}
            </div>

            <button
              onClick={() => setShowGuide(!showGuide)}
              className="inline-flex items-center gap-1.5 text-xs bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 px-3 py-2 rounded-xl font-medium text-neutral-700 transition-colors cursor-pointer"
            >
              <HelpCircle className="w-3.5 h-3.5 text-neutral-500" />
              <span>{showGuide ? 'Ocultar Guía' : 'Explicación del Módulo'}</span>
              {showGuide ? <ChevronUp className="w-3.5 h-3.5 text-neutral-400" /> : <ChevronDown className="w-3.5 h-3.5 text-neutral-400" />}
            </button>

            <div className="inline-flex items-center gap-1.5 text-xs bg-neutral-100 border border-neutral-200 px-3 py-2 rounded-xl text-neutral-800 font-medium">
              <ShieldCheck className="w-4 h-4 text-neutral-700 shrink-0" />
              <span>Cifrado TLS 1.3</span>
            </div>
          </div>
        </div>

        {/* Pestañas de filtrado minimalistas */}
        <div className="flex items-center gap-2 pt-2 border-t border-neutral-100">
          <button
            onClick={() => setActiveTab('todos')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${activeTab === 'todos'
              ? 'bg-neutral-900 text-white shadow-xs'
              : 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100'
              }`}
          >
            Vista Integral
          </button>
          <button
            onClick={() => setActiveTab('financiero')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${activeTab === 'financiero'
              ? 'bg-neutral-900 text-white shadow-xs'
              : 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100'
              }`}
          >
            Flujo Financiero
          </button>
          <button
            onClick={() => setActiveTab('almacen')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${activeTab === 'almacen'
              ? 'bg-neutral-900 text-white shadow-xs'
              : 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100'
              }`}
          >
            Salud de Almacén
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* CARDS CHICAS INFORMATIVAS MINIMALISTAS (EXPLICAN EL MÓDULO)              */}
      {/* ========================================================================= */}
      {showGuide && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 animate-in fade-in duration-200">
          <div className="p-4 bg-white border border-neutral-200/90 rounded-2xl shadow-2xs hover:border-neutral-300 transition-all group">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2 text-neutral-900 font-semibold text-xs">
                <div className="w-6 h-6 rounded-lg bg-neutral-100 text-neutral-800 flex items-center justify-center text-[11px] font-bold">
                  1
                </div>
                <span>¿En qué consiste el Dashboard?</span>
              </div>
              <Info className="w-3.5 h-3.5 text-neutral-400 group-hover:text-neutral-700 transition-colors" />
            </div>
            <p className="text-[11px] text-neutral-600 leading-relaxed">
              Consola unificada que agrega compromisos mercantiles facturados, tesorería disponible y existencias críticas de inventario.
            </p>
          </div>

          <div className="p-4 bg-white border border-neutral-200/90 rounded-2xl shadow-2xs hover:border-neutral-300 transition-all group">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2 text-neutral-900 font-semibold text-xs">
                <div className="w-6 h-6 rounded-lg bg-neutral-100 text-neutral-800 flex items-center justify-center text-[11px] font-bold">
                  2
                </div>
                <span>Aislamiento de Cifras</span>
              </div>
              <CheckCircle className="w-3.5 h-3.5 text-neutral-400 group-hover:text-neutral-700 transition-colors" />
            </div>
            <p className="text-[11px] text-neutral-600 leading-relaxed">
              <strong>Ventas</strong>: Facturas comerciales emitidas. <strong>Cobros</strong>: Dinero efectivamente recaudado en cuenta. <strong>Pedidos</strong>: Solicitudes en trámite.
            </p>
          </div>

          <div className="p-4 bg-white border border-neutral-200/90 rounded-2xl shadow-2xs hover:border-neutral-300 transition-all group">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2 text-neutral-900 font-semibold text-xs">
                <div className="w-6 h-6 rounded-lg bg-neutral-100 text-neutral-800 flex items-center justify-center text-[11px] font-bold">
                  3
                </div>
                <span>Navegación e Interacción</span>
              </div>
              <Sparkles className="w-3.5 h-3.5 text-neutral-400 group-hover:text-neutral-700 transition-colors" />
            </div>
            <p className="text-[11px] text-neutral-600 leading-relaxed">
              Usa los botones de acción rápida para registrar operaciones con deducción directa de inventario o calcular modelos estadísticos.
            </p>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* GRID DE KPIs PRINCIPALES CON ANIMACIONES HOVER Y DETALLE DE CONVERSIÓN    */}
      {/* ========================================================================= */}
      {(activeTab === 'todos' || activeTab === 'financiero') && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* KPI 1: Ventas Confirmadas */}
          <div className="bg-white border border-neutral-200/80 rounded-3xl p-5 shadow-xs hover:shadow-lg hover:-translate-y-1 transition-all duration-200 group">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider">Ventas Confirmadas</span>
              <div className="w-9 h-9 rounded-2xl bg-neutral-100 text-neutral-800 flex items-center justify-center group-hover:bg-neutral-900 group-hover:text-white transition-colors shadow-2xs">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3.5">
              <h3 className="text-2xl font-bold text-neutral-900 tracking-tight">
                ${Number(kpis?.confirmed_sales_total).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </h3>
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-neutral-100 text-[10px] text-neutral-500">
                <span>Total facturación válida</span>
                <span className="font-semibold text-neutral-800">Compromiso</span>
              </div>
            </div>
          </div>

          {/* KPI 2: Ingresos Cobrados */}
          <div className="bg-white border border-neutral-200/80 rounded-3xl p-5 shadow-xs hover:shadow-lg hover:-translate-y-1 transition-all duration-200 group">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider">Ingresos Cobrados</span>
              <div className="w-9 h-9 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-colors shadow-2xs">
                <CreditCard className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3.5">
              <h3 className="text-2xl font-bold text-neutral-900 tracking-tight">
                ${Number(kpis?.collected_cash_total).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </h3>
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-neutral-100 text-[10px] text-neutral-500">
                <span>Efectivo en tesorería</span>
                <span className="font-semibold text-emerald-700">{collectionRate}% Cobrado</span>
              </div>
            </div>
          </div>

          {/* KPI 3: Pedidos Pendientes */}
          <div className="bg-white border border-neutral-200/80 rounded-3xl p-5 shadow-xs hover:shadow-lg hover:-translate-y-1 transition-all duration-200 group">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider">Pedidos en Trámite</span>
              <div className="w-9 h-9 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center group-hover:bg-amber-600 group-hover:text-white transition-colors shadow-2xs">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3.5">
              <h3 className="text-2xl font-bold text-neutral-900 tracking-tight">
                {kpis?.pending_orders_count}
              </h3>
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-neutral-100 text-[10px] text-neutral-500">
                <span>Órdenes por liquidar</span>
                <span className="font-semibold text-amber-700">Por Despachar</span>
              </div>
            </div>
          </div>

          {/* KPI 4: Stock Crítico */}
          <div className="bg-white border border-neutral-200/80 rounded-3xl p-5 shadow-xs hover:shadow-lg hover:-translate-y-1 transition-all duration-200 group">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider">Stock Crítico</span>
              <div className="w-9 h-9 rounded-2xl bg-rose-50 text-rose-700 flex items-center justify-center group-hover:bg-rose-600 group-hover:text-white transition-colors shadow-2xs">
                <AlertTriangle className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3.5">
              <h3 className="text-2xl font-bold text-rose-700 tracking-tight">
                {kpis?.low_stock_products_count}
              </h3>
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-neutral-100 text-[10px] text-neutral-500">
                <span>Bajo punto de reorden</span>
                <span className="font-semibold text-rose-700">Reabastecer</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TARJETA: COBRANZA PENDIENTE (cartera de crédito del local activo)         */}
      {/* ========================================================================= */}
      {(activeTab === 'todos' || activeTab === 'financiero') && widgets.panelCobranza && (
        <div className="bg-white border border-neutral-200/80 rounded-3xl p-5 sm:p-6 shadow-xs">
          <div className="flex flex-col lg:flex-row lg:items-center gap-5">
            {/* Resumen de deuda viva */}
            <div className="lg:w-72 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-700 border border-amber-200/70 flex items-center justify-center">
                  <CreditCard className="w-3.5 h-3.5" />
                </div>
                <h3 className="text-sm font-bold text-neutral-900">Cobranza Pendiente</h3>
              </div>
              <h3 className="text-2xl font-bold text-amber-700 tracking-tight mt-3">
                ${carteraPendiente.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </h3>
              <p className="text-[11px] text-neutral-500 mt-1">
                {carteraPendiente.operaciones} {carteraPendiente.operaciones === 1 ? 'operación' : 'operaciones'} con saldo vivo
                {localActivo ? ` · ${localActivo.nombre}` : ' · Consolidado global'}
              </p>
              <button
                onClick={() => navigate('/payments')}
                className="mt-3 inline-flex items-center gap-1.5 bg-neutral-900 hover:bg-neutral-700 text-white px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer"
              >
                Ir a Cobranzas
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Principales deudores */}
            <div className="flex-1 min-w-0">
              {carteraPendiente.deudores.length === 0 ? (
                <div className="flex items-center gap-2 p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200/70 text-xs text-emerald-800">
                  <CheckCircle className="w-4 h-4 shrink-0" />
                  <span>Cartera limpia: no hay saldos pendientes de cobro en este ámbito.</span>
                </div>
              ) : (
                <div className="overflow-x-auto -mx-1 px-1">
                  <table className="w-full text-left border-collapse min-w-[420px]">
                    <thead>
                      <tr className="border-b border-neutral-100 text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
                        <th className="pb-3">Cliente</th>
                        <th className="pb-3">Comprobante</th>
                        <th className="pb-3 text-right">Saldo</th>
                        <th className="pb-3 text-right">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100 text-xs">
                      {carteraPendiente.deudores.map((d) => (
                        <tr key={d.id} className="hover:bg-neutral-50/80 transition-colors">
                          <td className="py-2.5 text-neutral-700 truncate max-w-[180px]">{d.customer_name}</td>
                          <td className="py-2.5 font-mono text-[11px] text-neutral-500">{d.serie}</td>
                          <td className="py-2.5 text-right font-mono font-bold text-rose-600">
                            ${d.saldo.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-2.5 text-right">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              d.payment_status === 'PARTIAL'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200/70'
                                : 'bg-rose-50 text-rose-700 border border-rose-200/70'
                            }`}>
                              {d.payment_status === 'PARTIAL' ? 'PARCIAL' : 'PENDIENTE'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* BARRA DE SALUD DE RECAUDACIÓN Y CONVERSIÓN FINANCIERA                     */}
      {/* ========================================================================= */}
      {(activeTab === 'todos' || activeTab === 'financiero') && (
        <div className="bg-white border border-neutral-200/80 rounded-3xl p-5 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-neutral-100 text-neutral-800 flex items-center justify-center shrink-0">
              <Percent className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-neutral-900">Efectividad de Cobro de Facturación</h4>
              <p className="text-[11px] text-neutral-500">
                ${cashTotal.toLocaleString()} cobrados de ${salesTotal.toLocaleString()} facturados en el periodo
              </p>
            </div>
          </div>

          <div className="w-full sm:w-72 space-y-1.5">
            <div className="flex justify-between text-xs font-semibold text-neutral-800">
              <span>Recaudación</span>
              <span>{collectionRate}%</span>
            </div>
            <div className="w-full h-2.5 bg-neutral-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-neutral-900 rounded-full transition-all duration-500"
                style={{ width: `${collectionRate}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* GRÁFICOS ANALÍTICOS ACTIVABLES (Personalizar → ON/OFF por widget)         */}
      {/* ========================================================================= */}
      {(activeTab === 'todos' || activeTab === 'financiero') && widgets.chartTrend && (
        <div className="bg-white border border-neutral-200/80 rounded-3xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <LineChartIcon className="w-4 h-4 text-neutral-700" />
              <h3 className="text-xs font-bold text-neutral-900 uppercase tracking-wider">Tendencia Mensual de Facturación</h3>
            </div>
            <span className="text-[11px] text-neutral-400">Ventas confirmadas por mes (USD)</span>
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={datosTendencia} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradVentas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0f172a" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#0f172a" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f1f1" vertical={false} />
                <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#737373' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#a3a3a3' }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: any) => [fmtDolares(Number(v)), 'Facturado']} contentStyle={{ borderRadius: 12, fontSize: 11, border: '1px solid #e5e5e5' }} />
                <Area type="monotone" dataKey="total" stroke="#0f172a" strokeWidth={2} fill="url(#gradVentas)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {(activeTab === 'todos' || activeTab === 'almacen') && widgets.chartCategories && (
        <div className="bg-white border border-neutral-200/80 rounded-3xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-neutral-700" />
              <h3 className="text-xs font-bold text-neutral-900 uppercase tracking-wider">Ingresos por Categoría</h3>
            </div>
            <span className="text-[11px] text-neutral-400">Consolidado por línea de producto</span>
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={datosCategorias} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f1f1" vertical={false} />
                <XAxis dataKey="categoria" tick={{ fontSize: 10, fill: '#737373' }} axisLine={false} tickLine={false} interval={0} tickFormatter={(v: string) => (v.length > 12 ? `${v.slice(0, 11)}…` : v)} />
                <YAxis tick={{ fontSize: 11, fill: '#a3a3a3' }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip cursor={{ fill: 'rgba(0,0,0,0.03)' }} formatter={(v: any) => [fmtDolares(Number(v)), 'Ingreso']} contentStyle={{ borderRadius: 12, fontSize: 11, border: '1px solid #e5e5e5' }} />
                <Bar dataKey="total" radius={[8, 8, 0, 0]} barSize={38}>
                  {datosCategorias.map((entry) => (
                    <Cell key={entry.categoria} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {(activeTab === 'todos' || activeTab === 'financiero') && widgets.chartPayments && (
        <div className="bg-white border border-neutral-200/80 rounded-3xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <PieChartIcon className="w-4 h-4 text-neutral-700" />
              <h3 className="text-xs font-bold text-neutral-900 uppercase tracking-wider">Recaudación por Método de Pago</h3>
            </div>
            <span className="text-[11px] text-neutral-400">Distribución del efectivo cobrado</span>
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={datosMetodosPago}
                  dataKey="monto"
                  nameKey="metodo"
                  innerRadius={48}
                  outerRadius={78}
                  paddingAngle={3}
                  strokeWidth={0}
                >
                  {datosMetodosPago.map((entry) => (
                    <Cell key={entry.metodo} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: any, n: any) => [fmtDolares(Number(v)), n]} contentStyle={{ borderRadius: 12, fontSize: 11, border: '1px solid #e5e5e5' }} />
                <Legend wrapperStyle={{ fontSize: 10 }} iconType="circle" iconSize={7} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {(activeTab === 'todos' || activeTab === 'financiero') && widgets.chartCollection && (
        <div className="bg-white border border-neutral-200/80 rounded-3xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-neutral-700" />
              <h3 className="text-xs font-bold text-neutral-900 uppercase tracking-wider">Tesorería: Cobrado vs Pendiente</h3>
            </div>
            <span className="text-[11px] text-neutral-400">Estado de la cobranza global</span>
          </div>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={datosCobranza} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f1f1" vertical={false} />
                <XAxis dataKey="concepto" tick={{ fontSize: 11, fill: '#737373' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#a3a3a3' }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip cursor={{ fill: 'rgba(0,0,0,0.03)' }} formatter={(v: any) => [fmtDolares(Number(v)), 'Monto']} contentStyle={{ borderRadius: 12, fontSize: 11, border: '1px solid #e5e5e5' }} />
                <Bar dataKey="monto" radius={[8, 8, 0, 0]} barSize={80}>
                  {datosCobranza.map((entry) => (
                    <Cell key={entry.concepto} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ACCIONES OPERATIVAS CON CARDS Y DESCRIPCIONES DE CADA BOTÓN               */}
      {/* ========================================================================= */}
      <div className="bg-white border border-neutral-200/80 rounded-3xl p-5 sm:p-6 shadow-xs space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-neutral-800" />
            <h3 className="text-xs font-bold text-neutral-900 uppercase tracking-wider">
              Acciones y Módulos del Sistema
            </h3>
          </div>
          <span className="text-[11px] text-neutral-400">Guía de operación de cada sección</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          <button
            onClick={() => navigate('/sales')}
            className="p-4 text-left rounded-2xl bg-neutral-50/80 hover:bg-neutral-100 border border-neutral-200/70 transition-all hover:scale-[1.01] active:scale-[0.99] group cursor-pointer"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="w-7 h-7 rounded-lg bg-neutral-900 text-white flex items-center justify-center">
                <ShoppingBag className="w-3.5 h-3.5" />
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-neutral-400 group-hover:translate-x-1 transition-transform" />
            </div>
            <h4 className="font-semibold text-xs text-neutral-900 group-hover:text-black">Registrar Venta</h4>
            <p className="text-[10px] text-neutral-500 mt-1 leading-normal">
              Emite una orden mercantil con reserva inmediata en el kardex de inventario.
            </p>
          </button>

          <button
            onClick={() => navigate('/inventory')}
            className="p-4 text-left rounded-2xl bg-neutral-50/80 hover:bg-neutral-100 border border-neutral-200/70 transition-all hover:scale-[1.01] active:scale-[0.99] group cursor-pointer"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="w-7 h-7 rounded-lg bg-neutral-900 text-white flex items-center justify-center">
                <Package className="w-3.5 h-3.5" />
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-neutral-400 group-hover:translate-x-1 transition-transform" />
            </div>
            <h4 className="font-semibold text-xs text-neutral-900 group-hover:text-black">Auditar Almacén</h4>
            <p className="text-[10px] text-neutral-500 mt-1 leading-normal">
              Ajusta existencias físicas por recepción de proveedor o mermas operativas.
            </p>
          </button>

          <button
            onClick={() => navigate('/probability')}
            className="p-4 text-left rounded-2xl bg-neutral-50/80 hover:bg-neutral-100 border border-neutral-200/70 transition-all hover:scale-[1.01] active:scale-[0.99] group cursor-pointer"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="w-7 h-7 rounded-lg bg-neutral-900 text-white flex items-center justify-center">
                <Calculator className="w-3.5 h-3.5" />
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-neutral-400 group-hover:translate-x-1 transition-transform" />
            </div>
            <h4 className="font-semibold text-xs text-neutral-900 group-hover:text-black">Inferencia Bayesiana</h4>
            <p className="text-[10px] text-neutral-500 mt-1 leading-normal">
              Modela probabilidades condicionales a posteriori basadas en ventas históricas.
            </p>
          </button>

          <button
            onClick={() => navigate('/reports')}
            className="p-4 text-left rounded-2xl bg-neutral-50/80 hover:bg-neutral-100 border border-neutral-200/70 transition-all hover:scale-[1.01] active:scale-[0.99] group cursor-pointer"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="w-7 h-7 rounded-lg bg-neutral-900 text-white flex items-center justify-center">
                <FileSpreadsheet className="w-3.5 h-3.5" />
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-neutral-400 group-hover:translate-x-1 transition-transform" />
            </div>
            <h4 className="font-semibold text-xs text-neutral-900 group-hover:text-black">Exportar Cierre</h4>
            <p className="text-[10px] text-neutral-500 mt-1 leading-normal">
              Descarga balances contables en formatos tabulares listos para auditoría.
            </p>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* DOS COLUMNAS: VENTAS AUDITADAS & PRODUCTOS CON ROTACIÓN                   */}
      {/* ========================================================================= */}
      {(activeTab === 'todos' || activeTab === 'almacen' || activeTab === 'financiero') && (widgets.panelRecent || widgets.panelRotation) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Ventas Recientes */}
          {(activeTab !== 'almacen' || widgets.panelRecent) && widgets.panelRecent && (
          <div className="bg-white border border-neutral-200/80 rounded-3xl p-5 sm:p-6 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-neutral-100 text-neutral-800 flex items-center justify-center">
                  <ShoppingBag className="w-3.5 h-3.5" />
                </div>
                <h3 className="text-sm font-bold text-neutral-900">Ventas Recientes Auditadas</h3>
              </div>
              <span className="text-[11px] text-neutral-400 font-medium">Últimas 5 operaciones</span>
            </div>

            <div className="overflow-x-auto -mx-5 px-5">
              <table className="w-full text-left border-collapse min-w-[420px]">
                <thead>
                  <tr className="border-b border-neutral-100 text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
                    <th className="pb-3">Código</th>
                    <th className="pb-3">Cliente</th>
                    <th className="pb-3 text-right">Monto</th>
                    <th className="pb-3 text-right">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 text-xs">
                  {kpis?.recent_sales?.map((sale) => (
                    <tr key={sale.id} className="hover:bg-neutral-50/80 transition-colors">
                      <td className="py-3 font-semibold text-neutral-900 font-mono text-[11px]">{sale.sale_code}</td>
                      <td className="py-3 text-neutral-600 truncate max-w-[150px]">{sale.customer_name}</td>
                      <td className="py-3 text-right font-medium text-neutral-900">
                        ${Number(sale.total_amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 text-right">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold ${sale.payment_status === 'PAID'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/70'
                          : sale.payment_status === 'PARTIAL'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200/70'
                            : 'bg-rose-50 text-rose-700 border border-rose-200/70'
                          }`}>
                          {sale.payment_status === 'PAID' ? 'COBRADO' : sale.payment_status === 'PARTIAL' ? 'PARCIAL' : 'PENDIENTE'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          )}

          {/* Productos con Mayor Rotación */}
          {widgets.panelRotation && (
          <div className="bg-white border border-neutral-200/80 rounded-3xl p-5 sm:p-6 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-neutral-100 text-neutral-800 flex items-center justify-center">
                  <Package className="w-3.5 h-3.5" />
                </div>
                <h3 className="text-sm font-bold text-neutral-900">Rotación de Artículos</h3>
              </div>
              <span className="text-[11px] text-neutral-400 font-medium">Por volumen despachado</span>
            </div>

            <div className="space-y-3">
              {kpis?.top_selling_products.map((item, idx) => (
                <div key={item.product_id} className="flex items-center justify-between p-3 rounded-2xl bg-neutral-50/70 border border-neutral-100 gap-2 hover:border-neutral-300 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-6 h-6 rounded-lg bg-white border border-neutral-200 text-neutral-800 text-[11px] font-bold flex items-center justify-center shrink-0 shadow-2xs">
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-neutral-900 truncate">{item.product_name}</p>
                      <p className="text-[10px] text-neutral-400">SKU: {item.sku}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-bold text-neutral-900">{item.units_sold} uds.</p>
                    <p className="text-[10px] text-neutral-500">${Number(item.total_revenue).toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DashboardPage;


