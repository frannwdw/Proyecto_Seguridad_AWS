import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { BadgeDollarSign, Plus, Eye, Ban, Search, FileText, X, FileDown, Receipt, Building2 } from 'lucide-react';
import { getSales, getCustomers, getProducts, getPaymentMethods, getOrders, createSale, annulSale, formatComprobante, clientePermiteFactura, getLocalByIdSync, getAllPayments } from '../../services/mockDataService';
import { useLocalActivo } from '../../services/localService';
import { Sale, Customer, Product, PaymentMethod, Order, Local } from '../../types';
import { ScrollableDropdown } from './components/ScrollableDropdown';
import { generarComprobantePdf } from './services/comprobantePdfService';

type DocumentFilter = 'TODOS' | 'FACTURA' | 'BOLETA';

/** Normaliza texto para búsqueda por palabras (sin acentos, minúsculas) */
function normalizar(texto: string): string {
  return texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export const SalesPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isAnnulModalOpen, setIsAnnulModalOpen] = useState(false);
  const [annulSaleId, setAnnulSaleId] = useState<number | null>(null);
  const [annulReason, setAnnulReason] = useState('Error en facturación o solicitud del cliente');
  const [documentFilter, setDocumentFilter] = useState<DocumentFilter>('TODOS');
  const [searchTerm, setSearchTerm] = useState('');

  // Form state for new sale
  const [customerId, setCustomerId] = useState<number>(1);
  const [documentType, setDocumentType] = useState<'FACTURA' | 'BOLETA'>('FACTURA');
  const [paymentCondition, setPaymentCondition] = useState<'CONTADO' | 'CREDITO'>('CONTADO');
  const [orderId, setOrderId] = useState<string>('');
  const [items, setItems] = useState<Array<{ product_id: number; quantity: number }>>([
    { product_id: 1, quantity: 1 }
  ]);
  const [paymentMethodId, setPaymentMethodId] = useState<number>(1);
  const [payDirectly, setPayDirectly] = useState(true);

  // Local/Sucursal de operativa (sucursales físicas con series SUNAT propias)
  const { local: localActivo, locales: localesCatalogo, nombreDe } = useLocalActivo();
  /** Local que emitió una venta concreta (para PDFs y fichas) */
  const localDeVenta = (localId?: number): Local | null => getLocalByIdSync(localId ?? -1) || null;
  /** Cobros de una venta, en orden cronológico (para el pie legal del PDF) */
  const pagosDeVenta = (saleId?: number) =>
    saleId ? getAllPayments().filter(p => p.sale_id === saleId) : [];

  // Queries
  const { data: sales = [], isLoading } = useQuery<Sale[]>({
    queryKey: ['sales'],
    queryFn: async () => await getSales()
  });

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ['customers'],
    queryFn: async () => await getCustomers()
  });

  // Cliente activamente seleccionado y su elegibilidad para FACTURA (exige RUC)
  const selectedCustomer = customers.find(c => c.id === customerId);
  const puedeFacturar = clientePermiteFactura(selectedCustomer);
  // Próximo correlativo real según la SERIE del local activo y el tipo elegido
  const proximoComprobante = (() => {
    if (!localActivo) return 'SIN LOCAL ACTIVO';
    const serie = documentType === 'FACTURA' ? localActivo.series_factura : localActivo.series_boleta;
    const numeros = sales
      .filter(s => s.document_series === serie && s.document_number)
      .map(s => Number(s.document_number));
    const siguiente = (numeros.length ? Math.max(...numeros) : 0) + 1;
    return `${serie}-${String(siguiente).padStart(8, '0')}`;
  })();

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ['products'],
    queryFn: async () => await getProducts()
  });

  const { data: paymentMethods = [] } = useQuery<PaymentMethod[]>({
    queryKey: ['paymentMethods'],
    queryFn: async () => await getPaymentMethods()
  });

  const { data: confirmedOrders = [] } = useQuery<Order[]>({
    queryKey: ['confirmedOrders'],
    queryFn: async () => await getOrders({ status: 'CONFIRMED' })
  });

  // Ventas visibles: filtro por comprobante + BUSQUEDA POR PALABRAS
  const ventasFiltradas = useMemo(() => {
    const terminos = normalizar(searchTerm.trim()).split(/\s+/).filter(Boolean);
    return sales.filter((s) => {
      if (documentFilter !== 'TODOS' && s.document_type !== documentFilter) return false;
      if (terminos.length === 0) return true;
      const serie = `${s.document_series}-${String(s.document_number || 0).padStart(8, '0')}`;
      const objetivo = normalizar([
        s.sale_code, s.customer_name, s.salesperson_name || '', serie,
        s.document_type || '', s.payment_condition || '', s.status, s.payment_status,
        nombreDe(s.local_id)
      ].join(' '));
      return terminos.every((t) => objetivo.includes(t));
    });
  }, [sales, documentFilter, searchTerm]);

  // Mutations
  const createMutation = useMutation({
    mutationFn: async () => {
      // Calculate estimated total for full initial payment if checked
      let estimatedTotal = 0;
      items.forEach((item) => {
        const p = products.find((x) => x.id === item.product_id);
        if (p) estimatedTotal += Number(p.sale_price) * item.quantity * 1.18;
      });

      const payload = {
        customer_id: customerId,
        order_id: orderId ? Number(orderId) : undefined,
        items,
        document_type: documentType,
        payment_condition: paymentCondition,
        // El comprobante sale con la serie SUNAT del local activo
        local_id: localActivo?.id,
        payment_method_id: paymentCondition === 'CONTADO' && payDirectly ? paymentMethodId : undefined,
        paid_amount: paymentCondition === 'CONTADO' && payDirectly ? estimatedTotal : 0,
        payment_reference: paymentCondition === 'CONTADO' && payDirectly ? 'PAGO_CAJA_VENTA' : undefined
      };
      return await createSale(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardSummary'] });
      setIsCreateModalOpen(false);
    }
  });

  const annulMutation = useMutation({
    mutationFn: async () => {
      if (!annulSaleId) return;
      return await annulSale(annulSaleId, annulReason);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardSummary'] });
      setIsAnnulModalOpen(false);
    }
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Registro de Ventas</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Operaciones comerciales formalizadas, snapshot inmutable de precios y cobranzas asociadas.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          {/* BUSQUEDA POR PALABRAS (cliente, código, comprobante, estados) */}
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-xs w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar: cliente, F001, boleta, vendedor…"
              className="w-full text-xs bg-transparent border-none focus:outline-none placeholder-slate-400 text-slate-800"
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} className="text-slate-400 hover:text-slate-600 cursor-pointer" title="Limpiar búsqueda">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          {/* Filtro por tipo de comprobante */}
          <div className="inline-flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1 shadow-xs">
            {(['TODOS', 'FACTURA', 'BOLETA'] as DocumentFilter[]).map((f) => (
              <button
                key={f}
                onClick={() => setDocumentFilter(f)}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                  documentFilter === f
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                {f === 'TODOS' ? 'Todos' : f === 'FACTURA' ? 'Facturas' : 'Boletas'}
              </button>
            ))}
          </div>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="inline-flex items-center gap-2 bg-sky-600 hover:bg-sky-500 text-white px-3.5 py-2 rounded-lg text-xs font-semibold shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Registrar Venta</span>
          </button>
        </div>
      </div>
      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[880px]">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4">Comprobante</th>
                <th className="py-3 px-4">Código</th>
                <th className="py-3 px-4">Fecha</th>
                <th className="py-3 px-4">Cliente</th>
                <th className="py-3 px-4 text-right">Subtotal</th>
                <th className="py-3 px-4 text-right">Impuestos</th>
                <th className="py-3 px-4 text-right">Total</th>
                <th className="py-3 px-4 text-center">Estado Venta</th>
                <th className="py-3 px-4 text-center">Estado Cobro</th>
                <th className="py-3 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {isLoading ? (
                <tr>
                  <td colSpan={10} className="text-center py-8 text-slate-400">Cargando ventas...</td>
                </tr>
              ) : sales.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-8 text-slate-400">No hay ventas registradas.</td>
                </tr>
              ) : ventasFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-8 text-slate-400">
                    Sin resultados para la búsqueda "{searchTerm}"{documentFilter !== 'TODOS' ? ` en ${documentFilter.toLowerCase()}s` : ''}.
                  </td>
                </tr>
              ) : (
                ventasFiltradas.map((s) => (                  <tr key={s.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                          s.document_type === 'FACTURA'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          {s.document_type || 'VENTA'}
                        </span>
                        <span className="font-mono text-[11px] text-slate-500">{formatComprobante(s)}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {s.payment_condition || 'CONTADO'}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">{s.sale_code}</td>
                    <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                      {new Date(s.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-800">{s.customer_name}</td>
                    <td className="py-3 px-4 text-right font-mono text-slate-500">${Number(s.subtotal).toFixed(2)}</td>
                    <td className="py-3 px-4 text-right font-mono text-slate-400">${Number(s.tax_amount).toFixed(2)}</td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">${Number(s.total_amount).toFixed(2)}</td>
                    <td className="py-3 px-4 text-center">
                      <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${
                        s.status === 'CONFIRMED'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}>
                        {s.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${
                        s.payment_status === 'PAID'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : s.payment_status === 'PARTIAL'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}>
                        {s.payment_status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right space-x-1 whitespace-nowrap">
                      <button
                        onClick={() => setSelectedSale(s)}
                        className="p-1 text-sky-600 hover:text-sky-700 hover:bg-sky-50 rounded"
                        title="Ver Detalle Inmutable"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      {s.status === 'CONFIRMED' && (
                        <button
                          onClick={() => {
                            setAnnulSaleId(s.id);
                            setIsAnnulModalOpen(true);
                          }}
                          className="p-1 text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded"
                          title="Anular venta y reingresar existencias"
                        >
                          <Ban className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Detalle Inmutable de Venta */}
      {selectedSale && (
        <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-xl w-full p-4 sm:p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto my-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-bold text-slate-900 text-sm">Detalle Fiscal de Venta: {selectedSale.sale_code}</h3>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                    selectedSale.document_type === 'FACTURA'
                      ? 'bg-blue-50 text-blue-700 border border-blue-200'
                      : 'bg-amber-50 text-amber-700 border border-amber-200'
                  }`}>
                    {selectedSale.document_type || 'VENTA'} {formatComprobante(selectedSale)}
                  </span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                    {selectedSale.payment_condition || 'CONTADO'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Cliente: {selectedSale.customer_name}
                  {(() => {
                    const cli = customers.find(c => c.id === selectedSale.customer_id);
                    return cli ? ` — ${cli.doc_type}: ${cli.doc_number}` : '';
                  })()}
                  {' • '}Vendedor: {selectedSale.salesperson_name}
                </p>
                <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                  <Building2 className="w-3 h-3 text-slate-300" />
                  Local de emisión: <span className="text-slate-500 font-medium">{nombreDe(selectedSale.local_id)}</span>
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => generarComprobantePdf(selectedSale, customers.find(c => c.id === selectedSale.customer_id), 'A4', localDeVenta(selectedSale.local_id), pagosDeVenta(selectedSale.id))}
                  className="inline-flex items-center gap-1.5 bg-slate-900 hover:bg-slate-700 text-white px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer"
                  title="Vista previa del documento en Página A4 (nueva pestaña)"
                >
                  <FileDown className="w-3.5 h-3.5" />
                  <span>PDF A4</span>
                </button>
                <button
                  onClick={() => generarComprobantePdf(selectedSale, customers.find(c => c.id === selectedSale.customer_id), 'TICKET80', localDeVenta(selectedSale.local_id))}
                  className="inline-flex items-center gap-1.5 bg-amber-600 hover:bg-amber-500 text-white px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer"
                  title="Vista previa del Ticket 80mm para tiquetera térmica (nueva pestaña)"
                >
                  <Receipt className="w-3.5 h-3.5" />
                  <span>Ticket 80mm</span>
                </button>
                <button onClick={() => setSelectedSale(null)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse min-w-[400px]">
                <thead>
                  <tr className="border-b border-slate-100 text-[10px] font-semibold text-slate-400 uppercase">
                    <th className="py-2">Ítem</th>
                    <th className="py-2 text-center">Cant.</th>
                    <th className="py-2 text-right">Precio Hist.</th>
                    <th className="py-2 text-right">Costo Hist.</th>
                    <th className="py-2 text-right">Total Línea</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {selectedSale.items?.map((item) => (
                    <tr key={item.id}>
                      <td className="py-2 font-medium text-slate-800">{item.product_name}</td>
                      <td className="py-2 text-center font-mono">{item.quantity}</td>
                      <td className="py-2 text-right font-mono">${Number(item.unit_price).toFixed(2)}</td>
                      <td className="py-2 text-right font-mono text-slate-400">${Number(item.unit_cost).toFixed(2)}</td>
                      <td className="py-2 text-right font-mono font-bold text-slate-900">${Number(item.line_total).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl space-y-1.5 text-xs text-slate-600 border border-slate-100">
              <div className="flex justify-between">
                <span>Subtotal Neto:</span>
                <span className="font-mono">${Number(selectedSale.subtotal).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Impuesto (IGV 18%):</span>
                <span className="font-mono">${Number(selectedSale.tax_amount).toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-slate-900 text-sm pt-1 border-t border-slate-200">
                <span>Total Operación:</span>
                <span className="font-mono">${Number(selectedSale.total_amount).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-emerald-700 font-semibold pt-1">
                <span>Importe Cobrado:</span>
                <span className="font-mono">${Number(selectedSale.paid_amount).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-rose-700 font-semibold">
                <span>Saldo Pendiente:</span>
                <span className="font-mono">${Number(selectedSale.pending_balance).toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Registrar Venta */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-4 sm:p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto my-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="font-bold text-slate-900 text-sm">Registrar Nueva Venta</h3>
              <button onClick={() => setIsCreateModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (documentType === 'FACTURA' && !puedeFacturar) return; // Regla SUNAT: exige RUC
                createMutation.mutate();
              }}
              className="space-y-3.5 text-xs"
            >
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Cliente</label>
                <ScrollableDropdown
                  value={customerId}
                  searchable
                  placeholder="Buscar cliente por nombre, DNI o RUC…"
                  options={customers.map((c) => ({
                    value: c.id,
                    label: `${c.full_name} (${c.doc_type}: ${c.doc_number})`,
                    description: c.customer_type === 'JURIDICA' ? 'Persona Jurídica — habilitada para FACTURA' : 'Persona Natural — solo BOLETA',
                  }))}
                  onSelect={(v) => {
                    const nuevoId = Number(v);
                    setCustomerId(nuevoId);
                    // Regla SUNAT: si el cliente no tiene RUC, se sugiere/emitirá BOLETA
                    const nuevoCliente = customers.find((c) => c.id === nuevoId);
                    if (!clientePermiteFactura(nuevoCliente)) {
                      setDocumentType('BOLETA');
                    }
                  }}
                />
                {selectedCustomer && (
                  <p className="text-[10px] mt-1 text-slate-400">
                    Documento fiscal: <span className="font-mono">{selectedCustomer.doc_type} {selectedCustomer.doc_number}</span>
                    {puedeFacturar
                      ? ' — habilitado para FACTURA ✔'
                      : ' — sin RUC: solo se emite BOLETA'}
                  </p>
                )}
              </div>

              {/* COMPROBANTE DE PAGO (SUNAT) */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-[11px] font-semibold text-slate-700">Comprobante de Pago</label>
                  <span className="font-mono text-[10px] text-slate-500 bg-white border border-slate-200 rounded px-1.5 py-0.5">
                    Próximo: {proximoComprobante}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {(['FACTURA', 'BOLETA'] as const).map((tipo) => {
                    const deshabilitado = tipo === 'FACTURA' && !puedeFacturar;
                    return (
                      <button
                        key={tipo}
                        type="button"
                        disabled={deshabilitado}
                        onClick={() => setDocumentType(tipo)}
                        className={`flex flex-col items-start p-2.5 rounded-lg border text-left transition-all ${
                          documentType === tipo
                            ? 'bg-sky-600 text-white border-sky-600 shadow-xs'
                            : deshabilitado
                            ? 'bg-slate-100 text-slate-300 border-slate-200 cursor-not-allowed'
                            : 'bg-white text-slate-700 border-slate-200 hover:border-sky-400 cursor-pointer'
                        }`}
                      >
                        <span className="text-xs font-bold">{tipo}</span>
                        <span className={`text-[10px] ${documentType === tipo ? 'text-sky-100' : 'text-slate-400'}`}>
                          {tipo === 'FACTURA' ? 'RUC / Empresa (con IGV detallado)' : 'DNI / Consumidor final'}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Condición de pago */}
                <div className="pt-1">
                  <label className="block text-[10px] font-semibold text-slate-500 mb-1">Condición de Pago</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['CONTADO', 'CREDITO'] as const).map((cond) => (
                      <button
                        key={cond}
                        type="button"
                        onClick={() => setPaymentCondition(cond)}
                        className={`p-2 rounded-lg border text-center transition-all ${
                          paymentCondition === cond
                            ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:border-slate-400 cursor-pointer'
                        }`}
                      >
                        <span className="text-xs font-bold">{cond}</span>
                        <span className={`block text-[10px] ${paymentCondition === cond ? 'text-slate-300' : 'text-slate-400'}`}>
                          {cond === 'CONTADO' ? 'Cobro inmediato en caja' : 'Saldo por amortizar (Pagos)'}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Convertir desde Pedido Confirmado (Opcional)</label>
                <ScrollableDropdown
                  value={orderId}
                  searchable
                  placeholder="Venta Directa en Mostrador (Sin pedido previo)"
                  options={[
                    { value: '', label: 'Venta Directa en Mostrador (Sin pedido previo)' },
                    ...confirmedOrders.map((o) => ({
                      value: String(o.id),
                      label: `${o.order_code} — ${o.customer_name} ($${Number(o.total_amount).toFixed(2)})`,
                      description: `Estado: ${o.status}`,
                    })),
                  ]}
                  onSelect={(v) => setOrderId(String(v))}
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Productos a Facturar</label>
                <div className="space-y-2">
                  {items.map((item, idx) => (
                    <div key={idx} className="flex flex-col sm:flex-row sm:items-center gap-2">
                      <ScrollableDropdown
                        className="w-full sm:flex-1"
                        value={item.product_id}
                        searchable
                        placeholder="Buscar producto por nombre o SKU…"
                        options={products.map((p) => ({
                          value: p.id,
                          label: `${p.name} — $${Number(p.sale_price).toFixed(2)}`,
                          description: `SKU: ${p.sku} • Disponibles: ${p.available_stock} uds.`,
                        }))}
                        onSelect={(v) => {
                          const updated = [...items];
                          updated[idx].product_id = Number(v);
                          setItems(updated);
                        }}
                      />
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => {
                            const updated = [...items];
                            updated[idx].quantity = parseInt(e.target.value) || 1;
                            setItems(updated);
                          }}
                          className="w-24 bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs text-center"
                        />
                        <span className="text-[11px] text-slate-400 sm:hidden">uds.</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Payment details */}
              {paymentCondition === 'CONTADO' && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      checked={payDirectly}
                      onChange={(e) => setPayDirectly(e.target.checked)}
                      className="rounded text-sky-600"
                    />
                    <span>Cobrar íntegramente en esta operación</span>
                  </label>

                  {payDirectly && (
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 mb-1">Método de Pago</label>
                      <ScrollableDropdown
                        value={paymentMethodId}
                        searchable
                        placeholder="Seleccionar método de pago…"
                        options={paymentMethods.map((m) => ({
                          value: m.id,
                          label: m.name,
                          description: m.requires_reference ? 'Requiere número de referencia' : 'Sin referencia obligatoria',
                        }))}
                        onSelect={(v) => setPaymentMethodId(Number(v))}
                      />
                    </div>
                  )}
                </div>
              )}
              {paymentCondition === 'CREDITO' && (
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-[11px] text-amber-800">
                  La venta quedará con el <strong>saldo total pendiente</strong> y podrá amortizarse desde el módulo de <strong>Pagos</strong>. El crédito no registra cobro en este acto.
                </div>
              )}

              {documentType === 'FACTURA' && !puedeFacturar && (
                <p className="text-[11px] text-rose-600 font-semibold flex items-center gap-1.5">
                  ⚠︎ No se puede emitir FACTURA: seleccione un cliente con RUC o emita una BOLETA.
                </p>
              )}

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 font-semibold text-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || (documentType === 'FACTURA' && !puedeFacturar)}
                  className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 font-semibold text-white shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {createMutation.isPending ? 'Emitiendo...' : `Emitir ${documentType}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Anular Venta */}
      {isAnnulModalOpen && (
        <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-sm w-full p-4 sm:p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto my-auto">
            <h3 className="font-bold text-rose-600 text-sm flex items-center gap-2">
              <Ban className="w-4 h-4" />
              <span>Anulación Autorizada de Venta</span>
            </h3>
            <p className="text-xs text-slate-600">
              Esta acción revertirá los estados y reingresará físicamente las existencias al inventario.
            </p>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Motivo de Anulación</label>
              <textarea
                rows={2}
                value={annulReason}
                onChange={(e) => setAnnulReason(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsAnnulModalOpen(false)}
                className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => annulMutation.mutate()}
                disabled={annulMutation.isPending}
                className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold"
              >
                {annulMutation.isPending ? 'Anulando...' : 'Confirmar Anulación'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
