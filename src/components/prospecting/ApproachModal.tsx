import React, { useState } from 'react';
import { X, Copy, Check, Sparkles, Send, ShieldCheck } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  companyName: string;
  approach: {
    subject: string;
    opening: string;
    message: string;
    cta: string;
  } | null;
}

export function ApproachModal({ isOpen, onClose, companyName, approach }: Props) {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !approach) return null;

  const fullText = `Assunto: ${approach.subject}\n\n${approach.opening}\n\n${approach.message}\n\n${approach.cta}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-indigo-50/50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg text-white flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">Sugestão de Abordagem Comercial</h3>
              <p className="text-xs text-slate-500">Para {companyName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-xs space-y-3 font-sans leading-relaxed text-slate-700">
            <div>
              <span className="font-semibold text-slate-900">Assunto: </span>
              {approach.subject}
            </div>

            <div className="border-t border-slate-200 pt-3">
              <p className="font-medium">{approach.opening}</p>
            </div>

            <div>
              <p>{approach.message}</p>
            </div>

            <div className="font-medium text-slate-800">
              <p>{approach.cta}</p>
            </div>
          </div>

          {/* Compliance Badge */}
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-[11px] text-emerald-800 flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
            <span>
              <strong>Abordagem Ética:</strong> Esta sugestão não realiza envios automáticos e não finge relacionamento prévio. Você pode copiar, personalizar e enviar pelo seu canal comercial preferido.
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
          >
            Fechar
          </button>
          <button
            onClick={handleCopy}
            className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-emerald-300" />
                Copiado!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                Copiar Abordagem
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
