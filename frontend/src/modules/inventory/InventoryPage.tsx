import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Boxes, Plus, AlertTriangle, ArrowDownRight, ArrowUpRight, History, Sliders, X } from 'lucide-react';
import { getInventory, getInventoryMovements, getProducts, createInventoryMovement } from '../../services/mockDataService';
import { useLocalActivo } from '../../services/localService';
import { InventoryItem, InventoryMovement, Product } from '../../types';

export const InventoryPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'stock' | 'movements'>('stock');
  const [lowStockFilter, setLowStockFilter] = useState(false);
  const [isMovementModalOpen, setIsMovementModalOpen] = useState(false);
  // Filtro del kardex por local/sucursal: '' = Todos los locales
  const { localesActivos, nombreDe } = useLocalActivo();
  const [localFiltro, setLocalFiltro] = useState<string>('');

  // Form state
  const [movementForm, setMovementForm] = useState({
    product_id: 1,
    movement_type: 'ENTRY' as 'ENTRY' | 'EXIT' | 'ADJUSTMENT',
    quantity: 5,
    reason: 'Ingreso de mercancía por reabastecimiento',
    reference_doc: 'DOC-REM-001'
  });

  // Query inventory
  const { data: inventory = [], isLoading: isLoadingInv } = useQuery<InventoryItem[]>({
    queryKey: ['inventory', lowStockFilter],
    queryFn: async () => {
      return await getInventory({ low_stock_only: lowStockFilter });
    }
  });

  // Query movements
  const { data: movementsRaw = [], isLoading: isLoadingMov } = useQuery<InventoryMovement[]>({
    queryKey: ['inventoryMovements'],
    queryFn: async () => {
      return await getInventoryMovements();
    },
    enabled: activeTab === 'movements'
  });

  // Kardex recortado por local seleccionado ('' = Todos los locales)
  const movements = useMemo<InventoryMovement[]>(() => {
    const id = Number(localFiltro);
    if (!id) return movementsRaw;
    return movementsRaw.filter(m => m.local_id === id);
  }, [movementsRaw, localFiltro]);

  // Query products for dropdown
  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ['products'],
    queryFn: async () => {
      return await getProducts();
    }
  });

  // Movement mutation
  const movementMutation = useMutation({
    mutationFn: async (payload: typeof movementForm) => {
      return await createInventoryMovement(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['inventoryMovements'] });
      setIsMovementModalOpen(false);
    }
  });

  const handleMovementSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    movementMutation.mutate(movementForm);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Control de Inventario</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Existencias reales, reservas comprometidas y kardex de movimientos auditables.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsMovementModalOpen(true)}
            className="inline-flex items-center gap-2 bg-sky-600 hover:bg-sky-500 text-white px-3.5 py-2 rounded-lg text-xs font-semibold shadow-xs transition-colors"
          >
            <Sliders className="w-4 h-4" />
            <span>Registrar Movimiento</span>
          </button>
        </div>
      </div>

      {/* Tabs and Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('stock')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              activeTab === 'stock'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Existencias & Alertas
          </button>
          <button
            onClick={() => setActiveTab('movements')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              activeTab === 'movements'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Kardex de Movimientos
          </button>
        </div>

        {activeTab === 'stock' && (
          <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={lowStockFilter}
              onChange={(e) => setLowStockFilter(e.target.checked)}
              className="rounded text-sky-600 focus:ring-0"
            />
            <span className="font-medium text-rose-600">Mostrar solo productos con stock bajo</span>
          </label>
        )}
      </div>

      {/* View 1: Stock table */}
      {activeTab === 'stock' && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[650px]">
              <thead>
                <tr className="bg-slate-50/70 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">SKU</th>
                  <th className="py-3 px-4">Producto & Categoría</th>
                  <th className="py-3 px-4 text-center">Físico</th>
                  <th className="py-3 px-4 text-center">Reservado</th>
                  <th className="py-3 px-4 text-center">Disponible</th>
                  <th className="py-3 px-4 text-center">Alerta Mínima</th>
                  <th className="py-3 px-4 text-right">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {isLoadingInv ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-slate-400">Cargando existencias...</td>
                  </tr>
                ) : inventory.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-slate-400">No hay registros de inventario.</td>
                  </tr>
                ) : (
                  inventory.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 font-mono font-semibold text-slate-700">{item.sku}</td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">{item.product_name}</div>
                        <div className="text-[11px] text-slate-400">{item.category_name}</div>
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-medium text-slate-800">{item.physical_stock}</td>
                      <td className="py-3 px-4 text-center font-mono text-amber-600 font-medium">{item.reserved_stock}</td>
                      <td className="py-3 px-4 text-center font-mono font-bold text-slate-900">{item.available_stock}</td>
                      <td className="py-3 px-4 text-center font-mono text-slate-400">{item.min_stock_alert}</td>
                      <td className="py-3 px-4 text-right">
                        {item.is_low_stock ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            <AlertTriangle className="w-3 h-3" />
                            <span>Stock Crítico</span>
                          </span>
                        ) : (
                          <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Óptimo
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* View 2: Movements Kardex */}
      {activeTab === 'movements' && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
          {/* Filtro por local (Todos los locales / sede específica) */}
          <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-slate-200 bg-slate-50/60">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Local:</span>
            <select
              value={localFiltro}
              onChange={(e) => setLocalFiltro(e.target.value)}
              className="text-xs bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-slate-700 focus:outline-none focus:border-sky-500 cursor-pointer"
            >
              <option value="">Todos los locales</option>
              {localesActivos.map((l) => (
                <option key={l.id} value={l.id}>{l.nombre} ({l.codigo})</option>
              ))}
            </select>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[820px]">
              <thead>
                <tr className="bg-slate-50/70 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Fecha</th>
                  <th className="py-3 px-4">Tipo Movimiento</th>
                  <th className="py-3 px-4">Producto</th>
                  <th className="py-3 px-4">Local</th>
                  <th className="py-3 px-4 text-center">Cantidad</th>
                  <th className="py-3 px-4 text-center">Stock Previo</th>
                  <th className="py-3 px-4 text-center">Stock Resultante</th>
                  <th className="py-3 px-4">Referencia / Motivo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {isLoadingMov ? (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-slate-400">Cargando kardex...</td>
                  </tr>
                ) : movements.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-slate-400">Sin movimientos registrados.</td>
                  </tr>
                ) : (
                  movements.map((mov) => (
                    <tr key={mov.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                        {new Date(mov.created_at).toLocaleString()}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${
                          mov.movement_type === 'ENTRY'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : mov.movement_type === 'EXIT'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : mov.movement_type === 'RESERVE'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-blue-50 text-blue-700 border border-blue-200'
                        }`}>
                          {mov.movement_type}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">{mov.product_name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">SKU: {mov.product_sku}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-xs text-slate-500 font-medium">{nombreDe(mov.local_id)}</span>
                      </td>
                      <td className="py-3 px-4 text-center font-bold font-mono">
                        {mov.movement_type === 'EXIT' ? `-${mov.quantity}` : `+${mov.quantity}`}
                      </td>
                      <td className="py-3 px-4 text-center font-mono text-slate-500">{mov.previous_stock}</td>
                      <td className="py-3 px-4 text-center font-mono font-bold text-slate-800">{mov.resulting_stock}</td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-700">{mov.reference_doc || '—'}</div>
                        <div className="text-[11px] text-slate-400">{mov.reason}</div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Registrar Movimiento */}
      {isMovementModalOpen && (
        <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-md w-full p-4 sm:p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto my-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="font-bold text-slate-900 text-sm">Registrar Movimiento de Inventario</h3>
              <button onClick={() => setIsMovementModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleMovementSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Producto</label>
                <select
                  value={movementForm.product_id}
                  onChange={(e) => setMovementForm({ ...movementForm, product_id: Number(e.target.value) })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 focus:outline-none focus:border-sky-500"
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Tipo de Movimiento</label>
                  <select
                    value={movementForm.movement_type}
                    onChange={(e: any) => setMovementForm({ ...movementForm, movement_type: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 focus:outline-none focus:border-sky-500"
                  >
                    <option value="ENTRY">ENTRADA (Compra / Carga)</option>
                    <option value="EXIT">SALIDA (Merma / Despacho)</option>
                    <option value="ADJUSTMENT">AJUSTE (Conteo Físico)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Cantidad / Valor</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={movementForm.quantity}
                    onChange={(e) => setMovementForm({ ...movementForm, quantity: parseInt(e.target.value) || 1 })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Documento de Referencia</label>
                <input
                  type="text"
                  required
                  value={movementForm.reference_doc}
                  onChange={(e) => setMovementForm({ ...movementForm, reference_doc: e.target.value })}
                  placeholder="Guía, Factura de compra, o ID de conteo"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Motivo / Justificación</label>
                <textarea
                  rows={2}
                  required
                  value={movementForm.reason}
                  onChange={(e) => setMovementForm({ ...movementForm, reason: e.target.value })}
                  placeholder="Explicación detallada del movimiento para auditoría"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsMovementModalOpen(false)}
                  className="px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 font-semibold text-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={movementMutation.isPending}
                  className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 font-semibold text-white shadow-xs"
                >
                  {movementMutation.isPending ? 'Guardando...' : 'Aplicar Movimiento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
