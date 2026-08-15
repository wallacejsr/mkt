import React, { useEffect, useState } from 'react';
import { X, Copy, Check, Sparkles, ShieldCheck, RefreshCw, Bot, FileText, Pencil } from 'lucide-react';

interface Approach {
  subject: string;
  opening: string;
  message: string;
  cta: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  companyName: string;
  approach: Approach | null;
  source?: string;
  channel?: string;
  onRegenerate?: () => Promise<void>;
}

const channelLabels: Record<string, string> = { email: 'E-mail', whatsapp: 'WhatsApp', linkedin: 'LinkedIn' };

export function ApproachModal({ isOpen, onClose, companyName, approach, source = 'template', channel = 'email', onRegenerate }: Props) {
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [draft, setDraft] = useState<Approach | null>(approach);

  useEffect(() => setDraft(approach), [approach]);

  if (!isOpen || !draft) return null;

  const fullText = [
    channel === 'email' && draft.subject ? `Assunto: ${draft.subject}` : '',
    draft.opening,
    draft.message,
    draft.cta,
  ].filter(Boolean).join('\n\n');

  const handleCopy = async () => {
    await navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const regenerate = async () => {
    if (!onRegenerate) return;
    setRegenerating(true);
    try { await onRegenerate(); } finally { setRegenerating(false); }
  };

  const update = (field: keyof Approach, value: string) => setDraft(current => current ? { ...current, [field]: value } : current);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 bg-indigo-50/50 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white"><Sparkles className="h-4 w-4" /></div>
            <div>
              <h3 className="text-base font-bold text-slate-800">Sugestão de Abordagem Comercial</h3>
              <p className="text-xs text-slate-500">Para {companyName} · {channelLabels[channel] || channel}</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"><X className="h-5 w-5" /></button>
        </div>

        <div className="space-y-4 p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${source === 'gemini' ? 'bg-violet-100 text-violet-700' : 'bg-amber-100 text-amber-700'}`}>
              {source === 'gemini' ? <Bot className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}
              {source === 'gemini' ? 'Gerado por IA' : 'Modelo padrão personalizado'}
            </div>
            <span className="flex items-center gap-1 text-[11px] text-slate-400"><Pencil className="h-3 w-3" />Todos os campos podem ser editados</span>
          </div>

          <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            {channel === 'email' && (
              <label className="block text-xs font-bold text-slate-700">Assunto
                <input value={draft.subject} onChange={event => update('subject', event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal outline-none focus:border-indigo-500" />
              </label>
            )}
            <label className="block text-xs font-bold text-slate-700">Abertura
              <textarea value={draft.opening} onChange={event => update('opening', event.target.value)} rows={2} className="mt-1.5 w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal leading-relaxed outline-none focus:border-indigo-500" />
            </label>
            <label className="block text-xs font-bold text-slate-700">Mensagem
              <textarea value={draft.message} onChange={event => update('message', event.target.value)} rows={6} className="mt-1.5 w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal leading-relaxed outline-none focus:border-indigo-500" />
            </label>
            <label className="block text-xs font-bold text-slate-700">Chamada para ação
              <textarea value={draft.cta} onChange={event => update('cta', event.target.value)} rows={2} className="mt-1.5 w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal leading-relaxed outline-none focus:border-indigo-500" />
            </label>
          </div>

          <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-[11px] text-emerald-800">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            <span><strong>Abordagem ética:</strong> nenhuma mensagem é enviada automaticamente. Revise e personalize antes de usar no canal escolhido.</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/50 px-6 py-4">
          <button onClick={regenerate} disabled={!onRegenerate || regenerating} className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 text-indigo-600 ${regenerating ? 'animate-spin' : ''}`} />{regenerating ? 'Gerando novamente...' : 'Gerar outra versão'}
          </button>
          <div className="flex gap-2">
            <button onClick={onClose} className="rounded-lg px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100">Fechar</button>
            <button onClick={handleCopy} className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700">
              {copied ? <><Check className="h-4 w-4 text-emerald-300" />Copiado!</> : <><Copy className="h-4 w-4" />Copiar para {channelLabels[channel] || 'canal'}</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
