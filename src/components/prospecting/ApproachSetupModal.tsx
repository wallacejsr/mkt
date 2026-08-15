import React, { useEffect, useState } from 'react';
import { Mail, MessageCircle, Linkedin, Sparkles, X } from 'lucide-react';

export type ApproachChannel = 'email' | 'whatsapp' | 'linkedin';
export type ApproachObjective = 'present_platform' | 'advertise_products' | 'partnership' | 'schedule_meeting';

export interface ApproachOptions {
  channel: ApproachChannel;
  objective: ApproachObjective;
  senderName: string;
  commercialName: string;
  offerProduct: string;
}

interface Props {
  isOpen: boolean;
  companyName: string;
  defaultSenderName: string;
  defaultCommercialName: string;
  generating: boolean;
  onClose: () => void;
  onGenerate: (options: ApproachOptions) => Promise<void>;
}

const channels: { value: ApproachChannel; label: string; icon: React.ReactNode }[] = [
  { value: 'whatsapp', label: 'WhatsApp', icon: <MessageCircle className="h-4 w-4" /> },
  { value: 'email', label: 'E-mail', icon: <Mail className="h-4 w-4" /> },
  { value: 'linkedin', label: 'LinkedIn', icon: <Linkedin className="h-4 w-4" /> },
];

export function ApproachSetupModal(props: Props) {
  const [options, setOptions] = useState<ApproachOptions>({
    channel: 'whatsapp', objective: 'present_platform', senderName: '', commercialName: '', offerProduct: '',
  });

  useEffect(() => {
    if (!props.isOpen) return;
    setOptions(current => ({
      ...current,
      senderName: localStorage.getItem('prospecting_sender_name') || props.defaultSenderName,
      commercialName: localStorage.getItem('prospecting_commercial_name') || props.defaultCommercialName,
    }));
  }, [props.isOpen, props.defaultSenderName, props.defaultCommercialName]);

  if (!props.isOpen) return null;

  const generate = async () => {
    if (!options.senderName.trim() || !options.commercialName.trim()) return;
    localStorage.setItem('prospecting_sender_name', options.senderName.trim());
    localStorage.setItem('prospecting_commercial_name', options.commercialName.trim());
    await props.onGenerate({ ...options, senderName: options.senderName.trim(), commercialName: options.commercialName.trim() });
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/55 p-4">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Criar abordagem</h2>
            <p className="mt-0.5 text-xs text-slate-500">Personalize a mensagem para {props.companyName}</p>
          </div>
          <button onClick={props.onClose} disabled={props.generating} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button>
        </div>

        <div className="space-y-5 p-6">
          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">Canal</label>
            <div className="grid grid-cols-3 gap-2">
              {channels.map(channel => (
                <button key={channel.value} onClick={() => setOptions(current => ({ ...current, channel: channel.value }))}
                  className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-xs font-semibold ${options.channel === channel.value ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                  {channel.icon}{channel.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-bold text-slate-700">Objetivo da conversa</label>
            <select value={options.objective} onChange={event => setOptions(current => ({ ...current, objective: event.target.value as ApproachObjective }))}
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-500">
              <option value="present_platform">Apresentar a plataforma</option>
              <option value="advertise_products">Convidar para anunciar produtos</option>
              <option value="partnership">Propor uma parceria</option>
              <option value="schedule_meeting">Agendar uma reunião</option>
            </select>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="text-xs font-bold text-slate-700">Seu nome
              <input value={options.senderName} onChange={event => setOptions(current => ({ ...current, senderName: event.target.value }))} placeholder="Ex.: Wallace"
                className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal outline-none focus:border-indigo-500" />
            </label>
            <label className="text-xs font-bold text-slate-700">Nome comercial
              <input value={options.commercialName} onChange={event => setOptions(current => ({ ...current, commercialName: event.target.value }))} placeholder="Ex.: AGRO BW"
                className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal outline-none focus:border-indigo-500" />
            </label>
          </div>

          <label className="block text-xs font-bold text-slate-700">Oferta ou produto em destaque <span className="font-normal text-slate-400">(opcional)</span>
            <input value={options.offerProduct} onChange={event => setOptions(current => ({ ...current, offerProduct: event.target.value }))} placeholder="Ex.: divulgação de máquinas, insumos e serviços"
              className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal outline-none focus:border-indigo-500" />
          </label>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 px-6 py-4">
          <button onClick={props.onClose} disabled={props.generating} className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600">Cancelar</button>
          <button onClick={generate} disabled={props.generating || !options.senderName.trim() || !options.commercialName.trim()}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">
            <Sparkles className={`h-4 w-4 ${props.generating ? 'animate-pulse' : ''}`} />{props.generating ? 'Gerando...' : 'Gerar abordagem'}
          </button>
        </div>
      </div>
    </div>
  );
}
