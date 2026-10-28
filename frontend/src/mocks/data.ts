/**
 * SalesIA Enterprise — Datos Simulados Coherentes
 *
 * Todos los valores son fijos y coherentes entre módulos.
 * Las relaciones entre ventas, productos, clientes, inventario y pagos son lógicamente consistentes.
 */

import type {
  Customer, Product, Category, InventoryItem, InventoryMovement,
  Order, OrderItem, Sale, SaleDetail, Payment, PaymentMethod,
  Employee, EmployeePerformance, DashboardSummary, Insight,
  Local
} from '../types';

// ============================================================================
// CATEGORÍAS
// ============================================================================
export const mockCategories: Category[] = [
  { id: 1, name: 'Electrónica', description: 'Dispositivos electrónicos y componentes', is_active: true },
  { id: 2, name: 'Oficina', description: 'Suministros y equipamiento de oficina', is_active: true },
  { id: 3, name: 'Software', description: 'Licencias y servicios de software', is_active: true },
  { id: 4, name: 'Periféricos', description: 'Teclados, ratones, auriculares', is_active: true },
  { id: 5, name: 'Almacenamiento', description: 'Discos duros, memorias USB, NAS', is_active: true },
];

// ============================================================================
// PRODUCTOS (con márgenes calculados según RN-PRO-03 y RN-PRO-04)
// ============================================================================
export const mockProducts: Product[] = [
  {
    id: 1, company_id: 1, category_id: 1, category_name: 'Electrónica',
    sku: 'ELEC-001', name: 'Laptop ThinkPad X1 Carbon',
    description: 'Laptop empresarial 14" Intel i7 16GB RAM 512GB SSD',
    cost_price: 850.00, sale_price: 1299.99, tax_rate: 0.18,
    min_stock_alert: 3, unit_margin: 449.99, margin_percentage: 34.62,
    physical_stock: 15, reserved_stock: 2, available_stock: 13,
    is_active: true, created_at: '2026-01-15T10:00:00Z'
  },
  {
    id: 2, company_id: 1, category_id: 1, category_name: 'Electrónica',
    sku: 'ELEC-002', name: 'Monitor Dell UltraSharp 27"',
    description: 'Monitor 4K IPS USB-C con hub integrado',
    cost_price: 320.00, sale_price: 549.99, tax_rate: 0.18,
    min_stock_alert: 5, unit_margin: 229.99, margin_percentage: 41.82,
    physical_stock: 22, reserved_stock: 3, available_stock: 19,
    is_active: true, created_at: '2026-02-01T10:00:00Z'
  },
  {
    id: 3, company_id: 1, category_id: 4, category_name: 'Periféricos',
    sku: 'PERI-001', name: 'Teclado Mecánico Logitech MX Keys',
    description: 'Teclado inalámbrico retroiluminado multi-dispositivo',
    cost_price: 45.00, sale_price: 99.99, tax_rate: 0.18,
    min_stock_alert: 10, unit_margin: 54.99, margin_percentage: 55.00,
    physical_stock: 48, reserved_stock: 5, available_stock: 43,
    is_active: true, created_at: '2026-02-10T10:00:00Z'
  },
  {
    id: 4, company_id: 1, category_id: 4, category_name: 'Periféricos',
    sku: 'PERI-002', name: 'Auriculares Jabra Evolve2 75',
    description: 'Auriculares con cancelación activa de ruido para oficina',
    cost_price: 120.00, sale_price: 249.99, tax_rate: 0.18,
    min_stock_alert: 8, unit_margin: 129.99, margin_percentage: 52.00,
    physical_stock: 30, reserved_stock: 4, available_stock: 26,
    is_active: true, created_at: '2026-03-05T10:00:00Z'
  },
  {
    id: 5, company_id: 1, category_id: 3, category_name: 'Software',
    sku: 'SOFT-001', name: 'Licencia Microsoft 365 Business Premium',
    description: 'Suscripción anual por usuario con Azure AD',
    cost_price: 130.00, sale_price: 264.00, tax_rate: 0.18,
    min_stock_alert: 20, unit_margin: 134.00, margin_percentage: 50.76,
    physical_stock: 100, reserved_stock: 8, available_stock: 92,
    is_active: true, created_at: '2026-03-12T10:00:00Z'
  },
  {
    id: 6, company_id: 1, category_id: 5, category_name: 'Almacenamiento',
    sku: 'STOR-001', name: 'SSD Samsung 990 Pro 2TB',
    description: 'Unidad de estado sólido NVMe PCIe 4.0',
    cost_price: 110.00, sale_price: 189.99, tax_rate: 0.18,
    min_stock_alert: 10, unit_margin: 79.99, margin_percentage: 42.10,
    physical_stock: 35, reserved_stock: 6, available_stock: 29,
    is_active: true, created_at: '2026-04-01T10:00:00Z'
  },
  {
    id: 7, company_id: 1, category_id: 2, category_name: 'Oficina',
    sku: 'OFIC-001', name: 'Silla Ergonómica Herman Miller Aeron',
    description: 'Silla de oficina ergonómica talla B certificada',
    cost_price: 580.00, sale_price: 1099.00, tax_rate: 0.18,
    min_stock_alert: 2, unit_margin: 519.00, margin_percentage: 47.22,
    physical_stock: 8, reserved_stock: 1, available_stock: 7,
    is_active: true, created_at: '2026-04-15T10:00:00Z'
  },
  {
    id: 8, company_id: 1, category_id: 2, category_name: 'Oficina',
    sku: 'OFIC-002', name: 'Escritorio Eléctrico Altura Ajustable',
    description: 'Standing desk 160cm con control digital',
    cost_price: 280.00, sale_price: 499.99, tax_rate: 0.18,
    min_stock_alert: 3, unit_margin: 219.99, margin_percentage: 44.00,
    physical_stock: 4, reserved_stock: 1, available_stock: 3,
    is_active: true, created_at: '2026-05-01T10:00:00Z'
  },
];

// ============================================================================
// CLIENTES
// ============================================================================
export const mockCustomers: Customer[] = [
  {
    id: 1, company_id: 1, customer_type: 'JURIDICA', full_name: 'Tech Solutions Corp. S.A.C.',
    doc_type: 'RUC', doc_number: '20601234567', email: 'compras@techsolutions.pe',
    phone: '+51 987 654 321', address: 'Av. Javier Prado Este 4600, Surco, Lima',
    is_active: true, created_at: '2026-01-20T08:00:00Z', updated_at: '2026-10-15T10:00:00Z',
    total_purchases_count: 12, total_amount_spent: 18450.00, average_ticket: 1537.50,
    last_purchase_date: '2026-10-12T14:00:00Z'
  },
  {
    id: 2, company_id: 1, customer_type: 'NATURAL', full_name: 'María Elena Gutiérrez Sánchez',
    doc_type: 'DNI', doc_number: '45678912', email: 'mgutierrez@gmail.com',
    phone: '+51 912 345 678', address: 'Jr. Los Olivos 245, Miraflores',
    is_active: true, created_at: '2026-02-05T09:00:00Z', updated_at: '2026-10-10T10:00:00Z',
    total_purchases_count: 5, total_amount_spent: 3620.00, average_ticket: 724.00,
    last_purchase_date: '2026-10-08T11:00:00Z'
  },
  {
    id: 3, company_id: 1, customer_type: 'JURIDICA', full_name: 'Distribuidora Global E.I.R.L.',
    doc_type: 'RUC', doc_number: '20504567890', email: 'ventas@distribglobal.com',
    phone: '+51 941 567 890', address: 'Calle San Martín 890, San Isidro',
    is_active: true, created_at: '2026-03-10T10:00:00Z', updated_at: '2026-10-14T10:00:00Z',
    total_purchases_count: 8, total_amount_spent: 9875.00, average_ticket: 1234.38,
    last_purchase_date: '2026-10-14T16:00:00Z'
  },
  {
    id: 4, company_id: 1, customer_type: 'NATURAL', full_name: 'Carlos Alberto Mendoza Ríos',
    doc_type: 'DNI', doc_number: '71234580', email: 'carlos.mendoza@outlook.com',
    phone: '+51 956 789 012', address: 'Av. Arequipa 2150, Lince',
    is_active: true, created_at: '2026-04-22T08:00:00Z', updated_at: '2026-10-05T10:00:00Z',
    total_purchases_count: 3, total_amount_spent: 1890.00, average_ticket: 630.00,
    last_purchase_date: '2026-10-05T09:30:00Z'
  },
  {
    id: 5, company_id: 1, customer_type: 'JURIDICA', full_name: 'Innovación Digital S.A.',
    doc_type: 'RUC', doc_number: '20789012345', email: 'procurement@innovadigital.pe',
    phone: '+51 998 765 432', address: 'Av. La Marina 3200, San Miguel',
    is_active: true, created_at: '2026-05-15T08:00:00Z', updated_at: '2026-10-16T10:00:00Z',
    total_purchases_count: 15, total_amount_spent: 26780.00, average_ticket: 1785.33,
    last_purchase_date: '2026-10-16T15:00:00Z'
  },
];

// ============================================================================
// INVENTARIO
// ============================================================================
export const mockInventory: InventoryItem[] = mockProducts.map(p => ({
  id: p.id,
  product_id: p.id,
  sku: p.sku,
  product_name: p.name,
  category_name: p.category_name || '',
  physical_stock: p.physical_stock,
  reserved_stock: p.reserved_stock,
  available_stock: p.available_stock,
  min_stock_alert: p.min_stock_alert,
  is_low_stock: p.available_stock <= p.min_stock_alert,
  updated_at: '2026-10-18T10:00:00Z',
}));

export const mockInventoryMovements: InventoryMovement[] = [
  { id: 1, inventory_id: 1, product_id: 1, product_name: 'Laptop ThinkPad X1 Carbon', product_sku: 'ELEC-001', movement_type: 'ENTRY', quantity: 10, previous_stock: 5, resulting_stock: 15, reference_doc: 'OC-2026-001', reason: 'Reabastecimiento de proveedor Lenovo', user_name: 'Admin General', created_at: '2026-10-01T10:00:00Z', local_id: 1 },
  { id: 2, inventory_id: 2, product_id: 2, product_name: 'Monitor Dell UltraSharp 27"', product_sku: 'ELEC-002', movement_type: 'ENTRY', quantity: 12, previous_stock: 10, resulting_stock: 22, reference_doc: 'OC-2026-002', reason: 'Ingreso de lote Dell', user_name: 'Admin General', created_at: '2026-10-03T10:00:00Z', local_id: 2 },
  { id: 3, inventory_id: 1, product_id: 1, product_name: 'Laptop ThinkPad X1 Carbon', product_sku: 'ELEC-001', movement_type: 'RESERVE', quantity: 2, previous_stock: 15, resulting_stock: 13, reference_doc: 'PED-2026-005', reason: 'Reserva por pedido confirmado', user_name: 'Ana Torres', created_at: '2026-10-10T14:00:00Z', local_id: 1 },
  { id: 4, inventory_id: 3, product_id: 3, product_name: 'Teclado Mecánico Logitech MX Keys', product_sku: 'PERI-001', movement_type: 'EXIT', quantity: 5, previous_stock: 53, resulting_stock: 48, reference_doc: 'VTA-2026-012', reason: 'Despacho de venta directa', user_name: 'Carlos Mendoza', created_at: '2026-10-12T11:00:00Z', local_id: 3 },
  { id: 5, inventory_id: 8, product_id: 8, product_name: 'Escritorio Eléctrico Altura Ajustable', product_sku: 'OFIC-002', movement_type: 'ADJUSTMENT', quantity: -1, previous_stock: 5, resulting_stock: 4, reference_doc: 'AJ-2026-001', reason: 'Ajuste de inventario por daño en almacén', user_name: 'Admin General', created_at: '2026-10-15T09:00:00Z', local_id: 4 },
];

// ============================================================================
// LOCALES / SUCURSALES FÍSICAS — Series SUNAT independientes por local
// F101/B101 = San Isidro (matriz) | F102/B102 = Miraflores | etc.
// ============================================================================
export const mockLocales: Local[] = [
  {
    id: 1,
    codigo: 'L001',
    nombre: 'SalesIA San Isidro',
    direccion: 'Av. República de Panamá 3505, San Isidro, Lima - Perú',
    telefono: '+51 (01) 555-1200',
    es_principal: true,
    series_factura: 'F101',
    series_boleta: 'B101',
    is_active: true,
    created_at: '2023-01-15T10:00:00Z',
  },
  {
    id: 2,
    codigo: 'L002',
    nombre: 'SalesIA Miraflores',
    direccion: 'Av. Larco 845, Local 2, Miraflores, Lima - Perú',
    telefono: '+51 (01) 555-1240',
    es_principal: false,
    series_factura: 'F102',
    series_boleta: 'B102',
    is_active: true,
    created_at: '2024-06-01T10:00:00Z',
  },
  {
    id: 3,
    codigo: 'L003',
    nombre: 'SalesIA Lima Centro',
    direccion: 'Av. Arequipa 2270, Lince, Lima - Perú',
    telefono: '+51 (01) 555-1280',
    es_principal: false,
    series_factura: 'F103',
    series_boleta: 'B103',
    is_active: true,
    created_at: '2025-03-10T10:00:00Z',
  },
  {
    id: 4,
    codigo: 'L004',
    nombre: 'SalesIA Canal Online',
    direccion: 'Av. República de Panamá 3505, San Isidro, Lima (Centro de despacho)',
    telefono: '+51 998 400 155',
    es_principal: false,
    series_factura: 'F104',
    series_boleta: 'B104',
    is_active: true,
    created_at: '2025-08-20T10:00:00Z',
  },
];

// ============================================================================
// EMPLEADOS (Usuarios reales registrados en la Base de Datos)
// ============================================================================
export const mockEmployees: Employee[] = [
  { id: 1, company_id: 1, first_name: 'Pedro', last_name: 'Torres Castillo', doc_number: '40234567', email: 'pedrotorrescastillo6@gmail.com', phone: '+51 987 111 222', job_title: 'Ejecutivo Comercial Senior', commission_rate: 0.05, monthly_sales_target: 18000, is_active: true, hire_date: '2024-03-15' },
  { id: 2, company_id: 1, first_name: 'Jhon', last_name: 'Gonzales', doc_number: '45678912', email: 'jhonssj006@gmail.com', phone: '+51 987 333 444', job_title: 'Vendedor de Cuentas Clave', commission_rate: 0.045, monthly_sales_target: 15000, is_active: true, hire_date: '2024-06-01' },
  { id: 3, company_id: 1, first_name: 'Anderson', last_name: 'Aponte', doc_number: '43210987', email: 'andersonaponte720@gmail.com', phone: '+51 987 555 666', job_title: 'Asesor Comercial Especializado', commission_rate: 0.04, monthly_sales_target: 12000, is_active: true, hire_date: '2025-01-10' },
  { id: 4, company_id: 1, first_name: 'Víctor', last_name: 'Jesús Obrero', doc_number: '41567890', email: 'victorjesusobrero@gmail.com', phone: '+51 987 777 888', job_title: 'Gerente de Operaciones y Ventas', commission_rate: 0.03, monthly_sales_target: 30000, is_active: true, hire_date: '2023-11-01' },
  { id: 5, company_id: 1, first_name: 'Franchesco', last_name: 'Alexander', doc_number: '44556677', email: 'franchescoalexanderj@gmail.com', phone: '+51 987 999 000', job_title: 'Director & Administrador General', commission_rate: 0.06, monthly_sales_target: 25000, is_active: true, hire_date: '2023-01-15' },
  { id: 6, company_id: 1, first_name: 'Frann', last_name: 'Juarez', doc_number: '47890123', email: 'frannjuarez6@gmail.com', phone: '+51 987 222 333', job_title: 'Analista de Modelos & Datos', commission_rate: 0.02, monthly_sales_target: 10000, is_active: true, hire_date: '2025-02-01' },
];

export const mockEmployeePerformance: Record<number, EmployeePerformance> = {
  1: { ...mockEmployees[0], total_sales_count: 24, total_sales_amount: 32450.00, total_commission_earned: 1622.50, target_fulfillment_pct: 180.28 },
  2: { ...mockEmployees[1], total_sales_count: 19, total_sales_amount: 21300.00, total_commission_earned: 958.50, target_fulfillment_pct: 142.00 },
  3: { ...mockEmployees[2], total_sales_count: 14, total_sales_amount: 14200.00, total_commission_earned: 568.00, target_fulfillment_pct: 118.33 },
  4: { ...mockEmployees[3], total_sales_count: 31, total_sales_amount: 45800.00, total_commission_earned: 1374.00, target_fulfillment_pct: 152.67 },
  5: { ...mockEmployees[4], total_sales_count: 28, total_sales_amount: 38900.00, total_commission_earned: 2334.00, target_fulfillment_pct: 155.60 },
  6: { ...mockEmployees[5], total_sales_count: 12, total_sales_amount: 11500.00, total_commission_earned: 230.00, target_fulfillment_pct: 115.00 },
};


// ============================================================================
// MÉTODOS DE PAGO
// ============================================================================
export const mockPaymentMethods: PaymentMethod[] = [
  { id: 1, name: 'Efectivo', requires_reference: false, is_active: true },
  { id: 2, name: 'Tarjeta de Crédito', requires_reference: true, is_active: true },
  { id: 3, name: 'Transferencia Bancaria', requires_reference: true, is_active: true },
  { id: 4, name: 'Yape / Plin', requires_reference: true, is_active: true },
];

// ============================================================================
// PEDIDOS
// ============================================================================
export const mockOrders: Order[] = [
  {
    id: 1, order_code: 'PED-2026-001', customer_id: 1, customer_name: 'Tech Solutions Corp. S.A.C.',
    salesperson_id: 1, salesperson_name: 'Pedro Torres Castillo', status: 'CONFIRMED',
    subtotal: 2599.98, tax_amount: 467.99, discount_amount: 0, total_amount: 3067.97,
    notes: 'Pedido para renovación de equipos', created_at: '2026-10-05T10:00:00Z',
    items: [
      { id: 1, product_id: 1, product_sku: 'ELEC-001', product_name: 'Laptop ThinkPad X1 Carbon', quantity: 2, unit_price: 1299.99, unit_cost: 850.00, discount_percentage: 0, line_subtotal: 2599.98 }
    ]
  },
  {
    id: 2, order_code: 'PED-2026-002', customer_id: 3, customer_name: 'Distribuidora Global E.I.R.L.',
    salesperson_id: 2, salesperson_name: 'Jhon Gonzales', status: 'PENDING',
    subtotal: 749.97, tax_amount: 134.99, discount_amount: 0, total_amount: 884.96,
    notes: 'Pedido periféricos para nuevos empleados', created_at: '2026-10-12T09:00:00Z',
    items: [
      { id: 2, product_id: 3, product_sku: 'PERI-001', product_name: 'Teclado Mecánico Logitech MX Keys', quantity: 3, unit_price: 99.99, unit_cost: 45.00, discount_percentage: 0, line_subtotal: 299.97 },
      { id: 3, product_id: 4, product_sku: 'PERI-002', product_name: 'Auriculares Jabra Evolve2 75', quantity: 2, unit_price: 249.99, unit_cost: 120.00, discount_percentage: 0, line_subtotal: 449.98 }
    ]
  },
  {
    id: 3, order_code: 'PED-2026-003', customer_id: 5, customer_name: 'Innovación Digital S.A.',
    salesperson_id: 3, salesperson_name: 'Anderson Aponte', status: 'DRAFT',
    subtotal: 1320.00, tax_amount: 237.60, discount_amount: 0, total_amount: 1557.60,
    notes: 'Cotización de licencias M365', created_at: '2026-10-17T14:00:00Z',
    items: [
      { id: 4, product_id: 5, product_sku: 'SOFT-001', product_name: 'Licencia Microsoft 365 Business Premium', quantity: 5, unit_price: 264.00, unit_cost: 130.00, discount_percentage: 0, line_subtotal: 1320.00 }
    ]
  },
];

// ============================================================================
// VENTAS — Coherentes con dashboard ($60,615 confirmadas)
// ============================================================================
export const mockSales: Sale[] = [
  {
    id: 1, sale_code: 'VTA-2026-001', customer_id: 1, customer_name: 'Tech Solutions Corp. S.A.C.',
    salesperson_id: 1, salesperson_name: 'Pedro Torres Castillo', status: 'CONFIRMED', payment_status: 'PAID',
    local_id: 1, local_name: 'SalesIA San Isidro',
    document_type: 'FACTURA', document_series: 'F101', document_number: 1, payment_condition: 'CONTADO',
    subtotal: 5199.96, tax_amount: 935.99, discount_amount: 0, total_amount: 6135.95,
    paid_amount: 6135.95, pending_balance: 0, notes: 'Venta de 4 laptops', created_at: '2026-09-15T10:00:00Z',
    items: [
      { id: 1, product_id: 1, product_sku: 'ELEC-001', product_name: 'Laptop ThinkPad X1 Carbon', quantity: 4, unit_cost: 850.00, unit_price: 1299.99, tax_rate: 0.18, discount_amount: 0, line_subtotal: 5199.96, line_total: 6135.95 }
    ]
  },
  {
    id: 2, sale_code: 'VTA-2026-002', customer_id: 5, customer_name: 'Innovación Digital S.A.',
    salesperson_id: 3, salesperson_name: 'Anderson Aponte', status: 'CONFIRMED', payment_status: 'PAID',
    local_id: 2, local_name: 'SalesIA Miraflores',
    document_type: 'FACTURA', document_series: 'F102', document_number: 1, payment_condition: 'CONTADO',
    subtotal: 8249.85, tax_amount: 1484.97, discount_amount: 0, total_amount: 9734.82,
    paid_amount: 9734.82, pending_balance: 0, notes: 'Compra masiva equipamiento', created_at: '2026-09-22T14:00:00Z',
    items: [
      { id: 2, product_id: 2, product_sku: 'ELEC-002', product_name: 'Monitor Dell UltraSharp 27"', quantity: 15, unit_cost: 320.00, unit_price: 549.99, tax_rate: 0.18, discount_amount: 0, line_subtotal: 8249.85, line_total: 9734.82 }
    ]
  },
  {
    id: 3, sale_code: 'VTA-2026-003', customer_id: 3, customer_name: 'Distribuidora Global E.I.R.L.',
    salesperson_id: 2, salesperson_name: 'Jhon Gonzales', status: 'CONFIRMED', payment_status: 'PARTIAL',
    local_id: 1, local_name: 'SalesIA San Isidro',
    document_type: 'FACTURA', document_series: 'F101', document_number: 2, payment_condition: 'CREDITO',
    subtotal: 13200.00, tax_amount: 2376.00, discount_amount: 0, total_amount: 15576.00,
    paid_amount: 10000.00, pending_balance: 5576.00, notes: 'Lote de licencias corporativas', created_at: '2026-10-01T10:00:00Z',
    items: [
      { id: 3, product_id: 5, product_sku: 'SOFT-001', product_name: 'Licencia Microsoft 365 Business Premium', quantity: 50, unit_cost: 130.00, unit_price: 264.00, tax_rate: 0.18, discount_amount: 0, line_subtotal: 13200.00, line_total: 15576.00 }
    ]
  },
  {
    id: 4, sale_code: 'VTA-2026-004', customer_id: 2, customer_name: 'María Elena Gutiérrez Sánchez',
    salesperson_id: 1, salesperson_name: 'Pedro Torres Castillo', status: 'CONFIRMED', payment_status: 'PAID',
    local_id: 3, local_name: 'SalesIA Lima Centro',
    document_type: 'BOLETA', document_series: 'B103', document_number: 1, payment_condition: 'CONTADO',
    subtotal: 1599.97, tax_amount: 288.00, discount_amount: 0, total_amount: 1887.97,
    paid_amount: 1887.97, pending_balance: 0, created_at: '2026-10-08T11:00:00Z',
    items: [
      { id: 4, product_id: 7, product_sku: 'OFIC-001', product_name: 'Silla Ergonómica Herman Miller Aeron', quantity: 1, unit_cost: 580.00, unit_price: 1099.00, tax_rate: 0.18, discount_amount: 0, line_subtotal: 1099.00, line_total: 1296.82 },
      { id: 5, product_id: 8, product_sku: 'OFIC-002', product_name: 'Escritorio Eléctrico Altura Ajustable', quantity: 1, unit_cost: 280.00, unit_price: 499.99, tax_rate: 0.18, discount_amount: 0, line_subtotal: 499.99, line_total: 589.99 }
    ]
  },
  {
    id: 5, sale_code: 'VTA-2026-005', customer_id: 4, customer_name: 'Carlos Alberto Mendoza Ríos',
    salesperson_id: 2, salesperson_name: 'Jhon Gonzales', status: 'CONFIRMED', payment_status: 'PENDING',
    local_id: 4, local_name: 'SalesIA Canal Online',
    document_type: 'BOLETA', document_series: 'B104', document_number: 1, payment_condition: 'CREDITO',
    subtotal: 1299.99, tax_amount: 234.00, discount_amount: 0, total_amount: 1533.99,
    paid_amount: 0, pending_balance: 1533.99, created_at: '2026-10-14T09:00:00Z',
    items: [
      { id: 6, product_id: 1, product_sku: 'ELEC-001', product_name: 'Laptop ThinkPad X1 Carbon', quantity: 1, unit_cost: 850.00, unit_price: 1299.99, tax_rate: 0.18, discount_amount: 0, line_subtotal: 1299.99, line_total: 1533.99 }
    ]
  },
];

// ============================================================================
// PAGOS
// ============================================================================
export const mockPayments: Payment[] = [
  { id: 1, sale_id: 1, sale_code: 'VTA-2026-001', payment_method_name: 'Transferencia Bancaria', amount: 6135.95, reference: 'TRF-BCP-20261001', received_by_name: 'Pedro Torres Castillo', payment_date: '2026-09-15T10:30:00Z', notes: 'Pago completo por transferencia' },
  { id: 2, sale_id: 2, sale_code: 'VTA-2026-002', payment_method_name: 'Transferencia Bancaria', amount: 9734.82, reference: 'TRF-BBVA-20261005', received_by_name: 'Anderson Aponte', payment_date: '2026-09-23T09:00:00Z', notes: 'Pago total' },
  { id: 3, sale_id: 3, sale_code: 'VTA-2026-003', payment_method_name: 'Efectivo', amount: 5000.00, received_by_name: 'Jhon Gonzales', payment_date: '2026-10-01T11:00:00Z', notes: 'Primer abono en efectivo' },
  { id: 4, sale_id: 3, sale_code: 'VTA-2026-003', payment_method_name: 'Tarjeta de Crédito', amount: 5000.00, reference: 'VISA-****4523', received_by_name: 'Jhon Gonzales', payment_date: '2026-10-08T14:00:00Z', notes: 'Segundo abono con tarjeta' },
  { id: 5, sale_id: 4, sale_code: 'VTA-2026-004', payment_method_name: 'Yape / Plin', amount: 1887.97, reference: 'YAPE-20261008', received_by_name: 'Pedro Torres Castillo', payment_date: '2026-10-08T11:30:00Z', notes: 'Pago inmediato por Yape' },
];

// ============================================================================
// DASHBOARD SUMMARY — Coherente con ventas y productos
// ============================================================================
// Total confirmadas: 6135.95 + 9734.82 + 15576.00 + 1887.97 + 1533.99 = 34,868.73
// Cobrado: 6135.95 + 9734.82 + 10000.00 + 1887.97 + 0 = 27,758.74
export const mockDashboardSummary: DashboardSummary = {
  confirmed_sales_total: 34868.73,
  collected_cash_total: 27758.74,
  pending_orders_count: 2,
  active_customers_count: 5,
  active_products_count: 8,
  low_stock_products_count: 2,
  recent_sales: mockSales.slice(0, 5).reverse().map(s => ({
    id: s.id,
    sale_code: s.sale_code,
    customer_name: s.customer_name,
    total_amount: s.total_amount,
    payment_status: s.payment_status,
    created_at: s.created_at,
  })),
  top_selling_products: [
    { product_id: 5, sku: 'SOFT-001', product_name: 'Licencia Microsoft 365 Business Premium', units_sold: 50, total_revenue: 15576.00 },
    { product_id: 2, sku: 'ELEC-002', product_name: 'Monitor Dell UltraSharp 27"', units_sold: 15, total_revenue: 9734.82 },
    { product_id: 1, sku: 'ELEC-001', product_name: 'Laptop ThinkPad X1 Carbon', units_sold: 5, total_revenue: 7669.94 },
    { product_id: 7, sku: 'OFIC-001', product_name: 'Silla Ergonómica Herman Miller Aeron', units_sold: 1, total_revenue: 1296.82 },
    { product_id: 8, sku: 'OFIC-002', product_name: 'Escritorio Eléctrico Altura Ajustable', units_sold: 1, total_revenue: 589.99 },
  ],
  low_stock_alerts: [
    { product_id: 8, sku: 'OFIC-002', product_name: 'Escritorio Eléctrico Altura Ajustable', physical_stock: 4, min_stock_alert: 3 },
    { product_id: 7, sku: 'OFIC-001', product_name: 'Silla Ergonómica Herman Miller Aeron', physical_stock: 8, min_stock_alert: 2 },
  ]
};

// ============================================================================
// INSIGHTS
// ============================================================================
export const mockInsights: Insight[] = [
  {
    id: 1, title: 'Concentración de ingresos en licencias de software',
    description: 'El producto SOFT-001 (M365) representa el 44.7% de los ingresos totales por ventas confirmadas. Diversificar la cartera de productos podría reducir el riesgo de concentración.',
    metric: 'revenue_concentration', period: '2026-Q4',
    condition_rule: 'single_product_revenue_share > 40%',
    evidence_value: '44.7% ($15,576.00 / $34,868.73)',
    severity: 'WARNING', created_at: '2026-10-18T08:00:00Z'
  },
  {
    id: 2, title: 'Cobro pendiente en venta VTA-2026-005',
    description: 'La venta por $1,533.99 al cliente Carlos Mendoza permanece sin ningún pago registrado después de 4 días hábiles.',
    metric: 'overdue_payment', period: '2026-10',
    condition_rule: 'payment_status == PENDING AND days_since_sale > 3',
    evidence_value: '$1,533.99 pendiente (100%)',
    severity: 'CRITICAL', created_at: '2026-10-18T08:00:00Z'
  },
  {
    id: 3, title: 'Cumplimiento excepcional de meta en Ana Torres',
    description: 'La ejecutiva Ana Torres ha superado su meta mensual de $15,000 con un cumplimiento del 216%. Considerar incentivos adicionales o aumento de meta.',
    metric: 'target_fulfillment', period: '2026-10',
    condition_rule: 'target_fulfillment_pct > 200%',
    evidence_value: '216.33% ($32,450 / $15,000)',
    severity: 'OPPORTUNITY', created_at: '2026-10-18T08:00:00Z'
  },
  {
    id: 4, title: 'Stock bajo en escritorios ajustables',
    description: 'El producto OFIC-002 tiene solo 3 unidades disponibles, cerca de su umbral mínimo de alerta (3). Se recomienda generar orden de compra.',
    metric: 'low_stock_alert', period: '2026-10',
    condition_rule: 'available_stock <= min_stock_alert',
    evidence_value: '3 disponibles / mín. 3',
    severity: 'WARNING', created_at: '2026-10-18T08:00:00Z'
  },
  {
    id: 5, title: 'Margen bruto superior al 50% en periféricos',
    description: 'Los productos de la categoría Periféricos (PERI-001, PERI-002) mantienen márgenes brutos superiores al 50%, indicando un posicionamiento competitivo saludable.',
    metric: 'margin_analysis', period: '2026-Q4',
    condition_rule: 'category_avg_margin > 50%',
    evidence_value: 'Promedio: 53.5% (55.0% y 52.0%)',
    severity: 'INFO', created_at: '2026-10-18T08:00:00Z'
  },
  {
    id: 6, title: 'Saldo parcial pendiente en VTA-2026-003',
    description: 'La venta de licencias M365 a Distribuidora Global E.I.R.L. tiene un saldo pendiente de $5,576.00 tras dos pagos parciales.',
    metric: 'partial_collection', period: '2026-10',
    condition_rule: 'payment_status == PARTIAL AND pending_balance > 5000',
    evidence_value: '$5,576.00 de $15,576.00 (35.8%)',
    severity: 'WARNING', created_at: '2026-10-18T08:00:00Z'
  },
];

// ============================================================================
// ANALYTICS — Métricas calculadas de centralidad (Media vs Mediana)
// ============================================================================
const salesAmounts = mockSales.filter(s => s.status === 'CONFIRMED').map(s => Number(s.total_amount));
const mean = salesAmounts.reduce((a, b) => a + b, 0) / salesAmounts.length;
const sortedAmounts = [...salesAmounts].sort((a, b) => a - b);
const median = sortedAmounts.length % 2 !== 0
  ? sortedAmounts[Math.floor(sortedAmounts.length / 2)]
  : (sortedAmounts[sortedAmounts.length / 2 - 1] + sortedAmounts[sortedAmounts.length / 2]) / 2;
const diff = mean - median;
const base = Math.abs(median) > 0.000001 ? median : mean;
const relDiffPct = Math.abs(base) > 0.000001 ? (diff / base) * 100 : 0;

export const mockLiveSalesMetrics = {
  has_data: true,
  raw_values: salesAmounts,
  metrics: {
    sample_size: salesAmounts.length,
    mean: Math.round(mean * 100) / 100,
    median: Math.round(median * 100) / 100,
    difference: Math.round(diff * 100) / 100,
    relative_difference_pct: Math.round(relDiffPct * 100) / 100,
    distribution_shape: Math.abs(relDiffPct) < 5
      ? 'Aproximadamente simétrica'
      : diff > 0
        ? 'Sesgo positivo (asimetría a la derecha)'
        : 'Sesgo negativo (asimetría a la izquierda)',
    interpretation: diff > 0
      ? `La media ($${mean.toFixed(2)}) es superior a la mediana ($${median.toFixed(2)}), lo que sugiere la presencia de ventas de monto excepcionalmente alto que elevan el promedio.`
      : `La media ($${mean.toFixed(2)}) y la mediana ($${median.toFixed(2)}) son cercanas. La distribución comercial es relativamente uniforme.`
  }
};
