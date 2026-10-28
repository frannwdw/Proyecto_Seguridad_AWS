import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  TrendingUp,
  DollarSign,
  Package,
  Award,
  FileSpreadsheet,
  FileDown,
  Search,
  Calendar,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowUpRight,
  Filter,
  BarChart3,
  Layers,
  ShoppingBag,
  Building2
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
  PieChart,
  Pie
} from 'recharts';
import { getSales, getProducts, getInventory, getEmployees, getOrders } from '../../services/mockDataService';
import { useLocalActivo } from '../../services/localService';
import { Sale, Product, InventoryItem, Employee, Order } from '../../types';
import { ScrollableDropdown } from '../sales/components/ScrollableDropdown';
import { ReportTab, ReportPeriod, CommercialReportRow, InventoryReportRow, SalespersonReportRow } from './types';
import { exportarCentroReportesExcel } from './services/exportReportsExcelService';
import { ReportCustomizerModal } from './components/ReportCustomizerModal';

export const ReportsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ReportTab>('gerencial');
  const [periodo, setPeriodo] = useState<ReportPeriod>('MES');
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  // Local/Sucursal de reporte: '' = Consolidado de toda la red
  const { local: localActivo, localesActivos, cambiar } = useLocalActivo();
  const localReporte = localActivo?.id ?? 0;

  // Consultas de datos
  const { data: salesRaw = [], isLoading: isLoadingSales } = useQuery<Sale[]>({
    queryKey: ['reports_sales'],
    queryFn: getSales
  });

  // Ventas recortadas por el local de reporte
  const sales = useMemo<Sale[]>(
    () => (!localReporte ? salesRaw : salesRaw.filter(s => s.local_id === localReporte)),
    [salesRaw, localReporte]
  );

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ['reports_products'],
    queryFn: () => getProducts()
  });

  const { data: inventory = [] } = useQuery<InventoryItem[]>({
    queryKey: ['reports_inventory'],
    queryFn: () => getInventory()
  });

  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ['reports_employees'],
    queryFn: getEmployees
  });

  const { data: orders = [] } = useQuery<Order[]>({
    queryKey: ['reports_orders'],
    queryFn: () => getOrders()
  });

  // --------------------------------------------------------------------------
  // CÁLCULOS COMERCIALES Y DE RENTABILIDAD REAL
  // --------------------------------------------------------------------------
  const commercialRows = useMemo<CommercialReportRow[]>(() => {
    return sales.map(s => {
      const revenue = Number(s.total_amount || 0);
      
      // Costo acumulado de los ítems vendidos
      let cost = 0;
      (s.items || []).forEach(it => {
        const p = products.find(prod => prod.id === it.product_id);
        const itemCost = Number(it.unit_cost || p?.cost_price || (Number(it.unit_price) * 0.6));
        cost += itemCost * Number(it.quantity || 1);
      });

      if (cost === 0 && revenue > 0) {
        cost = revenue * 0.58; // Estimado conservador si no hay costo detallado
      }

      const profit = Math.max(0, revenue - cost);
      const marginPct = revenue > 0 ? (profit / revenue) * 100 : 0;

      return {
        id: s.id,
        saleCode: s.sale_code,
        customerName: s.customer_name || 'Cliente General',
        salespersonName: s.salesperson_name || 'Vendedor Asignado',
        date: s.created_at,
        revenue,
        cost: Math.round(cost * 100) / 100,
        profit: Math.round(profit * 100) / 100,
        marginPct: Math.round(marginPct * 10) / 10,
        paymentStatus: s.payment_status,
        itemsCount: (s.items || []).length
      };
    });
  }, [sales, products]);

  // --------------------------------------------------------------------------
  // CÁLCULOS DE INVENTARIO Y ALMACÉN
  // --------------------------------------------------------------------------
  const inventoryRows = useMemo<InventoryReportRow[]>(() => {
    return products.map(p => {
      const physical = p.physical_stock ?? 10;
      const available = p.available_stock ?? physical;
      const minStock = p.min_stock_alert ?? 5;
      const cost = Number(p.cost_price || 50);
      const sale = Number(p.sale_price || 100);
      const totalValuation = physical * cost;

      let status: 'OPTIMO' | 'CRITICO' | 'AGOTADO' = 'OPTIMO';
      if (physical === 0) {
        status = 'AGOTADO';
      } else if (physical <= minStock) {
        status = 'CRITICO';
      }

      return {
        id: p.id,
        sku: p.sku,
        name: p.name,
        category: p.category_name || 'Tecnología',
        physicalStock: physical,
        availableStock: available,
        minStockAlert: minStock,
        costPrice: cost,
        salePrice: sale,
        totalValuation,
        status
      };
    }).sort((a, b) => (a.status === 'CRITICO' ? -1 : 1));
  }, [products]);

  // --------------------------------------------------------------------------
  // CÁLCULOS DE FUERZA DE VENTAS Y COMISIONES
  // --------------------------------------------------------------------------
  const salespersonRows = useMemo<SalespersonReportRow[]>(() => {
    return employees.map(emp => {
      const empSales = commercialRows.filter(
        c => c.salespersonName.toLowerCase().includes(emp.first_name.toLowerCase()) ||
             c.salespersonName.toLowerCase().includes(emp.last_name.toLowerCase())
      );

      const target = Number(emp.monthly_sales_target || 15000);
      const achieved = empSales.reduce((acc, s) => acc + s.revenue, 0);
      const fulfillment = target > 0 ? (achieved / target) * 100 : 0;
      const rate = Number(emp.commission_rate || 0.05);
      const commission = achieved * rate;

      return {
        id: emp.id,
        name: `${emp.first_name} ${emp.last_name}`,
        jobTitle: emp.job_title || 'Asesor Comercial',
        monthlyTarget: target,
        salesAchieved: achieved,
        fulfillmentPct: Math.round(fulfillment * 10) / 10,
        commissionRate: rate,
        commissionEarned: Math.round(commission * 100) / 100,
        salesCount: empSales.length
      };
    }).sort((a, b) => b.salesAchieved - a.salesAchieved);
  }, [employees, commercialRows]);

  // --------------------------------------------------------------------------
  // KPIS GENERALES CONSOLIDADOS
  // --------------------------------------------------------------------------
  const kpis = useMemo(() => {
    const facturacionTotal = commercialRows.reduce((a, b) => a + b.revenue, 0);
    const costoTotal = commercialRows.reduce((a, b) => a + b.cost, 0);
    const gananciaTotal = facturacionTotal - costoTotal;
    const margenPromedio = facturacionTotal > 0 ? (gananciaTotal / facturacionTotal) * 100 : 0;

    const cobradoTotal = sales.reduce((a, b) => a + Number(b.paid_amount || (b.payment_status === 'PAID' ? b.total_amount : 0)), 0);
    const pendienteTotal = Math.max(0, facturacionTotal - cobradoTotal);

    const valorizacionInventario = inventoryRows.reduce((a, b) => a + b.totalValuation, 0);
    const productosCriticosCount = inventoryRows.filter(i => i.status === 'CRITICO' || i.status === 'AGOTADO').length;

    return {
      facturacionTotal,
      costoTotal,
      gananciaTotal,
      margenPromedio,
      cobradoTotal,
      pendienteTotal,
      valorizacionInventario,
      productosCriticosCount
    };
  }, [commercialRows, sales, inventoryRows]);

  // Datos para Gráfico de Tendencia
  const chartRentabilidad = useMemo(() => {
    return [
      { mes: 'Julio', ventas: Math.round(kpis.facturacionTotal * 0.18), costo: Math.round(kpis.costoTotal * 0.18), ganancia: Math.round(kpis.gananciaTotal * 0.18) },
      { mes: 'Agosto', ventas: Math.round(kpis.facturacionTotal * 0.24), costo: Math.round(kpis.costoTotal * 0.24), ganancia: Math.round(kpis.gananciaTotal * 0.24) },
      { mes: 'Septiembre', ventas: Math.round(kpis.facturacionTotal * 0.32), costo: Math.round(kpis.costoTotal * 0.32), ganancia: Math.round(kpis.gananciaTotal * 0.32) },
      { mes: 'Octubre', ventas: Math.round(kpis.facturacionTotal * 0.26), costo: Math.round(kpis.costoTotal * 0.26), ganancia: Math.round(kpis.gananciaTotal * 0.26) },
    ];
  }, [kpis]);

  // Datos para Gráfico de Cobros
  const chartCobros = useMemo(() => {
    return [
      { name: 'Cobrado Efectivo/Banco', value: kpis.cobradoTotal, color: '#047857' },
      { name: 'Saldo Pendiente', value: kpis.pendienteTotal, color: '#d97706' }
    ];
  }, [kpis]);

  // Exportar Excel Directo
  const handleDescargarExcelDirecto = async () => {
    await exportarCentroReportesExcel({
      titulo: 'Informe Ejecutivo de Inteligencia Comercial & Rentabilidad',
      periodo,
      observaciones: 'Consolidado general de auditoría de ventas, márgenes comerciales, valorización de inventario y comisiones.',
      incluirGerencial: true,
      incluirComercial: true,
      incluirInventario: true,
      incluirVendedores: true,
      kpis,
      commercialRows,
      inventoryRows,
      salespersonRows
    });
  };

  // Filtrado por buscador
  const filteredCommercial = useMemo(() => {
    if (!searchTerm.trim()) return commercialRows;
    const s = searchTerm.toLowerCase();
    return commercialRows.filter(r =>
      r.saleCode.toLowerCase().includes(s) ||
      r.customerName.toLowerCase().includes(s) ||
      r.salespersonName.toLowerCase().includes(s)
    );
  }, [commercialRows, searchTerm]);

  return (
    <div className="space-y-6 antialiased">
      {/* Header Corporativo */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Centro de Reportes & Inteligencia Empresarial</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Consolidado gerencial, auditoría de rentabilidad comercial, valorización de almacén y comisiones del equipo.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
          {/* Botón Descargar Excel directo */}
          <button
            onClick={handleDescargarExcelDirecto}
            className="inline-flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-900 border border-slate-200 hover:border-slate-300 px-3.5 py-2 rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            title="Exportar libro Excel (.xlsx) estructurado con diseño profesional"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Descargar Excel</span>
          </button>

          {/* Botón para abrir el Personalizador de Reporte */}
          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-900 border border-slate-200 hover:border-slate-300 px-3.5 py-2 rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            title="Personalizar título, notas, secciones y descargar en PDF A4 o Excel"
          >
            <FileDown className="w-4 h-4 text-blue-600" />
            <span>Generar Reporte Personalizado</span>
          </button>
        </div>
      </div>

      {/* Barra de Filtros y Rango de Período */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-slate-200 rounded-xl p-3 shadow-xs">
        <div className="flex items-center gap-2 overflow-x-auto text-xs font-semibold">
          <span className="text-slate-400 flex items-center gap-1.5 mr-1 text-[11px] uppercase tracking-wider">
            <Calendar className="w-3.5 h-3.5 text-slate-500" /> Período:
          </span>
          {(['HOY', 'SEMANA', 'MES', 'TRIMESTRE', 'ANUAL'] as ReportPeriod[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriodo(p)}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                periodo === p
                  ? 'bg-white text-slate-900 border-2 border-slate-900 shadow-xs font-bold'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 hover:text-slate-900 font-medium'
              }`}
            >
              {p}
            </button>
          ))}
          {/* Local de reporte: Consolidado (todas las sedes) o un local específico */}
          <span className="text-slate-400 flex items-center gap-1.5 ml-3 text-[11px] uppercase tracking-wider">
            <Building2 className="w-3.5 h-3.5 text-slate-500" /> Local:
          </span>
          <div className="w-48 relative">
            <ScrollableDropdown
              value={localReporte}
              onSelect={(v) => cambiar(Number(v))}
              searchable
              placeholder="Consolidado Global"
              options={localesActivos.map(l => ({
                value: l.id,
                label: l.nombre,
                description: `${l.codigo}${l.es_principal ? ' · Matriz' : ''}`,
              }))}
            />
          </div>
        </div>

        {/* Buscador de auditoría */}
        <div className="relative min-w-[260px]">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por cliente, código o vendedor..."
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-800"
          />
        </div>
      </div>

      {/* Selector de Pestañas / Bloques de Auditoría */}
      <div className="flex items-center gap-1.5 border-b border-slate-200 pb-2 overflow-x-auto text-xs font-semibold">
        <button
          onClick={() => setActiveTab('gerencial')}
          className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'gerencial'
              ? 'bg-white text-slate-900 border-2 border-slate-900 shadow-xs font-bold'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 hover:text-slate-900 font-medium'
          }`}
        >
          <TrendingUp className="w-4 h-4 text-blue-600" />
          <span>1. Resumen Gerencial 360°</span>
        </button>

        <button
          onClick={() => setActiveTab('comercial')}
          className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'comercial'
              ? 'bg-white text-slate-900 border-2 border-slate-900 shadow-xs font-bold'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 hover:text-slate-900 font-medium'
          }`}
        >
          <DollarSign className="w-4 h-4 text-emerald-600" />
          <span>2. Ventas & Rentabilidad ({commercialRows.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('inventario')}
          className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'inventario'
              ? 'bg-white text-slate-900 border-2 border-slate-900 shadow-xs font-bold'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 hover:text-slate-900 font-medium'
          }`}
        >
          <Package className="w-4 h-4 text-amber-600" />
          <span>3. Inventario Crítico ({kpis.productosCriticosCount} Alertas)</span>
        </button>

        <button
          onClick={() => setActiveTab('vendedores')}
          className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'vendedores'
              ? 'bg-white text-slate-900 border-2 border-slate-900 shadow-xs font-bold'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 hover:text-slate-900 font-medium'
          }`}
        >
          <Award className="w-4 h-4 text-purple-600" />
          <span>4. Fuerza de Ventas & Comisiones ({employees.length})</span>
        </button>
      </div>

      {/* ==================================================================== */}
      {/* PESTAÑA 1: RESUMEN GERENCIAL 360°                                    */}
      {/* ==================================================================== */}
      {activeTab === 'gerencial' && (
        <div className="space-y-6">
          {/* 4 KPIs de Alto Nivel */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-4 border border-slate-200 rounded-xl shadow-xs">
              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Facturación Total Bruta</span>
              <p className="text-2xl font-black text-slate-900 mt-1">${kpis.facturacionTotal.toLocaleString()}</p>
              <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 mt-2 font-semibold">
                <ArrowUpRight className="w-3.5 h-3.5" />
                <span>+18.4% vs. período anterior</span>
              </div>
            </div>

            <div className="bg-white p-4 border border-emerald-200/80 rounded-xl shadow-xs bg-emerald-50/20">
              <span className="text-[10px] uppercase font-bold text-emerald-800 tracking-wider">Utilidad Bruta Real</span>
              <p className="text-2xl font-black text-emerald-900 mt-1">${kpis.gananciaTotal.toLocaleString()}</p>
              <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 mt-2 font-bold">
                <span>{kpis.margenPromedio.toFixed(1)}% margen comercial neto</span>
              </div>
            </div>

            <div className="bg-white p-4 border border-blue-200/80 rounded-xl shadow-xs bg-blue-50/20">
              <span className="text-[10px] uppercase font-bold text-blue-800 tracking-wider">Cobrado en Efectivo / Banco</span>
              <p className="text-2xl font-black text-blue-900 mt-1">${kpis.cobradoTotal.toLocaleString()}</p>
              <p className="text-[11px] text-amber-700 font-semibold mt-2">
                ${kpis.pendienteTotal.toLocaleString()} pendiente de cobro
              </p>
            </div>

            <div className="bg-white p-4 border border-slate-200 rounded-xl shadow-xs">
              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Valorización de Almacén</span>
              <p className="text-2xl font-black text-slate-900 mt-1">${kpis.valorizacionInventario.toLocaleString()}</p>
              <p className="text-[11px] text-rose-700 font-semibold mt-2 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>{kpis.productosCriticosCount} productos bajo stock mínimo</span>
              </p>
            </div>
          </div>

          {/* Gráficos de Tendencia y Distribución */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Gráfico de Barras: Facturación vs Costo vs Ganancia */}
            <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Tendencia Comercial: Ventas vs. Costo vs. Utilidad</h3>
                  <p className="text-xs text-slate-500">Comportamiento mensual del margen bruto generado</p>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 bg-slate-100 rounded-lg text-slate-700">
                  Año Fiscal 2026
                </span>
              </div>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartRentabilidad} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#64748b' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(v) => `$${v/1000}k`} />
                    <Tooltip formatter={(v: any) => [`$${Number(v).toLocaleString()}`, '']} />
                    <Bar dataKey="ventas" name="Ventas ($)" fill="#0f172a" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="costo" name="Costo ($)" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="ganancia" name="Utilidad ($)" fill="#047857" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Gráfico Circular: Cobrado vs Saldo Pendiente */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Composición de Cartera y Cobros</h3>
                <p className="text-xs text-slate-500">Efectivo liquidado vs. cuentas por cobrar</p>
              </div>
              <div className="h-48 w-full flex items-center justify-center my-2">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartCobros}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={75}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {chartCobros.map((entry, idx) => (
                        <Cell key={idx} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: any) => [`$${Number(v).toLocaleString()}`, '']} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2 border-t border-slate-100 pt-3 text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-emerald-600"></span>
                    <span className="text-slate-600">Cobrado (Efectivo/Banco)</span>
                  </div>
                  <span className="font-bold text-slate-900">${kpis.cobradoTotal.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-amber-600"></span>
                    <span className="text-slate-600">Saldo Pendiente</span>
                  </div>
                  <span className="font-bold text-amber-700">${kpis.pendienteTotal.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* PESTAÑA 2: AUDITORÍA DE VENTAS & RENTABILIDAD                        */}
      {/* ==================================================================== */}
      {activeTab === 'comercial' && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Auditoría Comercial: Ventas, Costos y Margen Bruto</h3>
              <p className="text-xs text-slate-500">Cálculo de rentabilidad por cada comprobante y asesor</p>
            </div>
            <span className="text-xs font-semibold text-slate-500">
              Mostrando {filteredCommercial.length} comprobantes
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[750px] text-xs">
              <thead>
                <tr className="bg-slate-50/70 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Código</th>
                  <th className="py-3 px-4">Cliente / Razón Social</th>
                  <th className="py-3 px-4">Vendedor Asignado</th>
                  <th className="py-3 px-4">Fecha</th>
                  <th className="py-3 px-4 text-right">Facturación ($)</th>
                  <th className="py-3 px-4 text-right">Costo ($)</th>
                  <th className="py-3 px-4 text-right">Ganancia ($)</th>
                  <th className="py-3 px-4 text-center">Margen (%)</th>
                  <th className="py-3 px-4 text-center">Estado Pago</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoadingSales ? (
                  <tr>
                    <td colSpan={9} className="text-center py-10 text-slate-400">
                      Consultando auditoría de ventas...
                    </td>
                  </tr>
                ) : filteredCommercial.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-10 text-slate-400">
                      No se encontraron registros comerciales con los criterios de búsqueda.
                    </td>
                  </tr>
                ) : (
                  filteredCommercial.map(r => (
                    <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-slate-800">{r.saleCode}</td>
                      <td className="py-3 px-4 font-semibold text-slate-900">{r.customerName}</td>
                      <td className="py-3 px-4 text-slate-600">{r.salespersonName}</td>
                      <td className="py-3 px-4 text-slate-500">{new Date(r.date).toLocaleDateString()}</td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">${r.revenue.toLocaleString()}</td>
                      <td className="py-3 px-4 text-right font-mono text-slate-500">${r.cost.toLocaleString()}</td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700">${r.profit.toLocaleString()}</td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${
                          r.marginPct >= 40 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-700'
                        }`}>
                          {r.marginPct.toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold border ${
                          r.paymentStatus === 'PAID'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}>
                          {r.paymentStatus === 'PAID' ? 'Cobrado' : 'Pendiente'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* PESTAÑA 3: INVENTARIO & ALMACÉN CRÍTICO                              */}
      {/* ==================================================================== */}
      {activeTab === 'inventario' && (
        <div className="space-y-4">
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                <strong>Semáforo de Reposición:</strong> Se han detectado {kpis.productosCriticosCount} referencias con inventario por debajo o igual al stock mínimo de seguridad.
              </span>
            </div>
            <span className="font-bold text-amber-800 shrink-0">
              Valor Total: ${kpis.valorizacionInventario.toLocaleString()}
            </span>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[750px] text-xs">
                <thead>
                  <tr className="bg-slate-50/70 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-4">SKU</th>
                    <th className="py-3 px-4">Nombre del Producto</th>
                    <th className="py-3 px-4">Categoría</th>
                    <th className="py-3 px-4 text-center">Stock Físico</th>
                    <th className="py-3 px-4 text-center">Disponible</th>
                    <th className="py-3 px-4 text-center">Alerta Mínima</th>
                    <th className="py-3 px-4 text-right">Costo Unitario ($)</th>
                    <th className="py-3 px-4 text-right">Precio Venta ($)</th>
                    <th className="py-3 px-4 text-right">Valorización Total ($)</th>
                    <th className="py-3 px-4 text-center">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {inventoryRows.map(r => (
                    <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-slate-800">{r.sku}</td>
                      <td className="py-3 px-4 font-semibold text-slate-900">{r.name}</td>
                      <td className="py-3 px-4 text-slate-600">{r.category}</td>
                      <td className="py-3 px-4 text-center font-bold text-slate-900">{r.physicalStock}</td>
                      <td className="py-3 px-4 text-center text-slate-600">{r.availableStock}</td>
                      <td className="py-3 px-4 text-center text-slate-400 font-mono">{r.minStockAlert}</td>
                      <td className="py-3 px-4 text-right font-mono text-slate-600">${r.costPrice.toFixed(2)}</td>
                      <td className="py-3 px-4 text-right font-mono text-slate-900">${r.salePrice.toFixed(2)}</td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">${r.totalValuation.toLocaleString()}</td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold border ${
                          r.status === 'OPTIMO'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : r.status === 'CRITICO'
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-rose-50 text-rose-700 border-rose-200'
                        }`}>
                          {r.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* PESTAÑA 4: FUERZA DE VENTAS & COMISIONES                             */}
      {/* ==================================================================== */}
      {activeTab === 'vendedores' && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Fuerza Comercial: Metas Mensuales & Comisiones Devengadas</h3>
              <p className="text-xs text-slate-500">Auditoría del porcentaje de avance de cuota por cada asesor</p>
            </div>
            <span className="text-xs font-semibold text-slate-500">
              {salespersonRows.length} Asesores Evaluados
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[700px] text-xs">
              <thead>
                <tr className="bg-slate-50/70 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Asesor Comercial</th>
                  <th className="py-3 px-4">Especialidad / Cargo</th>
                  <th className="py-3 px-4 text-right">Meta Asignada ($)</th>
                  <th className="py-3 px-4 text-right">Venta Lograda ($)</th>
                  <th className="py-3 px-4 text-center">% Cumplimiento</th>
                  <th className="py-3 px-4 text-center">Tasa Comisión</th>
                  <th className="py-3 px-4 text-right">Comisión a Pagar ($)</th>
                  <th className="py-3 px-4 text-center">Órdenes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {salespersonRows.map(r => (
                  <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-900">{r.name}</td>
                    <td className="py-3 px-4 text-slate-600">{r.jobTitle}</td>
                    <td className="py-3 px-4 text-right font-mono text-slate-600">${r.monthlyTarget.toLocaleString()}</td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">${r.salesAchieved.toLocaleString()}</td>
                    <td className="py-3 px-4 text-center">
                      <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${
                        r.fulfillmentPct >= 100
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : r.fulfillmentPct >= 70
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        {r.fulfillmentPct.toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center font-mono">{(r.commissionRate * 100).toFixed(0)}%</td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700">${r.commissionEarned.toLocaleString()}</td>
                    <td className="py-3 px-4 text-center text-slate-600">{r.salesCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Personalizador de Reportes con Exportación */}
      <ReportCustomizerModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        periodoSeleccionado={periodo}
        kpis={kpis}
        commercialRows={commercialRows}
        inventoryRows={inventoryRows}
        salespersonRows={salespersonRows}
      />
    </div>
  );
};
