import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CreditCard, Plus, DollarSign, Search, CheckCircle2, X, AlertTriangle } from 'lucide-react';
import { getSales, getPaymentMethods, createPayment } from '../../services/mockDataService';
import { ScrollableDropdown } from '../sales/components/ScrollableDropdown';
import { Payment, PaymentMethod, Sale } from '../../types';

export const PaymentsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);

  // Form state
  const [selectedSaleId, setSelectedSaleId] = useState<number>(1);
  const [paymentMethodId, setPaymentMethodId] = useState<number>(1);
  const [amount, setAmount] = useState<number>(100);
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('Cobro procesado en caja');

  // Queries
  const { data: sales = [] } = useQuery<Sale[]>({
    queryKey: ['sales'],
    queryFn: async () => await getSales()
  });

  const { data: paymentMethods = [] } = useQuery<PaymentMethod[]>({
    queryKey: ['paymentMethods'],
    queryFn: async () => await getPaymentMethods()
  });

  // Sales with pending balance
  const pendingSales = sales.filter((s) => Number(s.pending_balance) > 0 && s.status === 'CONFIRMED');

  const selectedSaleObj = sales.find((s) => s.id === selectedSaleId);

  // Mutation
  const registerMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        sale_id: selectedSaleId,
        payment_method_id: paymentMethodId,
        amount,
        reference,
        notes
      };
      return await createPayment(payload);
    },
    onSuccess: (pay) => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardSummary'] });
      setIsRegisterModalOpen(false);
      setReference('');
      setAviso({ tipo: 'ok', texto: `Cobro de $${Number(pay.amount).toFixed(2)} registrado (${pay.payment_method_name}). La venta actualizó su saldo y estado de cobro.` });
    },
    onError: (e: any) => setAviso({ tipo: 'error', texto: e?.message || 'Error al registrar el cobro.' })
  });

  // Amortización Total rápida: elige el método de pago en el desplegable de la
  // fila y el saldo completo se amortiza al instante con ese medio.
  const amortizarMutation = useMutation({
    mutationFn: (p: { venta: Sale; methodId: number }) => {
      const metodo = paymentMethods.find(m => m.id === p.methodId);
      return createPayment({
        sale_id: p.venta.id,
        payment_method_id: p.methodId,
        amount: Number(p.venta.pending_balance),
        reference: `AMORTIZACION_TOTAL_${(metodo?.name || 'CAJA').toUpperCase().replace(/[^A-Z0-9]+/g, '_')}`,
        notes: `Amortización total del saldo vía ${metodo?.name || 'caja'} (cobranza rápida)`
      });
    },
    onSuccess: (pay) => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardSummary'] });
      setAviso({ tipo: 'ok', texto: `Venta ${pay.sale_code} amortizada por completo ($${Number(pay.amount).toFixed(2)}) vía ${pay.payment_method_name}. Estado: PAID.` });
    },
    onError: (e: any) => setAviso({ tipo: 'error', texto: e?.message || 'Error al amortizar el saldo.' })
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Gestión de Cobranzas & Pagos</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Registro de cobros recibidos, amortizaciones y saldos pendientes por venta.
          </p>
        </div>
        <button
          onClick={() => {
            if (pendingSales.length > 0) {
              setSelectedSaleId(pendingSales[0].id);
              setAmount(Number(pendingSales[0].pending_balance));
            }
            setIsRegisterModalOpen(true);
          }}
          disabled={pendingSales.length === 0}
          className="inline-flex items-center gap-2 bg-sky-600 hover:bg-sky-500 text-white px-3.5 py-2 rounded-lg text-xs font-semibold shadow-xs transition-colors disabled:opacity-50"
        >
          <Plus className="w-4 h-4" />
          <span>Registrar Cobro</span>
        </button>
      </div>

      {/* Aviso de operación de cobranza (éxito o error de regla de negocio) */}
      {aviso && (
        <div className={`flex items-start gap-2 p-3 rounded-xl border text-xs ${
          aviso.tipo === 'ok'
            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
            : 'bg-rose-50 text-rose-700 border-rose-200'
        }`}>
          {aviso.tipo === 'ok'
            ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
            : <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />}
          <span className="flex-1">{aviso.texto}</span>
          <button onClick={() => setAviso(null)} className="shrink-0 opacity-60 hover:opacity-100">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Pending balance banner */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Ventas con Saldo Pendiente</p>
          <h3 className="text-2xl font-bold text-slate-900 mt-1">{pendingSales.length} operaciones</h3>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Métodos de Cobro Habilitados</p>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            {paymentMethods.map((m) => (
              <span key={m.id} className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                {m.name}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* List of pending sales needing payment */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/60 font-semibold text-xs text-slate-800">
          Estado de Cartera de Ventas
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4">Código</th>
                <th className="py-3 px-4">Cliente</th>
                <th className="py-3 px-4 text-right">Total Facturado</th>
                <th className="py-3 px-4 text-right">Cobrado</th>
                <th className="py-3 px-4 text-right">Saldo Pendiente</th>
                <th className="py-3 px-4 text-center">Estado</th>
                <th className="py-3 px-4 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {sales.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-3 px-4 font-mono font-bold text-slate-900">{s.sale_code}</td>
                  <td className="py-3 px-4 font-semibold text-slate-800">{s.customer_name}</td>
                  <td className="py-3 px-4 text-right font-mono font-medium">${Number(s.total_amount).toFixed(2)}</td>
                  <td className="py-3 px-4 text-right font-mono text-emerald-600 font-semibold">${Number(s.paid_amount).toFixed(2)}</td>
                  <td className="py-3 px-4 text-right font-mono text-rose-600 font-bold">${Number(s.pending_balance).toFixed(2)}</td>
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
                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    {Number(s.pending_balance) > 0 && s.status === 'CONFIRMED' && (
                      <>
                        <div className="inline-block w-32 align-middle">
                          <ScrollableDropdown
                            value=""
                            onSelect={(v) => amortizarMutation.mutate({ venta: s, methodId: Number(v) })}
                            searchable={false}
                            placeholder="Amortizar Total…"
                            options={paymentMethods.map((m) => ({
                              value: m.id,
                              label: m.name,
                              description: `Saldo completo: $${Number(s.pending_balance).toFixed(2)}`,
                            }))}
                          />
                        </div>
                        <button
                          onClick={() => {
                            setSelectedSaleId(s.id);
                            setAmount(Number(s.pending_balance));
                            setIsRegisterModalOpen(true);
                          }}
                          className="text-sky-600 hover:text-sky-700 font-semibold text-xs px-2 py-1 rounded bg-sky-50 ml-1"
                          title="Registrar un cobro parcial o total con método y referencia"
                        >
                          Cobro Parcial
                        </button>
                      </>
                    )}
                    {Number(s.pending_balance) <= 0 && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600">
                        <CheckCircle2 className="w-3 h-3" /> LIQUIDADA
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Registrar Cobro */}
      {isRegisterModalOpen && (
        <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-md w-full p-4 sm:p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto my-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="font-bold text-slate-900 text-sm">Registrar Cobro en Caja</h3>
              <button onClick={() => setIsRegisterModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                registerMutation.mutate();
              }}
              className="space-y-3.5 text-xs"
            >
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Venta Asociada</label>
                <select
                  value={selectedSaleId}
                  onChange={(e) => {
                    const sid = Number(e.target.value);
                    setSelectedSaleId(sid);
                    const s = sales.find((x) => x.id === sid);
                    if (s) setAmount(Number(s.pending_balance));
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 focus:outline-none focus:border-sky-500"
                >
                  {pendingSales.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.sale_code} - {s.customer_name} (Saldo: ${Number(s.pending_balance).toFixed(2)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Método de Pago</label>
                  <select
                    value={paymentMethodId}
                    onChange={(e) => setPaymentMethodId(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 focus:outline-none focus:border-sky-500"
                  >
                    {paymentMethods.map((m) => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Importe a Cobrar ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={selectedSaleObj ? Number(selectedSaleObj.pending_balance) : undefined}
                    required
                    value={amount}
                    onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Referencia / Nro. Operación</label>
                <input
                  type="text"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="Voucher o Nro. de Transferencia bancaria"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Observaciones</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsRegisterModalOpen(false)}
                  className="px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 font-semibold text-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={registerMutation.isPending}
                  className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 font-semibold text-white shadow-xs"
                >
                  {registerMutation.isPending ? 'Procesando...' : 'Registrar Cobro'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
