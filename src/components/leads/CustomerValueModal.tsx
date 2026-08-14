import React, { useState } from 'react';
import { CheckCircle2, DollarSign } from 'lucide-react';

interface Props {
  isOpen: boolean;
  leadName: string;
  initialPotentialValue?: number | null;
  onClose: () => void;
  onConfirm: (actualValue: number | null) => void;
}

export function CustomerValueModal({ isOpen, leadName, initialPotentialValue, onClose, onConfirm }: Props) {
  const [actualValue, setActualValue] = useState<string>(
    initialPotentialValue ? initialPotentialValue.toString() : ''
  );

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = actualValue.trim() !== '' ? parseFloat(actualValue) : null;
    onConfirm(val);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95">
        <div className="p-6">
          <div className="flex items-center gap-3 text-emerald-600 mb-4">
            <div className="p-2.5 bg-emerald-50 rounded-xl">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Lead Convertido em Cliente! 🎉</h3>
              <p className="text-xs text-slate-500">{leadName}</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-sm text-slate-600">
              Parabéns pela venda! Qual foi o valor final do negócio fechado?
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Valor Real da Venda (R$)
              </label>
              <div className="relative">
                <DollarSign className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="number"
                  step="0.01"
                  value={actualValue}
                  onChange={(e) => setActualValue(e.target.value)}
                  placeholder="Ex: 12000"
                  className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  autoFocus
                />
              </div>
            </div>

            <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg"
              >
                Pular
              </button>
              <button
                type="submit"
                className="px-5 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm"
              >
                Confirmar Conversão
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
