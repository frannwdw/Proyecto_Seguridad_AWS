export interface User {
  id: string | number;
  email: string;
  correo_electronico?: string;
  full_name: string;
  nombre_completo?: string;
  role?: string;
  roles?: string[];
  permisos?: string[];
  company_id: number;
  is_active: boolean;
}

export interface SolicitudAcceso {
  id: number;
  usuario_id: string;
  empresa_id: number;
  nombre_completo: string;
  correo_electronico: string;
  motivo?: string;
  estado: 'PENDIENTE' | 'APROBADA' | 'RECHAZADA';
  creado_en: string;
  actualizado_en: string;
}

export interface UsuarioEmpresarial {
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

export interface RolEmpresarial {
  id: number;
  empresa_id: number;
  codigo: string;
  nombre: string;
  descripcion?: string;
  es_sistema: boolean;
  activo: boolean;
  creado_en: string;
  permisos: PermisoItem[];
}

export interface PermisoItem {
  id: number;
  codigo: string;
  modulo: string;
  nombre: string;
  descripcion?: string;
  creado_en: string;
}


export interface Customer {
  id: number;
  company_id: number;
  customer_type: 'NATURAL' | 'JURIDICA';
  full_name: string;
  doc_type: string;
  doc_number: string;
  email?: string;
  phone?: string;
  address?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  total_purchases_count?: number;
  total_amount_spent?: string | number;
  average_ticket?: string | number;
  last_purchase_date?: string;
}

export interface Product {
  id: number;
  company_id: number;
  category_id: number;
  category_name?: string;
  sku: string;
  name: string;
  description?: string;
  cost_price: string | number;
  sale_price: string | number;
  tax_rate: string | number;
  min_stock_alert: number;
  image_url?: string;
  unit_margin: string | number;
  margin_percentage: string | number;
  physical_stock: number;
  reserved_stock: number;
  available_stock: number;
  is_active: boolean;
  created_at: string;
}

export interface Category {
  id: number;
  name: string;
  description?: string;
  is_active: boolean;
}

export interface InventoryItem {
  id: number;
  product_id: number;
  sku: string;
  product_name: string;
  category_name: string;
  physical_stock: number;
  reserved_stock: number;
  available_stock: number;
  min_stock_alert: number;
  is_low_stock: boolean;
  updated_at: string;
}

export interface InventoryMovement {
  id: number;
  inventory_id: number;
  product_id: number;
  product_name: string;
  product_sku: string;
  movement_type: 'ENTRY' | 'EXIT' | 'RESERVE' | 'RELEASE' | 'ADJUSTMENT';
  quantity: number;
  previous_stock: number;
  resulting_stock: number;
  reference_doc?: string;
  reason?: string;
  user_name?: string;
  created_at: string;
  /** Local / sucursal donde ocurrió el movimiento */
  local_id?: number;
}

export interface OrderItem {
  id: number;
  product_id: number;
  product_sku: string;
  product_name: string;
  quantity: number;
  unit_price: string | number;
  unit_cost: string | number;
  discount_percentage: string | number;
  line_subtotal: string | number;
}

export interface Order {
  id: number;
  order_code: string;
  customer_id: number;
  customer_name: string;
  salesperson_id: number;
  salesperson_name: string;
  status: 'DRAFT' | 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'FULFILLED';
  subtotal: string | number;
  tax_amount: string | number;
  discount_amount: string | number;
  total_amount: string | number;
  notes?: string;
  created_at: string;
  items: OrderItem[];
}

export interface SaleDetail {
  id: number;
  product_id: number;
  product_sku: string;
  product_name: string;
  quantity: number;
  unit_cost: string | number;
  unit_price: string | number;
  tax_rate: string | number;
  discount_amount: string | number;
  line_subtotal: string | number;
  line_total: string | number;
}

export interface Local {
  id: number;
  /** Código interno del local: L001, L002... */
  codigo: string;
  /** Nombre comercial del local (va impreso en los comprobantes SUNAT) */
  nombre: string;
  /** Dirección física del local (requisito impreso en el comprobante) */
  direccion: string;
  telefono: string;
  /** La matriz es el local por defecto cuando no hay otro activo */
  es_principal: boolean;
  /** Serie de FACTURAS asignada a este local (SUNAT: serie por local) */
  series_factura: string;
  /** Serie de BOLETAS asignada a este local */
  series_boleta: string;
  is_active: boolean;
  created_at: string;
}

export interface Sale {
  id: number;
  sale_code: string;
  customer_id: number;
  customer_name: string;
  salesperson_id: number;
  salesperson_name: string;
  status: 'CONFIRMED' | 'ANNULLED' | 'PARTIALLY_REFUNDED' | 'REFUNDED';
  payment_status: 'PENDING' | 'PARTIAL' | 'PAID' | 'REFUNDED';
  /** Local / sucursal emisor de la venta */
  local_id?: number;
  local_name?: string;
  /** Tipo de comprobante de pago (normativa SUNAT Perú) */
  document_type?: 'FACTURA' | 'BOLETA';
  /** Serie del comprobante: F001 (facturas) / B001 (boletas) */
  document_series?: string;
  /** Correlativo numérico dentro de la serie (inmutable, no se reutiliza) */
  document_number?: number;
  /** Condición de pago comercial */
  payment_condition?: 'CONTADO' | 'CREDITO';
  subtotal: string | number;
  tax_amount: string | number;
  discount_amount: string | number;
  total_amount: string | number;
  paid_amount: string | number;
  pending_balance: string | number;
  notes?: string;
  created_at: string;
  items: SaleDetail[];
}

export interface PaymentMethod {
  id: number;
  name: string;
  requires_reference: boolean;
  is_active: boolean;
}

export interface Payment {
  id: number;
  sale_id: number;
  sale_code: string;
  payment_method_name: string;
  amount: string | number;
  reference?: string;
  received_by_name?: string;
  payment_date: string;
  notes?: string;
}

export interface Employee {
  id: number;
  company_id: number;
  first_name: string;
  last_name: string;
  doc_number: string;
  email?: string;
  phone?: string;
  job_title: string;
  commission_rate: string | number;
  monthly_sales_target: string | number;
  is_active: boolean;
  hire_date: string;
}

export interface EmployeePerformance extends Employee {
  total_sales_count: number;
  total_sales_amount: string | number;
  total_commission_earned: string | number;
  target_fulfillment_pct: string | number;
}

export interface DashboardSummary {
  confirmed_sales_total: string | number;
  collected_cash_total: string | number;
  pending_orders_count: number;
  active_customers_count: number;
  active_products_count: number;
  low_stock_products_count: number;
  recent_sales: Array<{
    id: number;
    sale_code: string;
    customer_name: string;
    total_amount: string | number;
    payment_status: string;
    created_at: string;
  }>;
  top_selling_products: Array<{
    product_id: number;
    sku: string;
    product_name: string;
    units_sold: number;
    total_revenue: string | number;
  }>;
  low_stock_alerts: Array<{
    product_id: number;
    sku: string;
    product_name: string;
    physical_stock: number;
    min_stock_alert: number;
  }>;
}

export interface Insight {
  id: number;
  title: string;
  description: string;
  metric: string;
  period: string;
  condition_rule: string;
  evidence_value: string;
  severity: 'INFO' | 'WARNING' | 'OPPORTUNITY' | 'CRITICAL';
  created_at: string;
}
