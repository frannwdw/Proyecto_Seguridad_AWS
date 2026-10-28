/**
 * SalesIA Enterprise — Servicios de Datos Simulados
 *
 * Centraliza el acceso a datos mock con simulación de latencia,
 * soporte para filtros y operaciones CRUD locales.
 */

import {
  mockCategories, mockProducts, mockCustomers, mockInventory,
  mockInventoryMovements, mockOrders, mockSales, mockPayments,
  mockPaymentMethods, mockEmployees, mockEmployeePerformance,
  mockDashboardSummary, mockInsights, mockLiveSalesMetrics,
  mockLocales,
} from '../mocks/data';
import type {
  Customer, Product, Category, InventoryItem, InventoryMovement,
  Order, Sale, Payment, PaymentMethod, Employee, EmployeePerformance,
  DashboardSummary, Insight, Local
} from '../types';

// Clones mutables para permitir operaciones CRUD en memoria durante la demo
let _products = [...mockProducts];
let _customers = [...mockCustomers];
let _orders = [...mockOrders];
let _sales = [...mockSales];
let _payments = [...mockPayments];
let _inventory = [...mockInventory];
let _movements = [...mockInventoryMovements];

/** Simula latencia de red (250-500ms) */
const delay = (ms = 300) => new Promise<void>(r => setTimeout(r, ms));

// ============================================================================
// LOCALES / SUCURSALES — catálogo persistente en localStorage (sin BD)
// ============================================================================
const LOCALES_KEY = 'salesia_locales';

function _cargarLocales(): Local[] {
  try {
    const raw = localStorage.getItem(LOCALES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Local[];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch { /* catálogo corrupto: vuelve al mock */ }
  return [...mockLocales];
}

let _locales: Local[] = _cargarLocales();

function _persistirLocales(): void {
  try {
    localStorage.setItem(LOCALES_KEY, JSON.stringify(_locales));
  } catch { /* almacenamiento lleno o restringido */ }
}

/** Catálogo completo de locales (incluye inactivos). */
export function getLocalesSync(): Local[] {
  return [..._locales];
}

/** Local por id (o undefined). */
export function getLocalByIdSync(id: number): Local | undefined {
  return _locales.find(l => l.id === Number(id));
}

/** Próximo correlativo de código interno de local: L005, L006... */
function _siguienteCodigoLocal(): string {
  const maximo = _locales.reduce((acc, l) => {
    const m = /^L(\d+)$/.exec(l.codigo);
    return m ? Math.max(acc, Number(m[1])) : acc;
  }, 0);
  return `L${String(maximo + 1).padStart(3, '0')}`;
}

/** Próxima serie SUNAT libre: F105..., B105... (número compartido F/B) */
function _siguienteSerie(tipo: 'FACTURA' | 'BOLETA'): string {
  const prefijo = tipo === 'FACTURA' ? 'F' : 'B';
  const maximo = _locales.reduce((acc, l) => {
    const mf = /^F(\d+)$/.exec(l.series_factura);
    const mb = /^B(\d+)$/.exec(l.series_boleta);
    const n = Math.max(mf ? Number(mf[1]) : 0, mb ? Number(mb[1]) : 0);
    return Math.max(acc, n);
  }, 0);
  return `${prefijo}${maximo + 1}`;
}

/** Crea un local nuevo con código y series SUNAT autogenerados. */
export async function createLocal(data: {
  nombre: string;
  direccion: string;
  telefono?: string;
  es_principal?: boolean;
  series_factura?: string;
  series_boleta?: string;
}): Promise<Local> {
  await delay();
  const nuevo: Local = {
    id: Math.max(0, ..._locales.map(l => l.id)) + 1,
    codigo: _siguienteCodigoLocal(),
    nombre: data.nombre,
    direccion: data.direccion,
    telefono: data.telefono || '',
    // La matriz es única: designarla mueve la marca de la anterior
    es_principal: data.es_principal || _locales.length === 0,
    series_factura: data.series_factura || _siguienteSerie('FACTURA'),
    series_boleta: data.series_boleta || _siguienteSerie('BOLETA'),
    is_active: true,
    created_at: new Date().toISOString(),
  };
  if (nuevo.es_principal) {
    _locales = _locales.map(l => (l.id === nuevo.id ? l : { ...l, es_principal: false }));
  }
  _locales = [..._locales, nuevo];
  _persistirLocales();
  return { ...nuevo };
}

/** Actualiza nombre, dirección, teléfono, series o estado de un local. */
export async function updateLocal(id: number, data: Partial<Pick<Local, 'nombre' | 'direccion' | 'telefono' | 'es_principal' | 'series_factura' | 'series_boleta' | 'is_active'>>): Promise<Local> {
  await delay(150);
  const objetivo = _locales.find(l => l.id === id);
  if (!objetivo) throw new Error('Local no encontrado');

  // Regla SUNAT: la serie solo cambia si el local aún no emitió comprobantes
  if (data.series_factura && data.series_factura !== objetivo.series_factura) {
    const tieneVentas = _sales.some(s => s.document_series === objetivo.series_factura);
    if (tieneVentas) throw new Error(`No se puede cambiar la serie ${objetivo.series_factura}: el local ya emitió comprobantes (contabilidad inmutable).`);
  }
  if (data.series_boleta && data.series_boleta !== objetivo.series_boleta) {
    const tieneVentas = _sales.some(s => s.document_series === objetivo.series_boleta);
    if (tieneVentas) throw new Error(`No se puede cambiar la serie ${objetivo.series_boleta}: el local ya emitió comprobantes (contabilidad inmutable).`);
  }

  const actualizado: Local = { ...objetivo, ...data } as Local;
  _locales = _locales.map(l => (l.id === id ? actualizado : l));
  // Matriz exclusiva
  if (actualizado.es_principal) {
    _locales = _locales.map(l => (l.id === id ? l : { ...l, es_principal: false }));
  }
  _persistirLocales();
  return { ...actualizado };
}

/**
 * Desactiva un local. Regla de negocio: NO se borra si tiene ventas asociadas
 * (trazabilidad SUNAT); solo se desactiva.
 */
export async function desactivarLocal(id: number): Promise<{ local: Local; movidoAMatriz: boolean }> {
  await delay(150);
  const objetivo = _locales.find(l => l.id === id);
  if (!objetivo) throw new Error('Local no encontrado');
  if (objetivo.es_principal) throw new Error('No se puede desactivar la matriz: designa primero otro local como principal.');

  const actualizado: Local = { ...objetivo, is_active: false, es_principal: false };
  _locales = _locales.map(l => (l.id === id ? actualizado : l));
  _persistirLocales();

  // Si el local desactivado era el activo, la UI caerá a la matriz automáticamente
  return { local: { ...actualizado }, movidoAMatriz: true };
}

/** Reactiva un local. */
export async function activarLocal(id: number): Promise<Local> {
  await delay(150);
  const objetivo = _locales.find(l => l.id === id);
  if (!objetivo) throw new Error('Local no encontrado');
  const actualizado: Local = { ...objetivo, is_active: true };
  _locales = _locales.map(l => (l.id === id ? actualizado : l));
  _persistirLocales();
  return { ...actualizado };
}

/** Versión asíncrona para componentes con react-query. */
export async function getLocales(): Promise<Local[]> {
  await delay(150);
  return [..._locales];
}

// ============================================================================
// Dashboard
// ============================================================================
export async function getDashboardSummary(): Promise<DashboardSummary> {
  await delay();
  return { ...mockDashboardSummary };
}

// ============================================================================
// Productos
// ============================================================================
export async function getProducts(params?: { search?: string; category_id?: number }): Promise<Product[]> {
  await delay();
  let list = [..._products];
  if (params?.search) {
    const s = params.search.toLowerCase();
    list = list.filter(p => p.name.toLowerCase().includes(s) || p.sku.toLowerCase().includes(s));
  }
  if (params?.category_id) {
    list = list.filter(p => p.category_id === params.category_id);
  }
  return list;
}

export async function getCategories(): Promise<Category[]> {
  await delay(150);
  return [...mockCategories];
}

export async function createProduct(data: any): Promise<Product> {
  await delay();
  const margin = Math.max(0, data.sale_price - data.cost_price);
  const marginPct = data.sale_price > 0 ? (margin / data.sale_price) * 100 : 0;
  const cat = mockCategories.find(c => c.id === data.category_id);
  const newProduct: Product = {
    id: _products.length + 100,
    company_id: 1,
    category_id: data.category_id,
    category_name: cat?.name || 'Sin Categoría',
    sku: data.sku || `PROD-${Date.now()}`,
    name: data.name,
    description: data.description || '',
    cost_price: data.cost_price,
    sale_price: data.sale_price,
    tax_rate: data.tax_rate || 0.18,
    min_stock_alert: data.min_stock_alert || 5,
    unit_margin: Math.round(margin * 100) / 100,
    margin_percentage: Math.round(marginPct * 100) / 100,
    physical_stock: data.initial_stock || 0,
    reserved_stock: 0,
    available_stock: data.initial_stock || 0,
    is_active: true,
    created_at: new Date().toISOString(),
  };
  _products = [newProduct, ..._products];
  return newProduct;
}

// ============================================================================
// Clientes
// ============================================================================
export async function getCustomers(params?: { search?: string }): Promise<Customer[]> {
  await delay();
  let list = [..._customers];
  if (params?.search) {
    const s = params.search.toLowerCase();
    list = list.filter(c =>
      c.full_name.toLowerCase().includes(s) ||
      c.doc_number.includes(s) ||
      (c.email && c.email.toLowerCase().includes(s))
    );
  }
  return list;
}

export async function getCustomerDetail(id: number): Promise<Customer | undefined> {
  await delay();
  return _customers.find(c => c.id === id);
}

export async function createCustomer(data: any): Promise<Customer> {
  await delay();
  const newCustomer: Customer = {
    id: _customers.length + 100,
    company_id: 1,
    customer_type: data.customer_type,
    full_name: data.full_name,
    doc_type: data.doc_type,
    doc_number: data.doc_number,
    email: data.email,
    phone: data.phone,
    address: data.address,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    total_purchases_count: 0,
    total_amount_spent: 0,
    average_ticket: 0,
  };
  _customers = [newCustomer, ..._customers];
  return newCustomer;
}

// ============================================================================
// Inventario
// ============================================================================
export async function getInventory(params?: { low_stock_only?: boolean }): Promise<InventoryItem[]> {
  await delay();
  let list = [..._inventory];
  if (params?.low_stock_only) {
    list = list.filter(i => i.is_low_stock);
  }
  return list;
}

export async function getInventoryMovements(params?: { local_id?: number }): Promise<InventoryMovement[]> {
  await delay();
  let list = [..._movements];
  if (params?.local_id) {
    list = list.filter(m => m.local_id === params.local_id);
  }
  return list;
}

export async function createInventoryMovement(data: any): Promise<InventoryMovement> {
  await delay();
  const product = _products.find(p => p.id === data.product_id);
  const mv: InventoryMovement = {
    id: _movements.length + 100,
    inventory_id: data.product_id,
    product_id: data.product_id,
    product_name: product?.name || 'Producto',
    product_sku: product?.sku || 'SKU',
    movement_type: data.movement_type,
    quantity: data.quantity,
    previous_stock: product?.physical_stock || 0,
    resulting_stock: (product?.physical_stock || 0) + (data.movement_type === 'EXIT' ? -data.quantity : data.quantity),
    reference_doc: data.reference_doc,
    reason: data.reason,
    user_name: 'Usuario Demo',
    created_at: new Date().toISOString(),
  };
  _movements = [mv, ..._movements];
  return mv;
}

// ============================================================================
// Pedidos
// ============================================================================
export async function getOrders(params?: { status?: string }): Promise<Order[]> {
  await delay();
  let list = [..._orders];
  if (params?.status) {
    list = list.filter(o => o.status === params.status);
  }
  return list;
}

export async function createOrder(data: any): Promise<Order> {
  await delay();
  const customer = _customers.find(c => c.id === data.customer_id);
  const orderItems = (data.items || []).map((item: any, idx: number) => {
    const product = _products.find(p => p.id === item.product_id);
    return {
      id: idx + 1,
      product_id: item.product_id,
      product_sku: product?.sku || 'SKU',
      product_name: product?.name || 'Producto',
      quantity: item.quantity,
      unit_price: product?.sale_price || 0,
      unit_cost: product?.cost_price || 0,
      discount_percentage: 0,
      line_subtotal: Number(product?.sale_price || 0) * item.quantity,
    };
  });
  const subtotal = orderItems.reduce((s: number, i: any) => s + Number(i.line_subtotal), 0);
  const taxAmount = subtotal * 0.18;

  const newOrder: Order = {
    id: _orders.length + 100,
    order_code: `PED-2026-${String(_orders.length + 4).padStart(3, '0')}`,
    customer_id: data.customer_id,
    customer_name: customer?.full_name || 'Cliente',
    salesperson_id: 1,
    salesperson_name: 'Demo User',
    status: 'DRAFT',
    subtotal,
    tax_amount: Math.round(taxAmount * 100) / 100,
    discount_amount: 0,
    total_amount: Math.round((subtotal + taxAmount) * 100) / 100,
    notes: data.notes || '',
    created_at: new Date().toISOString(),
    items: orderItems,
  };
  _orders = [newOrder, ..._orders];
  return newOrder;
}

// ============================================================================
// Ventas
// ============================================================================
export async function getSales(params?: { local_id?: number }): Promise<Sale[]> {
  await delay();
  let list = [..._sales];
  if (params?.local_id) {
    list = list.filter(s => s.local_id === params.local_id);
  }
  return list;
}

// ---------------------------------------------------------------------------
// MOTOR DE COMPROBANTES DE PAGO (SUNAT Perú)
// Cada LOCAL tiene sus propias series (F101/B101 San Isidro, F102... etc.)
// y correlativos INDEPENDIENTES por serie.
// El correlativo es INMUTABLE: anular una venta nunca libera ni reusa números.
// ---------------------------------------------------------------------------
const SERIE_WIDTH = 8;

type DocumentType = 'FACTURA' | 'BOLETA';

/** Correlativo inicial calculado escaneando las ventas ya registradas. */
let _correlativos: Record<string, number> = (() => {
  const max: Record<string, number> = {};
  _sales.forEach(s => {
    if (!s.document_series || !s.document_number) return;
    max[s.document_series] = Math.max(max[s.document_series] || 0, s.document_number);
  });
  return max;
})();

/**
 * Emite el siguiente comprobante para (local, tipo). Cada serie lleva su
 * correlativo propio: F101-00000001 y F102-00000001 conviven sin chocar.
 */
function siguienteComprobante(tipo: DocumentType, local: Local | null): { series: string; number: number; label: string } {
  if (!local) throw new Error(`No hay local activo: designa una matriz o activa un local para emitir ${tipo}.`);
  const series = tipo === 'FACTURA' ? local.series_factura : local.series_boleta;
  _correlativos[series] = (_correlativos[series] || 0) + 1;
  const numero = _correlativos[series];
  return {
    series,
    number: numero,
    label: `${series}-${String(numero).padStart(SERIE_WIDTH, '0')}`,
  };
}

/** Formatea `F101-00000001` a partir de los campos del comprobante. */
export function formatComprobante(sale: Sale): string {
  if (!sale.document_series || !sale.document_number) return '—';
  return `${sale.document_series}-${String(sale.document_number).padStart(SERIE_WIDTH, '0')}`;
}

/** Valida si un cliente puede recibir FACTURA (exige RUC / persona jurídica). */
export function clientePermiteFactura(customer?: Customer | null): boolean {
  if (!customer) return false;
  return customer.doc_type === 'RUC' || customer.customer_type === 'JURIDICA';
}


export async function getSaleDetail(id: number): Promise<Sale | undefined> {
  await delay();
  return _sales.find(s => s.id === id);
}

// ============================================================================
// Pagos
// ============================================================================
export async function getPaymentMethods(): Promise<PaymentMethod[]> {
  await delay(150);
  return [...mockPaymentMethods];
}

export async function getPaymentsBySale(saleId: number): Promise<Payment[]> {
  await delay();
  return _payments.filter(p => p.sale_id === saleId);
}

/** Todos los pagos registrados (para resúmenes financieros y gráficos). */
export function getAllPayments(): Payment[] {
  return [..._payments];
}

export async function createPayment(data: any): Promise<Payment> {
  await delay();
  const sale = _sales.find(s => s.id === parseInt(data?.sale_id, 10) || s.id === data.sale_id);
  const method = mockPaymentMethods.find(m => m.id === data.payment_method_id);

  // --- Integridad de cobranza: validar venta y monto contra el saldo real ---
  if (!sale) throw new Error('Venta no encontrada: no se puede registrar el cobro.');
  if (sale.status && sale.status !== 'CONFIRMED') throw new Error('Solo ventas CONFIRMED admiten cobros.');
  const importe = Number(data.amount || 0);
  const saldo = Math.max(0, Math.round((Number(sale.total_amount) - Number(sale.paid_amount)) * 100) / 100);
  if (importe <= 0) throw new Error('El importe del cobro debe ser mayor a cero.');
  if (importe > saldo + 0.001) {
    throw new Error(`El cobro ($${importe.toFixed(2)}) excede el saldo pendiente de la venta ($${saldo.toFixed(2)}).`);
  }

  const newPayment: Payment = {
    id: _payments.length + 100,
    sale_id: data.sale_id,
    sale_code: sale?.sale_code || 'VTA-???',
    payment_method_name: method?.name || 'Efectivo',
    amount: importe,
    reference: data.reference,
    received_by_name: 'Usuario Demo',
    payment_date: new Date().toISOString(),
    notes: data.notes || '',
  };
  _payments = [newPayment, ..._payments];

  // --- Amortización contable de la venta (estado de cobro real) ---
  const nuevoPagado = Math.min(
    Number(sale.total_amount),
    Math.round((Number(sale.paid_amount) + importe) * 100) / 100
  );
  const nuevoSaldo = Math.max(0, Math.round((Number(sale.total_amount) - nuevoPagado) * 100) / 100);
  sale.paid_amount = nuevoPagado;
  sale.pending_balance = nuevoSaldo;
  sale.payment_status = nuevoSaldo === 0 ? 'PAID' : 'PARTIAL';

  return newPayment;
}

// ============================================================================
// Empleados
// ============================================================================
export async function getEmployees(): Promise<Employee[]> {
  await delay();
  return [...mockEmployees];
}

export async function getEmployeePerformance(id: number): Promise<EmployeePerformance | undefined> {
  await delay();
  return mockEmployeePerformance[id];
}

// ============================================================================
// Pedidos - Acciones adicionales
// ============================================================================
export async function confirmOrder(orderId: number): Promise<Order> {
  await delay();
  const order = _orders.find(o => o.id === orderId);
  if (!order) throw new Error('Pedido no encontrado');
  order.status = 'CONFIRMED';
  return { ...order };
}

export async function cancelOrder(orderId: number): Promise<Order> {
  await delay();
  const order = _orders.find(o => o.id === orderId);
  if (!order) throw new Error('Pedido no encontrado');
  order.status = 'CANCELLED';
  return { ...order };
}

// ============================================================================
// Ventas - Acciones adicionales
// ============================================================================
export async function createSale(payload: {
  customer_id: number;
  order_id?: number;
  items: Array<{ product_id: number; quantity: number }>;
  payment_method_id?: number;
  paid_amount?: number;
  payment_reference?: string;
  /** Comprobante de pago a emitir: FACTURA (exige RUC) o BOLETA */
  document_type: 'FACTURA' | 'BOLETA';
  /** CONTADO: cobro inmediato | CREDITO: saldo pendiente por amortizar */
  payment_condition?: 'CONTADO' | 'CREDITO';
  /** Local/Sucursal emisor (default: local activo de la sesión) */
  local_id?: number;
}): Promise<Sale> {
  await delay();
  const customer = _customers.find(c => c.id === payload.customer_id);
  const saleCode = `VTA-2026-${String(_sales.length + 5).padStart(3, '0')}`;
  const condicion = payload.payment_condition || 'CONTADO';

  // Local emisor: explícito > local activo de la sesión > matriz. Solo activos.
  const idActivoSesion = Number(localStorage.getItem('salesia_local_activo') || '') || 0;
  const localEmisor =
    (payload.local_id
      ? _locales.find(l => l.id === Number(payload.local_id) && l.is_active)
      : undefined)
    || _locales.find(l => l.id === idActivoSesion && l.is_active)
    || _locales.find(l => l.es_principal && l.is_active)
    || _locales.find(l => l.is_active)
    || null;

  // Regla de negocio: la FACTURA solo se emite a clientes con RUC (jurídicos).
  if (payload.document_type === 'FACTURA' && !clientePermiteFactura(customer)) {
    throw new Error('No se puede emitir FACTURA: el cliente no cuenta con RUC. Emita una BOLETA de venta.');
  }

  const comprobante = siguienteComprobante(payload.document_type, localEmisor);

  const saleItems = payload.items.map((it, idx) => {
    const p = _products.find(prod => prod.id === it.product_id);
    const salePrice = Number(p?.sale_price || 100);
    const costPrice = Number(p?.cost_price || 60);
    const lineSubtotal = salePrice * it.quantity;
    const taxRate = 0.18;
    const lineTax = lineSubtotal * taxRate;
    const lineTotal = lineSubtotal + lineTax;
    const margin = (salePrice - costPrice) * it.quantity;

    // Reducir stock del producto
    if (p) {
      p.physical_stock = Math.max(0, p.physical_stock - it.quantity);
      p.available_stock = Math.max(0, p.available_stock - it.quantity);
    }

    return {
      id: idx + 1,
      sale_id: _sales.length + 100,
      product_id: it.product_id,
      product_sku: p?.sku || 'SKU',
      product_name: p?.name || 'Producto',
      category_name: p?.category_name || 'General',
      quantity: it.quantity,
      unit_cost: costPrice,
      unit_price: salePrice,
      discount_percentage: 0,
      tax_rate: taxRate,
      discount_amount: 0,
      line_subtotal: lineSubtotal,
      line_tax: Math.round(lineTax * 100) / 100,
      line_total: Math.round(lineTotal * 100) / 100,
      unit_margin: salePrice - costPrice,
      line_margin: margin,
      margin_percentage: salePrice > 0 ? ((salePrice - costPrice) / salePrice) * 100 : 0
    };
  });

  const subtotal = saleItems.reduce((acc, it) => acc + it.line_subtotal, 0);
  const taxAmount = saleItems.reduce((acc, it) => acc + it.line_tax, 0);
  const totalAmount = Math.round((subtotal + taxAmount) * 100) / 100;
  const paidAmount = condicion === 'CONTADO' ? (payload.paid_amount || 0) : 0;
  const pendingBalance = Math.max(0, Math.round((totalAmount - paidAmount) * 100) / 100);

  const newSale: Sale = {
    id: _sales.length + 100,
    sale_code: saleCode,
    customer_id: payload.customer_id,
    customer_name: customer?.full_name || 'Cliente',
    salesperson_id: 1,
    salesperson_name: 'Usuario Demo',
    status: 'CONFIRMED',
    payment_status: pendingBalance === 0 ? 'PAID' : paidAmount > 0 ? 'PARTIAL' : 'PENDING',
    local_id: localEmisor?.id,
    local_name: localEmisor?.nombre || 'Local no asignado',
    document_type: payload.document_type,
    document_series: comprobante.series,
    document_number: comprobante.number,
    payment_condition: condicion,
    subtotal: Math.round(subtotal * 100) / 100,
    tax_amount: Math.round(taxAmount * 100) / 100,
    discount_amount: 0,
    total_amount: totalAmount,
    paid_amount: paidAmount,
    pending_balance: pendingBalance,
    created_at: new Date().toISOString(),
    items: saleItems,
  };

  if (paidAmount > 0) {
    const paymentRecord: Payment = {
      id: _payments.length + 100,
      sale_id: newSale.id,
      sale_code: saleCode,
      payment_method_name: mockPaymentMethods.find(m => m.id === payload.payment_method_id)?.name || 'Efectivo',
      amount: paidAmount,
      reference: payload.payment_reference || 'PAGO_CAJA_VENTA',
      received_by_name: 'Usuario Demo',
      payment_date: new Date().toISOString(),
      notes: 'Pago inicial registrado con la venta'
    };
    _payments = [paymentRecord, ..._payments];
  }

  _sales = [newSale, ..._sales];
  return newSale;
}

export async function annulSale(saleId: number, reason: string): Promise<Sale> {
  await delay();
  const sale = _sales.find(s => s.id === saleId);
  if (!sale) throw new Error('Venta no encontrada');

  sale.status = 'ANNULLED';

  // Reingresar existencias físicas
  sale.items.forEach(it => {
    const p = _products.find(prod => prod.id === it.product_id);
    if (p) {
      p.physical_stock += it.quantity;
      p.available_stock += it.quantity;
    }
  });

  return { ...sale };
}

// ============================================================================
// Administración & RBAC (Settings)
// ============================================================================
export interface MockAdminUser {
  id: string;
  empresa_id: number;
  nombre_completo: string;
  correo_electronico: string;
  telefono?: string;
  activo: boolean;
  ultimo_acceso?: string;
  creado_en: string;
  actualizado_en: string;
  roles: string[];
}

export interface MockSolicitud {
  id: number;
  usuario_id: string;
  empresa_id: number;
  nombre_completo: string;
  correo_electronico: string;
  motivo: string;
  estado: 'PENDIENTE' | 'APROBADA' | 'RECHAZADA';
  creado_en: string;
  actualizado_en: string;
}

let _adminUsers: MockAdminUser[] = [
  {
    id: 'b5f3c327-2f81-4de8-9f0e-28cd713dd4f6',
    empresa_id: 1,
    nombre_completo: 'Franchesco Alexander',
    correo_electronico: 'franchescoalexanderj@gmail.com',
    telefono: '+51 987 999 000',
    activo: true,
    ultimo_acceso: '2026-10-20T22:30:00Z',
    creado_en: '2026-01-01T00:00:00Z',
    actualizado_en: '2026-10-20T22:30:00Z',
    roles: ['ADMINISTRADOR']
  },
  {
    id: '937bb65b-308b-4d12-94ae-c09fe9057ee3',
    empresa_id: 1,
    nombre_completo: 'Pedro Torres Castillo',
    correo_electronico: 'pedrotorrescastillo6@gmail.com',
    telefono: '+51 987 111 222',
    activo: true,
    ultimo_acceso: '2026-10-20T20:15:00Z',
    creado_en: '2026-02-15T00:00:00Z',
    actualizado_en: '2026-10-20T20:15:00Z',
    roles: ['VENDEDOR']
  },
  {
    id: '684a3422-9b38-4653-a6ad-2e4c4a7ed2de',
    empresa_id: 1,
    nombre_completo: 'Jhon Gonzales',
    correo_electronico: 'jhonssj006@gmail.com',
    telefono: '+51 987 333 444',
    activo: true,
    ultimo_acceso: '2026-10-20T19:00:00Z',
    creado_en: '2026-03-01T00:00:00Z',
    actualizado_en: '2026-10-20T19:00:00Z',
    roles: ['VENDEDOR']
  },
  {
    id: '79ad3ad9-05b2-453a-83c2-5714e085751e',
    empresa_id: 1,
    nombre_completo: 'Anderson Aponte',
    correo_electronico: 'andersonaponte720@gmail.com',
    telefono: '+51 987 555 666',
    activo: true,
    ultimo_acceso: '2026-10-20T18:40:00Z',
    creado_en: '2026-03-10T00:00:00Z',
    actualizado_en: '2026-10-20T18:40:00Z',
    roles: ['VENDEDOR']
  },
  {
    id: 'c92df1ca-e5c7-4c75-8ede-d82559e8fcaf',
    empresa_id: 1,
    nombre_completo: 'Víctor Jesús Obrero',
    correo_electronico: 'victorjesusobrero@gmail.com',
    telefono: '+51 987 777 888',
    activo: true,
    ultimo_acceso: '2026-10-20T17:15:00Z',
    creado_en: '2026-02-01T00:00:00Z',
    actualizado_en: '2026-10-20T17:15:00Z',
    roles: ['GERENTE']
  },
  {
    id: '7a3099cb-a1dc-4c04-b8f5-f22cebda916c',
    empresa_id: 1,
    nombre_completo: 'Frann Juarez',
    correo_electronico: 'frannjuarez6@gmail.com',
    telefono: '+51 987 222 333',
    activo: true,
    ultimo_acceso: '2026-10-20T16:20:00Z',
    creado_en: '2026-03-15T00:00:00Z',
    actualizado_en: '2026-10-20T16:20:00Z',
    roles: ['ANALISTA']
  },
  {
    id: '12e672c8-6597-4cc7-ae8e-8d57459f0831',
    empresa_id: 1,
    nombre_completo: 'Equipo Almacén Central',
    correo_electronico: 'pruebas.salesia@gmail.com',
    telefono: '+51 987 000 111',
    activo: true,
    ultimo_acceso: '2026-10-20T15:00:00Z',
    creado_en: '2026-03-20T00:00:00Z',
    actualizado_en: '2026-10-20T15:00:00Z',
    roles: ['ALMACEN']
  }
];


let _solicitudes: MockSolicitud[] = [
  {
    id: 1,
    usuario_id: 'f6a7b89c-0d1e-2f3a-4b5c-6d7e8f9a0b1c',
    empresa_id: 1,
    nombre_completo: 'Marcos Villegas',
    correo_electronico: 'mvillegas@external.com',
    motivo: 'Incorporación al equipo de ventas de la sucursal Norte.',
    estado: 'PENDIENTE',
    creado_en: '2026-10-18T14:20:00Z',
    actualizado_en: '2026-10-18T14:20:00Z'
  },
  {
    id: 2,
    usuario_id: 'a7b89c0d-1e2f-3a4b-5c6d-7e8f9a0b1c2d',
    empresa_id: 1,
    nombre_completo: 'Elena Quispe',
    correo_electronico: 'equispe@external.com',
    motivo: 'Analista de datos junior en soporte comercial.',
    estado: 'PENDIENTE',
    creado_en: '2026-10-18T16:45:00Z',
    actualizado_en: '2026-10-18T16:45:00Z'
  }
];

export async function getSettingsUsers(): Promise<MockAdminUser[]> {
  await delay();
  return [..._adminUsers];
}

export async function getSettingsSolicitudes(): Promise<MockSolicitud[]> {
  await delay();
  return [..._solicitudes];
}

export async function getSettingsRoles() {
  await delay(150);
  return [
    { id: 1, codigo: 'ADMINISTRADOR', nombre: 'Administrador General', descripcion: 'Control total del sistema', es_sistema: true, activo: true },
    { id: 2, codigo: 'GERENTE', nombre: 'Gerente Comercial', descripcion: 'Supervisión operativa y metas', es_sistema: true, activo: true },
    { id: 3, codigo: 'VENDEDOR', nombre: 'Vendedor', descripcion: 'Registro de clientes y ventas directas', es_sistema: true, activo: true },
    { id: 4, codigo: 'ANALISTA', nombre: 'Analista de Datos', descripcion: 'Motor estadístico y probabilidades', es_sistema: true, activo: true },
    { id: 5, codigo: 'ALMACEN', nombre: 'Almacén / Logística', descripcion: 'Existencias físicas y movimientos', es_sistema: true, activo: true }
  ];
}

export async function getSettingsPermisos() {
  await delay(150);
  return [
    { id: 1, codigo: 'empresas:configurar', modulo: 'empresas', nombre: 'Configurar Empresa' },
    { id: 2, codigo: 'clientes:leer', modulo: 'clientes', nombre: 'Ver Clientes' },
    { id: 3, codigo: 'clientes:crear', modulo: 'clientes', nombre: 'Crear Clientes' },
    { id: 4, codigo: 'productos:leer', modulo: 'productos', nombre: 'Ver Productos' },
    { id: 5, codigo: 'productos:crear', modulo: 'productos', nombre: 'Crear Productos' },
    { id: 6, codigo: 'inventario:leer', modulo: 'inventario', nombre: 'Ver Inventario' },
    { id: 7, codigo: 'inventario:ajustar', modulo: 'inventario', nombre: 'Ajustar Inventario' },
    { id: 8, codigo: 'pedidos:crear', modulo: 'pedidos', nombre: 'Crear Pedidos' },
    { id: 9, codigo: 'ventas:crear', modulo: 'ventas', nombre: 'Registrar Ventas' },
    { id: 10, codigo: 'pagos:registrar', modulo: 'pagos', nombre: 'Registrar Cobros' },
    { id: 11, codigo: 'personal:administrar', modulo: 'personal', nombre: 'Administrar Personal' },
    { id: 12, codigo: 'analytics:ver', modulo: 'analytics', nombre: 'Ver Analítica' },
    { id: 13, codigo: 'probabilidad:calcular', modulo: 'probabilidad', nombre: 'Ejecutar Bayes / Variables' },
    { id: 14, codigo: 'insights:ver', modulo: 'insights', nombre: 'Ver Insights Automáticos' },
    { id: 15, codigo: 'reportes:exportar', modulo: 'reportes', nombre: 'Exportar Reportes' }
  ];
}

export async function approveSolicitud(solicitudId: number, rolesIds: number[]): Promise<any> {
  await delay();
  const sol = _solicitudes.find(s => s.id === solicitudId);
  if (!sol) throw new Error('Solicitud no encontrada');

  sol.estado = 'APROBADA';
  sol.actualizado_en = new Date().toISOString();

  const roleMap: Record<number, string> = {
    1: 'ADMINISTRADOR', 2: 'GERENTE', 3: 'VENDEDOR', 4: 'ANALISTA', 5: 'ALMACEN'
  };
  const assignedRoles = rolesIds.map(id => roleMap[id] || 'VENDEDOR');

  const nuevoUsuario: MockAdminUser = {
    id: sol.usuario_id,
    empresa_id: sol.empresa_id,
    nombre_completo: sol.nombre_completo,
    correo_electronico: sol.correo_electronico,
    activo: true,
    creado_en: new Date().toISOString(),
    actualizado_en: new Date().toISOString(),
    roles: assignedRoles
  };

  _adminUsers = [nuevoUsuario, ..._adminUsers];
  return { mensaje: `Solicitud #${solicitudId} aprobada correctamente con rol ${assignedRoles.join(', ')}.` };
}

export async function rejectSolicitud(solicitudId: number, motivo?: string): Promise<any> {
  await delay();
  const sol = _solicitudes.find(s => s.id === solicitudId);
  if (!sol) throw new Error('Solicitud no encontrada');

  sol.estado = 'RECHAZADA';
  sol.actualizado_en = new Date().toISOString();
  return { mensaje: `Solicitud #${solicitudId} rechazada.` };
}

export async function updateUserStatus(userId: string, activo: boolean): Promise<any> {
  await delay();
  const usr = _adminUsers.find(u => u.id === userId);
  if (!usr) throw new Error('Usuario no encontrado');

  usr.activo = activo;
  usr.actualizado_en = new Date().toISOString();
  return { mensaje: `Estado actualizado a ${activo ? 'Activo' : 'Inactivo'}.` };
}

export async function assignUserRoles(userId: string, rolesIds: number[]): Promise<any> {
  await delay();
  const usr = _adminUsers.find(u => u.id === userId);
  if (!usr) throw new Error('Usuario no encontrado');

  const roleMap: Record<number, string> = {
    1: 'ADMINISTRADOR', 2: 'GERENTE', 3: 'VENDEDOR', 4: 'ANALISTA', 5: 'ALMACEN'
  };
  usr.roles = rolesIds.map(id => roleMap[id] || 'VENDEDOR');
  usr.actualizado_en = new Date().toISOString();
  return { mensaje: 'Roles actualizados correctamente.' };
}

export async function updateUserPassword(userId: string, newPassword: string): Promise<any> {
  await delay(200);
  const usr = _adminUsers.find(u => u.id === userId);
  if (!usr) throw new Error('Usuario no encontrado');

  usr.actualizado_en = new Date().toISOString();
  return { mensaje: `Contraseña de seguridad actualizada correctamente para ${usr.correo_electronico}.` };
}

export async function createAdminUser(data: {
  nombre_completo: string;
  correo_electronico: string;
  telefono?: string;
  roles: string[];
  password?: string;
}): Promise<MockAdminUser> {
  await delay(250);
  const newUser: MockAdminUser = {
    id: `usr-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    empresa_id: 1,
    nombre_completo: data.nombre_completo,
    correo_electronico: data.correo_electronico,
    telefono: data.telefono || '+51 987 654 321',
    activo: true,
    ultimo_acceso: undefined,
    creado_en: new Date().toISOString(),
    actualizado_en: new Date().toISOString(),
    roles: data.roles && data.roles.length > 0 ? data.roles : ['VENDEDOR']
  };
  _adminUsers = [newUser, ..._adminUsers];
  return newUser;
}


export async function getInsights(): Promise<Insight[]> {
  await delay();
  return [...mockInsights];
}

export async function getLiveSalesMetrics() {
  await delay();
  return { ...mockLiveSalesMetrics };
}


