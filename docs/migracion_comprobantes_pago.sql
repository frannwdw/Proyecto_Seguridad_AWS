-- ==============================================================================
-- SALESIA ENTERPRISE — MIGRACIÓN: COMPROBANTES DE PAGO (FACTURA / BOLETA)
-- ==============================================================================
-- Autor  : Equipo SalesIA (rama frontend — Integración)
-- Destino: Supabase PostgreSQL / AWS RDS (ejecutar en sesión directa puerto 5432)
-- Nota   : El frontend ya consume estos campos vía mockDataService.
--          Ejecutar este script para que la BD real quede alineada.
-- ==============================================================================

-- 1. Comprobantes internos de venta (tabla `sales` según esquema del backend)
ALTER TABLE sales
    ADD COLUMN IF NOT EXISTS document_type      VARCHAR(10),  -- 'FACTURA' | 'BOLETA'
    ADD COLUMN IF NOT EXISTS document_series    VARCHAR(8),   -- 'F001'     | 'B001'
    ADD COLUMN IF NOT EXISTS document_number    INTEGER,      -- correlativo por serie
    ADD COLUMN IF NOT EXISTS payment_condition  VARCHAR(10);  -- 'CONTADO'  | 'CREDITO'

-- 2. Reglas de negocio a nivel de base de datos (integridad anticorrupción)
COMMENT ON COLUMN sales.document_type IS 'Tipo de comprobante SUNAT: FACTURA (exige cliente con RUC) o BOLETA.';
COMMENT ON COLUMN sales.document_series IS 'Serie del comprobante: F001 facturas / B001 boletas.';
COMMENT ON COLUMN sales.document_number IS 'Correlativo incremental por serie. INMUTABLE: una venta anulada NUNCA libera su número.';
COMMENT ON COLUMN sales.payment_condition IS 'CONTADO: cobro inmediato en caja. CREDITO: saldo pendiente amortizable en payments.';

-- 3. Poblado de datos históricos (backfill idempotente):
--    Jurídicas (RUC) -> Factura, Naturales (DNI) -> Boleta, con correlativo por serie.
WITH backfill AS (
    SELECT
        s.id,
        CASE WHEN c.doc_type = 'RUC' OR c.customer_type = 'JURIDICA' THEN 'FACTURA' ELSE 'BOLETA' END AS tipo,
        -- Simplificación de migración: solo facturas a crédito heredan condicion de crédito
        CASE
            WHEN (c.doc_type = 'RUC' OR c.customer_type = 'JURIDICA')
                 AND c.payment_status IN ('PENDING', 'PARTIAL')
            THEN 'CREDITO'
            ELSE 'CONTADO'
        END AS cond
    FROM (SELECT id, customer_id, payment_status FROM sales) s
    LEFT JOIN customers c ON c.id = s.customer_id
)
UPDATE sales s
SET document_type = b.tipo,
    payment_condition = b.cond
FROM backfill b
WHERE s.id = b.id
  AND s.document_type IS NULL;

-- Correlativos en orden cronológico por serie (F001 primero, luego B001)
WITH enumeradas AS (
    SELECT id,
           document_type,
           ROW_NUMBER() OVER (PARTITION BY document_type ORDER BY created_at) AS correlativo
    FROM sales
    WHERE document_type IS NOT NULL AND document_number IS NULL
)
UPDATE sales s
SET document_series = CASE WHEN e.document_type = 'FACTURA' THEN 'F001' ELSE 'B001' END,
    document_number = e.correlativo
FROM enumeradas e
WHERE s.id = e.id;

-- 4. Vista de soporte financiero por cliente (para reportes e índices futuros)
CREATE OR REPLACE VIEW vw_estado_financiero_clientes AS
SELECT
    s.customer_id,
    SUM(s.total_amount)     AS total_facturado,
    SUM(s.paid_amount)      AS total_cobrado,
    SUM(s.pending_balance)  AS total_saldo_pendiente,
    CASE WHEN SUM(s.total_amount) > 0
         THEN ROUND(SUM(s.paid_amount) / SUM(s.total_amount) * 100, 2)
         ELSE 0 END         AS porcentaje_cobranza
FROM sales s
WHERE s.status = 'CONFIRMED'
GROUP BY s.customer_id;

-- 5. Verificación Visual
SELECT id, sale_code, document_type, document_series, document_number, payment_condition, pending_balance
FROM sales
ORDER BY document_series, document_number
LIMIT 20;
