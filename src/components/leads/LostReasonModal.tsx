import React, { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface Props {
  isOpen: boolean;
  leadName: string;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}

const LOST_REASONS = [
  'Preço',
  'Sem interesse',
  'Concorrente',
  'Sem resposta',
  'Momento inadequado',
  'Produto não adequado',
  'Outro',
];

export function LostReasonModal({ isOpen, leadName, onClose, onConfirm }: Props) {
  const [selectedReason, setSelectedReason] = useState('Sem interesse');
  const [customReason, setCustomReason] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalReason = selectedReason === 'Outro' && customReason.trim()
      ? `Outro: ${customReason.trim()}`
      : selectedReason;
    onConfirm(finalReason);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95">
        <div className="p-6">
          <div className="flex items-center gap-3 text-amber-600 mb-4">
            <div className="p-2.5 bg-amber-50 rounded-xl">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Por que este lead foi perdido?</h3>
              <p className="text-xs text-slate-500">{leadName}</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              {LOST_REASONS.map((reason) => (
                <label
                  key={reason}
                  className={`flex items-center p-3 rounded-xl border cursor-pointer transition-colors ${
                    selectedReason === reason
                      ? 'border-indigo-600 bg-indigo-50/50 text-indigo-900 font-medium'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <input
                    type="radio"
                    name="lostReason"
                    value={reason}
                    checked={selectedReason === reason}
                    onChange={() => setSelectedReason(reason)}
                    className="text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                  />
                  <span className="ml-3 text-sm">{reason}</span>
                </label>
              ))}
            </div>

            {selectedReason === 'Outro' && (
              <div>
                <input
                  type="text"
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  placeholder="Especifique o motivo..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>
            )}

            <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-5 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-sm"
              >
                Marcar como Perdido
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
