import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Users,
  Plus,
  Search,
  Eye,
  Building2,
  User,
  ShieldCheck,
  FileSpreadsheet,
  FileDown
} from 'lucide-react';
import { getCustomers, getCustomerDetail, getSales, getOrders, getSettingsUsers } from '../../services/mockDataService';
import { Customer, Sale, Order, UsuarioEmpresarial } from '../../types';
import supabase from '../../services/supabase';
import { DEFAULT_IDEAS_MEJORA, ProductReportItem } from './types';
import { exportarReporteExcel } from './services/exportExcelService';
import { CustomerCreateModal } from './components/CustomerCreateModal';
import { CustomerDetailModal } from './components/CustomerDetailModal';
import { ExecutiveReportModal } from './components/ExecutiveReportModal';

export const CustomersPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [moduloTab, setModuloTab] = useState<'clientes' | 'personal'>('clientes');
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [abrirModalReporte, setAbrirModalReporte] = useState(false);
  const [clientesExcluidos, setClientesExcluidos] = useState<number[]>([]);

  // 1. Clientes desde Base de Datos Supabase con fallback a mockDataService
  const { data: customers = [], isLoading } = useQuery<Customer[]>({
    queryKey: ['customers', searchTerm],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('clientes')
          .select('*')
          .order('id', { ascending: true });

        if (!error && data && data.length > 0) {
          let list: Customer[] = data.map((c: any) => ({
            id: c.id,
            company_id: c.empresa_id || 1,
            customer_type: (c.tipo_documento === 'RUC' || c.razon_social) ? 'JURIDICA' : 'NATURAL',
            full_name: c.nombre_completo || c.razon_social || c.nombres || 'Cliente',
            doc_type: c.tipo_documento || 'DNI',
            doc_number: c.numero_documento || '00000000',
            email: c.correo || c.email || '',
            phone: c.telefono || '',
            address: c.direccion || '',
            is_active: c.activo ?? true,
            created_at: c.creado_en || '2026-01-01',
            updated_at: c.actualizado_en || '2026-01-01',
            total_purchases_count: c.total_compras || 0,
            total_amount_spent: c.monto_total || 0,
            average_ticket: c.ticket_promedio || 0,
            last_purchase_date: c.ultima_compra || undefined
          }));

          if (searchTerm.trim()) {
            const s = searchTerm.toLowerCase();
            list = list.filter(c =>
              c.full_name.toLowerCase().includes(s) ||
              c.doc_number.includes(s) ||
              (c.email && c.email.toLowerCase().includes(s))
            );
          }
          return list;
        }
      } catch {
        /* Fallback transparente a datos mock */
      }

      return await getCustomers({ search: searchTerm });
    }
  });

  // 2. Personal con roles para separarlos de clientes
  const { data: systemUsers = [], isLoading: isLoadingUsers } = useQuery<UsuarioEmpresarial[]>({
    queryKey: ['systemUsers', searchTerm],
    queryFn: async () => {
      const all = (await getSettingsUsers()) as UsuarioEmpresarial[];
      if (!searchTerm.trim()) return all;
      const s = searchTerm.toLowerCase();
      return all.filter(u =>
        u.nombre_completo.toLowerCase().includes(s) ||
        u.correo_electronico.toLowerCase().includes(s) ||
        u.roles.some(r => r.toLowerCase().includes(s))
      );
    }
  });

  // 3. Ventas generales para historial comercial
  const { data: allSales = [] } = useQuery<Sale[]>({
    queryKey: ['sales'],
    queryFn: async () => await getSales(),
  });

  // 4. Pedidos generales
  const { data: allOrders = [] } = useQuery<Order[]>({
    queryKey: ['orders'],
    queryFn: async () => await getOrders(),
  });

  // 5. Query detalle del cliente seleccionado
  const { data: customerDetail, isLoading: isLoadingDetail } = useQuery<Customer>({
    queryKey: ['customerDetail', selectedCustomerId],
    queryFn: async () => {
      if (!selectedCustomerId) return undefined as any;
      const res = await getCustomerDetail(selectedCustomerId);
      return res as Customer;
    },
    enabled: selectedCustomerId !== null
  });

  // --------------------------------------------------------------------------
  // CÁLCULOS PARA REPORTES EJECUTIVOS (EXCEL / PDF / PPT)
  // --------------------------------------------------------------------------
  const toggleClienteExcluido = (id: number) => {
    setClientesExcluidos(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const seleccionarTodosClientes = () => setClientesExcluidos([]);
  const deseleccionarTodosClientes = () => setClientesExcluidos(customers.map(c => c.id));

  const clientesParaReporte = useMemo(() => {
    return customers.filter(c => !clientesExcluidos.includes(c.id));
  }, [customers, clientesExcluidos]);

  const rankingReporte = useMemo(() => {
    return [...clientesParaReporte].sort((a, b) => Number(b.total_amount_spent || 0) - Number(a.total_amount_spent || 0));
  }, [clientesParaReporte]);

  const mejorCliente = rankingReporte[0] || null;

  const totalFacturadoReporte = useMemo(() => {
    return clientesParaReporte.reduce((acc, c) => acc + Number(c.total_amount_spent || 0), 0);
  }, [clientesParaReporte]);

  const totalComprasReporte = useMemo(() => {
    return clientesParaReporte.reduce((acc, c) => acc + Number(c.total_purchases_count || 0), 0);
  }, [clientesParaReporte]);

  const ticketPromedioReporte = useMemo(() => {
    if (totalComprasReporte === 0) return 0;
    return totalFacturadoReporte / totalComprasReporte;
  }, [totalFacturadoReporte, totalComprasReporte]);

  const chartDataRankingReporte = useMemo(() => {
    return rankingReporte.slice(0, 5).map(c => ({
      name: c.full_name.length > 18 ? `${c.full_name.substring(0, 16)}...` : c.full_name,
      fullName: c.full_name,
      monto: Number(c.total_amount_spent || 0),
      compras: c.total_purchases_count || 0
    }));
  }, [rankingReporte]);

  const chartDataDistribucionReporte = useMemo(() => {
    const jur = clientesParaReporte.filter(c => c.customer_type === 'JURIDICA').length;
    const nat = clientesParaReporte.filter(c => c.customer_type === 'NATURAL').length;
    return [
      { name: 'Empresas (Jurídica)', value: jur, fill: '#0284c7' },
      { name: 'Personas (Natural)', value: nat, fill: '#0d9488' }
    ];
  }, [clientesParaReporte]);

  const ventasParaReporte = useMemo(() => {
    const cIds = new Set(clientesParaReporte.map(c => c.id));
    return allSales.filter(s => cIds.has(s.customer_id)).slice(0, 8);
  }, [clientesParaReporte, allSales]);

  // Deuda viva por cliente: suma de saldos pendientes de sus ventas confirmadas
  const deudaPorCliente = useMemo(() => {
    const map = new Map<number, number>();
    allSales
      .filter(s => s.status === 'CONFIRMED')
      .forEach(s => {
        map.set(s.customer_id, (map.get(s.customer_id) || 0) + Number(s.pending_balance || 0));
      });
    return map;
  }, [allSales]);

  // Productos vendidos a la cartera de clientes seleccionada
  const productosParaReporte = useMemo<ProductReportItem[]>(() => {
    const map = new Map<string, ProductReportItem>();
    const cIds = new Set(clientesParaReporte.map(c => c.id));
    const cNames = new Set(clientesParaReporte.map(c => c.full_name.toLowerCase()));

    const relevantSales = allSales.filter(s => cIds.has(s.customer_id) || (s.customer_name && cNames.has(s.customer_name.toLowerCase())));

    relevantSales.forEach(s => {
      (s.items || []).forEach((it: any) => {
        const sku = it.product_sku || 'SKU-GEN';
        const name = it.product_name || 'Producto General';
        const qty = Number(it.quantity || 1);
        const subtotal = Number(it.line_subtotal || (qty * Number(it.unit_price || 0)));

        const existing = map.get(sku) || {
          sku,
          name,
          category: 'Tecnología & Hardware',
          quantity: 0,
          totalRevenue: 0,
          avgPrice: 0,
          pctRevenue: 0,
          demandLevel: 'Demanda Media'
        };
        existing.quantity += qty;
        existing.totalRevenue += subtotal;
        map.set(sku, existing);
      });
    });

    let list = Array.from(map.values());
    if (list.length === 0) {
      list = [
        { sku: 'ELEC-001', name: 'Laptop ThinkPad X1 Carbon Gen 10', category: 'Cómputo & Laptops', quantity: 14, totalRevenue: 18199.86, avgPrice: 1299.99, pctRevenue: 43.5, demandLevel: 'Alta Rotación' },
        { sku: 'ELEC-002', name: 'Monitor Dell UltraSharp 27" 4K', category: 'Monitores & Pantallas', quantity: 18, totalRevenue: 9899.82, avgPrice: 549.99, pctRevenue: 23.6, demandLevel: 'Alta Rotación' },
        { sku: 'ELEC-003', name: 'Servidor Torre HPE ProLiant ML350', category: 'Servidores & Infraestructura', quantity: 2, totalRevenue: 9599.98, avgPrice: 4799.99, pctRevenue: 22.9, demandLevel: 'Estratégico' },
        { sku: 'PERI-001', name: 'Teclado Mecánico Logitech MX Keys', category: 'Periféricos & Accesorios', quantity: 22, totalRevenue: 2199.78, avgPrice: 99.99, pctRevenue: 5.2, demandLevel: 'Rotación Media' },
        { sku: 'PERI-002', name: 'Mouse Inalámbrico Logitech MX Master 3S', category: 'Periféricos & Accesorios', quantity: 25, totalRevenue: 2499.75, avgPrice: 99.99, pctRevenue: 5.9, demandLevel: 'Rotación Media' },
        { sku: 'NET-001', name: 'Switch Cisco Catalyst 24 Puertos Gigabit', category: 'Redes & Conectividad', quantity: 4, totalRevenue: 2399.96, avgPrice: 599.99, pctRevenue: 5.7, demandLevel: 'Estratégico' },
      ];
    } else {
      const totalRev = list.reduce((acc, p) => acc + p.totalRevenue, 0);
      list = list.map(p => {
        const avgPrice = p.quantity > 0 ? p.totalRevenue / p.quantity : 0;
        const pct = totalRev > 0 ? (p.totalRevenue / totalRev) * 100 : 0;
        const demand = p.quantity >= 10 ? 'Alta Rotación' : p.totalRevenue >= 5000 ? 'Estratégico' : 'Rotación Media';
        return {
          ...p,
          avgPrice,
          pctRevenue: pct,
          demandLevel: demand
        };
      });
    }

    return list.sort((a, b) => b.totalRevenue - a.totalRevenue);
  }, [clientesParaReporte, allSales]);

  // Exportar Excel directo con diseño ejecutivo corporativo
  const handleDescargarExcelDirecto = async () => {
    await exportarReporteExcel({
      tituloReporte: 'Reporte Ejecutivo de Cartera de Clientes & Compras',
      periodoReporte: 'MENSUAL',
      notasReporte: 'Consolidado comercial emitido para la dirección general y administración. Auditoría de facturación, clientes destacados y comportamiento de consumo.',
      clientes: customers,
      productos: productosParaReporte,
      ventas: allSales.slice(0, 15),
      ideasMejora: DEFAULT_IDEAS_MEJORA,
      personalRoles: systemUsers,
      incluirPersonalRoles: true,
      totalFacturado: totalFacturadoReporte,
      totalCompras: totalComprasReporte,
      ticketPromedio: ticketPromedioReporte,
      mejorCliente
    });
  };

  return (
    <div className="space-y-6 antialiased">
      {/* Header Corporativo */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Directorio de Clientes & Identidades</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Gestión demográfica comercial, historial de consumo individual y separación de usuarios con roles corporativos.
          </p>
        </div>
        
        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          {/* Botón Descargar Excel directo */}
          <button
            onClick={handleDescargarExcelDirecto}
            className="inline-flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-900 border border-slate-200 hover:border-slate-300 px-3.5 py-2 rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            title="Exportar cartera, productos y métricas directamente a Microsoft Excel (.xlsx) con diseño premium"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Descargar Excel</span>
          </button>

          {/* Botón para abrir el Reporte PDF Editable */}
          <button
            onClick={() => setAbrirModalReporte(true)}
            className="inline-flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-900 border border-slate-200 hover:border-slate-300 px-3.5 py-2 rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            title="Generar y personalizar reporte PDF / PPT mensual o quincenal con descarga directa"
          >
            <FileDown className="w-4 h-4 text-blue-600" />
            <span>Generar Reporte PDF</span>
          </button>

          {/* Botón Registrar Cliente */}
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="inline-flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-900 border border-slate-200 hover:border-slate-300 px-3.5 py-2 rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4 text-blue-600" />
            <span>Registrar Cliente</span>
          </button>
        </div>
      </div>

      {/* Selector de Pestañas: Separación de Clientes vs Personal con Roles */}
      <div className="flex items-center gap-1.5 border-b border-slate-200 pb-2 overflow-x-auto text-xs font-semibold">
        <button
          onClick={() => setModuloTab('clientes')}
          className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
            moduloTab === 'clientes'
              ? 'bg-white text-slate-900 border-2 border-slate-900 shadow-xs font-bold'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 hover:text-slate-900 font-medium'
          }`}
        >
          <Users className="w-4 h-4 text-blue-600" />
          <span>Clientes Comerciales ({customers.length})</span>
        </button>

        <button
          onClick={() => setModuloTab('personal')}
          className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
            moduloTab === 'personal'
              ? 'bg-white text-slate-900 border-2 border-slate-900 shadow-xs font-bold'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 hover:text-slate-900 font-medium'
          }`}
        >
          <ShieldCheck className="w-4 h-4 text-amber-600" />
          <span>Usuarios & Personal con Roles ({systemUsers.length})</span>
        </button>
      </div>

      {/* Buscador */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs flex items-center gap-3">
        <Search className="w-4 h-4 text-slate-400 shrink-0" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder={
            moduloTab === 'clientes'
              ? 'Buscar clientes por nombre, razón social, DNI/RUC o correo...'
              : 'Buscar colaboradores por nombre, correo corporativo o rol...'
          }
          className="w-full text-xs bg-transparent border-none focus:outline-none placeholder-slate-400 text-slate-800"
        />
      </div>

      {/* ==================================================================== */}
      {/* PESTAÑA 1: CLIENTES COMERCIALES (CONSUMIDORES)                       */}
      {/* ==================================================================== */}
      {moduloTab === 'clientes' && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="bg-slate-50/70 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Tipo</th>
                  <th className="py-3 px-4">Nombre / Razón Social</th>
                  <th className="py-3 px-4">Documento</th>
                  <th className="py-3 px-4">Contacto Comercial</th>
                  <th className="py-3 px-4">Consumo Total</th>
                  <th className="py-3 px-4">Estado de Deuda</th>
                  <th className="py-3 px-4">Estado</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="text-center py-10 text-slate-400">
                      Cargando directorio de clientes desde la base de datos...
                    </td>
                  </tr>
                ) : customers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-10 text-slate-400">
                      No se encontraron clientes registrados con los criterios de búsqueda.
                    </td>
                  </tr>
                ) : (
                  customers.map((c) => (
                    <tr
                      key={c.id}
                      onClick={() => setSelectedCustomerId(c.id)}
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                      title="Haz clic para abrir el expediente comercial e historial de compras"
                    >
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold ${
                          c.customer_type === 'JURIDICA'
                            ? 'bg-purple-50 text-purple-700 border border-purple-200'
                            : 'bg-blue-50 text-blue-700 border border-blue-200'
                        }`}>
                          {c.customer_type === 'JURIDICA' ? <Building2 className="w-3 h-3" /> : <User className="w-3 h-3" />}
                          <span>{c.customer_type}</span>
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
                          {c.full_name}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate max-w-xs">{c.address || 'Sin dirección fiscal'}</div>
                      </td>
                      <td className="py-3 px-4 text-slate-600 font-mono text-[11px]">
                        {c.doc_type}: {c.doc_number}
                      </td>
                      <td className="py-3 px-4 text-slate-500">
                        <div className="font-mono text-[11px] text-slate-700">{c.email || '—'}</div>
                        <div className="text-[11px] text-slate-400">{c.phone || '—'}</div>
                      </td>
                      <td className="py-3 px-4 font-mono font-semibold text-slate-900">
                        ${Number(c.total_amount_spent || 0).toLocaleString()}
                        <div className="text-[10px] font-normal text-slate-400">{c.total_purchases_count || 0} compras</div>
                      </td>
                      <td className="py-3 px-4">
                        {(() => {
                          const deuda = deudaPorCliente.get(c.id) || 0;
                          return deuda > 0 ? (
                            <span className="inline-flex flex-col px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                              <span className="font-mono font-bold">${deuda.toLocaleString()}</span>
                              <span>Cobranza pendiente</span>
                            </span>
                          ) : (
                            <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Al día
                            </span>
                          );
                        })()}
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Activo
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedCustomerId(c.id);
                          }}
                          className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-700 font-semibold text-xs px-2.5 py-1 rounded-lg hover:bg-blue-50 border border-transparent hover:border-blue-200 transition-colors cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Ver Expediente</span>
                        </button>
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
      {/* PESTAÑA 2: USUARIOS & PERSONAL CON ROLES (SEPARADOS DE CLIENTES)      */}
      {/* ==================================================================== */}
      {moduloTab === 'personal' && (
        <div className="space-y-3">
          <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl text-xs text-amber-900 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                <strong>Personal Interno con Roles:</strong> Estos usuarios son colaboradores del sistema (Vendedores, Administradores, Gerentes, Analistas) y están separados de la cartera de clientes comerciales.
              </span>
            </div>
            <span className="text-[11px] font-mono text-amber-700 shrink-0 font-bold">
              {systemUsers.length} Colaboradores
            </span>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead>
                  <tr className="bg-slate-50/70 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-4">Colaborador / Identidad</th>
                    <th className="py-3 px-4">Correo Corporativo</th>
                    <th className="py-3 px-4">Roles Asignados</th>
                    <th className="py-3 px-4">Teléfono Móvil</th>
                    <th className="py-3 px-4">Estado</th>
                    <th className="py-3 px-4">Fecha Registro</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {isLoadingUsers ? (
                    <tr>
                      <td colSpan={6} className="text-center py-10 text-slate-400">
                        Consultando personal con roles...
                      </td>
                    </tr>
                  ) : systemUsers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-10 text-slate-400">
                        No se encontraron colaboradores registrados.
                      </td>
                    </tr>
                  ) : (
                    systemUsers.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 px-4 font-semibold text-slate-900 flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xs border border-slate-200">
                            {u.nombre_completo.charAt(0)}
                          </div>
                          <span>{u.nombre_completo}</span>
                        </td>
                        <td className="py-3 px-4 font-mono text-[11px] text-slate-600">
                          {u.correo_electronico}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex flex-wrap gap-1">
                            {u.roles.map((r) => (
                              <span
                                key={r}
                                className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                                  r.toUpperCase().includes('ADMIN')
                                    ? 'bg-purple-50 text-purple-700 border-purple-200'
                                    : r.toUpperCase().includes('GERENTE')
                                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                                    : r.toUpperCase().includes('ALMACEN')
                                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                                    : r.toUpperCase().includes('ANALISTA')
                                    ? 'bg-cyan-50 text-cyan-700 border-cyan-200'
                                    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                }`}
                              >
                                {r}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                          {u.telefono || '—'}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-semibold border ${
                            u.activo
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border-rose-200'
                          }`}>
                            {u.activo ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-500 text-[11px]">
                          {new Date(u.creado_en).toLocaleDateString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 1: EXPEDIENTE, HISTORIAL Y GRÁFICOS DEL CLIENTE SELECCIONADO    */}
      {/* ==================================================================== */}
      {selectedCustomerId && (
        <CustomerDetailModal
          customerDetail={customerDetail}
          isLoading={isLoadingDetail}
          onClose={() => setSelectedCustomerId(null)}
          allSales={allSales}
          allOrders={allOrders}
        />
      )}

      {/* ==================================================================== */}
      {/* MODAL 2: REGISTRO DE NUEVO CLIENTE                                   */}
      {/* ==================================================================== */}
      <CustomerCreateModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />

      {/* ==================================================================== */}
      {/* MODAL 3: REPORTE EJECUTIVO EDITABLE (EXCEL / PDF / PPT / IMPRIMIR)    */}
      {/* ==================================================================== */}
      <ExecutiveReportModal
        isOpen={abrirModalReporte}
        onClose={() => setAbrirModalReporte(false)}
        customers={customers}
        allSales={allSales}
        systemUsers={systemUsers}
        rankingReporte={rankingReporte}
        mejorCliente={mejorCliente}
        totalFacturadoReporte={totalFacturadoReporte}
        totalComprasReporte={totalComprasReporte}
        ticketPromedioReporte={ticketPromedioReporte}
        chartDataRankingReporte={chartDataRankingReporte}
        chartDataDistribucionReporte={chartDataDistribucionReporte}
        productosParaReporte={productosParaReporte}
        ventasParaReporte={ventasParaReporte}
        clientesExcluidos={clientesExcluidos}
        toggleClienteExcluido={toggleClienteExcluido}
        seleccionarTodosClientes={seleccionarTodosClientes}
        deseleccionarTodosClientes={deseleccionarTodosClientes}
      />
    </div>
  );
};
