import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, CheckCircle2, Copy, Globe2, Loader2, Mail, Pause, Play, Plus, RefreshCw, Send,
  ShieldCheck, Sparkles, X,
} from 'lucide-react';
import { useAuth } from '../../lib/auth-context';

type DnsRecord = { record: string; name: string; type: string; value: string; status: string; priority?: number };
type DomainConfig = {
  id: string; domain: string; region: string; status: string; dnsRecords: DnsRecord[];
  spfStatus: string; dkimStatus: string; dmarcStatus: string; dmarcRecord?: string | null;
};
type ProviderStatus = { apiConfigured: boolean; webhookConfigured?: boolean; configured: boolean; missingVariables: string[]; fromAddress?: string | null };
type Campaign = {
  id: string; name: string; status: string; subject: string; senderName: string; senderEmail: string;
  totalRecipients: number; queuedCount: number; sentCount: number; deliveredCount: number; openedCount: number;
  clickedCount: number; bouncedCount: number; complainedCount: number; unsubscribedCount: number; failedCount: number; createdAt: string;
  sendRatePerMinute?: number; dailyLimit?: number; batchSize?: number; scheduledAt?: string | null; startedAt?: string | null;
};
type AudienceFilters = { origin: 'all' | 'search' | 'spreadsheet'; status: string; fit: string; state: string; segment: string };
type AudiencePreview = { totalWithEmail: number; invalidCount: number; duplicateCount: number; suppressedCount: number; eligibleCount: number };
type WorkerStatus = {
  configured: boolean; status: string; lastStartedAt?: string | null; lastCompletedAt?: string | null;
  lastError?: string | null; activeCampaigns: number; pendingRecipients: number;
};

const initialFilters: AudienceFilters = { origin: 'all', status: 'all', fit: 'all', state: '', segment: '' };
const initialPreview: AudiencePreview = { totalWithEmail: 0, invalidCount: 0, duplicateCount: 0, suppressedCount: 0, eligibleCount: 0 };
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function statusLabel(status?: string) {
  const labels: Record<string, string> = {
    verified: 'Verificado', pending: 'Verificando', not_started: 'Não iniciado', failed: 'Falhou',
    temporary_failure: 'Falha temporária', partially_verified: 'Parcialmente verificado', missing: 'Ausente',
    lookup_failed: 'Falha na consulta', draft: 'Rascunho', queued: 'Na fila', sending: 'Enviando',
    paused: 'Pausada', completed: 'Concluída', cancelled: 'Cancelada', scheduled: 'Agendada',
    running: 'Executando', partial_failure: 'Concluído com alertas', never_run: 'Aguardando primeira execução',
  };
  return labels[status || ''] || status || 'Não informado';
}

function StatusPill({ status }: { status?: string }) {
  const success = ['verified', 'completed'].includes(status || '');
  const warning = ['pending', 'not_started', 'missing', 'partially_verified', 'draft', 'paused'].includes(status || '');
  const active = ['queued', 'sending', 'scheduled'].includes(status || '');
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-bold ${success ? 'bg-emerald-50 text-emerald-700' : active ? 'bg-indigo-50 text-indigo-700' : warning ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700'}`}>
    {success ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}{statusLabel(status)}
  </span>;
}

export function EmailCampaignWorkspace() {
  const { authFetch, business, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [provider, setProvider] = useState<ProviderStatus | null>(null);
  const [domain, setDomain] = useState<DomainConfig | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [worker, setWorker] = useState<WorkerStatus | null>(null);
  const [domainName, setDomainName] = useState('');
  const [domainBusy, setDomainBusy] = useState(false);
  const [domainError, setDomainError] = useState('');
  const [copiedRecord, setCopiedRecord] = useState('');
  const [builderOpen, setBuilderOpen] = useState(false);
  const [startCampaign, setStartCampaign] = useState<Campaign | null>(null);
  const [dispatchError, setDispatchError] = useState('');
  const dispatchingRef = useRef(false);
  const nextDispatchDelayRef = useRef(1000);

  const load = async (silent = false) => {
    if (!business?.id) return;
    if (!silent) setLoading(true);
    try {
      const [domainResponse, campaignsResponse, workerResponse] = await Promise.all([
        authFetch(`/api/prospecting/email/domain?businessId=${business.id}`),
        authFetch(`/api/prospecting/email/campaigns?businessId=${business.id}`),
        authFetch(`/api/prospecting/email/worker/status?businessId=${business.id}`),
      ]);
      const domainData = await domainResponse.json().catch(() => ({}));
      const campaignsData = await campaignsResponse.json().catch(() => ({}));
      const workerData = await workerResponse.json().catch(() => ({}));
      if (domainResponse.ok) {
        setDomain(domainData.domain || null);
        setProvider(domainData.provider || null);
      }
      if (campaignsResponse.ok) setCampaigns(campaignsData.campaigns || []);
      if (workerResponse.ok) setWorker(workerData);
    } finally { if (!silent) setLoading(false); }
  };

  useEffect(() => { load(); }, [business?.id]);

  useEffect(() => {
    if (!business?.id) return;
    const timer = window.setInterval(() => load(true), 20000);
    return () => window.clearInterval(timer);
  }, [business?.id]);

  useEffect(() => {
    const active = campaigns.find(campaign => ['queued', 'sending', 'scheduled'].includes(campaign.status));
    if (!active || !business?.id) return;
    const timer = window.setTimeout(async () => {
      if (dispatchingRef.current) return;
      dispatchingRef.current = true;
      try {
        const response = await authFetch(`/api/prospecting/email/campaigns/${active.id}/process?businessId=${business.id}`, { method: 'POST' });
        const data = await response.json().catch(() => ({}));
        nextDispatchDelayRef.current = response.ok ? Math.min(60000, Math.max(2000, Number(data.nextAttemptMs || 3000))) : 10000;
        setDispatchError(response.ok ? '' : (data.error || 'O lote não pôde ser processado.'));
        await load(true);
      } catch (error: any) {
        setDispatchError(error?.message || 'Falha de conexão ao processar o lote.');
        nextDispatchDelayRef.current = 10000;
      } finally { dispatchingRef.current = false; }
    }, nextDispatchDelayRef.current);
    return () => window.clearTimeout(timer);
  }, [campaigns, business?.id]);

  const campaignAction = async (campaign: Campaign, action: 'pause' | 'resume' | 'cancel') => {
    if (!business?.id) return;
    if (action === 'resume' && !window.confirm(`Retomar o envio da campanha “${campaign.name}”?`)) return;
    if (action === 'cancel' && !window.confirm(`Cancelar definitivamente a campanha “${campaign.name}”? Os e-mails já enviados não podem ser recuperados.`)) return;
    const confirmation = action === 'resume' ? 'RETOMAR' : action === 'cancel' ? 'CANCELAR' : undefined;
    const response = await authFetch(`/api/prospecting/email/campaigns/${campaign.id}/${action}?businessId=${business.id}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ confirmation }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return window.alert(data.error || 'Não foi possível atualizar a campanha.');
    nextDispatchDelayRef.current = 1000;
    await load();
  };

  const createDomain = async () => {
    if (!business?.id || !domainName.trim()) return;
    setDomainBusy(true); setDomainError('');
    try {
      const response = await authFetch(`/api/prospecting/email/domain?businessId=${business.id}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: domainName.trim(), region: 'sa-east-1' }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Falha ao cadastrar o domínio.');
      setDomain(data.domain);
    } catch (error: any) { setDomainError(error.message); }
    finally { setDomainBusy(false); }
  };

  const verifyDomain = async () => {
    if (!business?.id || !domain) return;
    setDomainBusy(true); setDomainError('');
    try {
      const response = await authFetch(`/api/prospecting/email/domain/verify?businessId=${business.id}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ domainId: domain.id }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Falha ao verificar o domínio.');
      setDomain(data.domain);
    } catch (error: any) { setDomainError(error.message); }
    finally { setDomainBusy(false); }
  };

  const copyRecord = async (record: DnsRecord) => {
    await navigator.clipboard.writeText(record.value);
    setCopiedRecord(`${record.type}:${record.name}`);
    window.setTimeout(() => setCopiedRecord(''), 1500);
  };

  if (loading) return <div className="flex items-center justify-center rounded-2xl border border-slate-200 bg-white py-24 text-sm text-slate-500"><Loader2 className="mr-2 h-5 w-5 animate-spin" />Carregando campanhas de e-mail...</div>;

  return <div className="space-y-6">
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between"><span className="text-xs font-bold uppercase tracking-wide text-slate-500">Provedor</span><Mail className="h-4 w-4 text-indigo-500" /></div>
        <p className="font-bold text-slate-900">Resend</p>
        <p className="mt-1 text-xs text-slate-500">{provider?.apiConfigured ? 'Chave de envio configurada' : 'Pendente: RESEND_API_KEY'}</p>
        <p className={`mt-1 text-xs ${provider?.webhookConfigured ? 'text-emerald-600' : 'text-amber-600'}`}>{provider?.webhookConfigured ? 'Rastreamento de eventos ativo' : 'Pendente: RESEND_WEBHOOK_SECRET'}</p>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between"><span className="text-xs font-bold uppercase tracking-wide text-slate-500">Domínio</span><Globe2 className="h-4 w-4 text-indigo-500" /></div>
        <p className="truncate font-bold text-slate-900">{domain?.domain || 'Não cadastrado'}</p>
        <div className="mt-1"><StatusPill status={domain?.status || 'not_started'} /></div>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between"><span className="text-xs font-bold uppercase tracking-wide text-slate-500">Campanhas</span><Send className="h-4 w-4 text-indigo-500" /></div>
        <p className="text-2xl font-extrabold text-slate-900">{campaigns.length}</p>
        <p className="text-xs text-slate-500">Envio em lotes com pausa e limites</p>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between"><span className="text-xs font-bold uppercase tracking-wide text-slate-500">Worker</span><RefreshCw className={`h-4 w-4 ${worker?.status === 'running' ? 'animate-spin text-indigo-500' : 'text-indigo-500'}`} /></div>
        <p className="font-bold text-slate-900">{worker?.configured ? statusLabel(worker.status) : 'Não configurado'}</p>
        <p className="mt-1 text-xs text-slate-500">{Number(worker?.activeCampaigns || 0)} campanhas · {Number(worker?.pendingRecipients || 0).toLocaleString('pt-BR')} pendentes</p>
        {worker?.lastCompletedAt && <p className="mt-1 text-[10px] text-slate-400">Última execução: {new Date(worker.lastCompletedAt).toLocaleString('pt-BR')}</p>}
      </div>
    </div>

    {dispatchError && <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><div><strong>O envio está interrompido.</strong><p className="mt-0.5 text-xs">{dispatchError}</p></div></div>}

    {provider?.apiConfigured && !provider.webhookConfigured && <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <strong>Falta ativar o acompanhamento de resultados.</strong>
      <p className="mt-1 text-xs leading-relaxed">No Resend, crie um webhook apontando para <code className="rounded bg-white/70 px-1 py-0.5">{window.location.origin}/api/prospecting/email/webhooks/resend</code>, selecione os eventos de e-mail e salve o segredo como <code className="rounded bg-white/70 px-1 py-0.5">RESEND_WEBHOOK_SECRET</code> na Vercel.</p>
    </div>}

    {worker && !worker.configured && <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"><strong>Worker automático pendente.</strong><p className="mt-1 text-xs">Configure <code className="rounded bg-white/70 px-1 py-0.5">CRON_SECRET</code> com pelo menos 16 caracteres e agende uma chamada GET autenticada para <code className="rounded bg-white/70 px-1 py-0.5">/api/prospecting/email/worker</code>.</p></div>}
    {worker?.lastError && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"><strong>Última execução do worker com falha.</strong><p className="mt-1 text-xs">{worker.lastError}</p></div>}

    {!domain ? <section className="rounded-2xl border border-indigo-200 bg-white p-6 shadow-sm">
      <div className="flex items-start gap-4">
        <div className="rounded-xl bg-indigo-50 p-3 text-indigo-600"><ShieldCheck className="h-6 w-6" /></div>
        <div className="flex-1">
          <h2 className="font-bold text-slate-900">Configure um subdomínio de envio</h2>
          <p className="mt-1 text-sm text-slate-600">Use um endereço dedicado, como <strong>mail.seudominio.com.br</strong>. O sistema retornará os registros SPF e DKIM que devem ser adicionados no seu DNS.</p>
          <div className="mt-4 flex max-w-xl flex-col gap-2 sm:flex-row">
            <input value={domainName} onChange={event => setDomainName(event.target.value)} placeholder="mail.suaempresa.com.br" className="flex-1 rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-indigo-500" />
            <button onClick={createDomain} disabled={domainBusy || !domainName.trim()} className="flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">
              {domainBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe2 className="h-4 w-4" />}Cadastrar ou sincronizar
            </button>
          </div>
          {domainError && <p className="mt-3 text-sm font-medium text-rose-600">{domainError}</p>}
        </div>
      </div>
    </section> : <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div><h2 className="font-bold text-slate-900">Autenticação de {domain.domain}</h2><p className="mt-1 text-xs text-slate-500">Região São Paulo · copie os registros abaixo para o painel DNS do domínio.</p></div>
        <button onClick={verifyDomain} disabled={domainBusy} className="flex items-center justify-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2 text-xs font-bold text-indigo-700 disabled:opacity-50">
          <RefreshCw className={`h-4 w-4 ${domainBusy ? 'animate-spin' : ''}`} />Verificar registros
        </button>
      </div>
      {domainError && <p className="mt-3 text-sm font-medium text-rose-600">{domainError}</p>}
      <div className="mt-5 overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full min-w-[720px] text-left text-xs">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500"><tr><th className="p-3">Finalidade</th><th className="p-3">Tipo</th><th className="p-3">Nome</th><th className="p-3">Valor</th><th className="p-3">Status</th><th className="p-3"></th></tr></thead>
          <tbody className="divide-y divide-slate-100">{(domain.dnsRecords || []).map((record, index) => <tr key={`${record.type}-${record.name}-${index}`}>
            <td className="p-3 font-semibold text-slate-700">{record.record}</td><td className="p-3">{record.type}</td><td className="p-3 font-mono">{record.name}</td>
            <td className="max-w-[300px] truncate p-3 font-mono" title={record.value}>{record.value}</td><td className="p-3"><StatusPill status={record.status} /></td>
            <td className="p-3"><button onClick={() => copyRecord(record)} className="rounded p-1.5 text-slate-500 hover:bg-slate-100" title="Copiar valor"><Copy className="h-3.5 w-3.5" /></button>{copiedRecord === `${record.type}:${record.name}` && <span className="text-emerald-600">Copiado</span>}</td>
          </tr>)}</tbody>
        </table>
      </div>
      <div className="mt-4 flex flex-wrap gap-2"><span className="text-xs font-semibold text-slate-500">SPF</span><StatusPill status={domain.spfStatus} /><span className="ml-2 text-xs font-semibold text-slate-500">DKIM</span><StatusPill status={domain.dkimStatus} /><span className="ml-2 text-xs font-semibold text-slate-500">DMARC</span><StatusPill status={domain.dmarcStatus} /></div>
    </section>}

    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
        <div><h2 className="font-bold text-slate-900">Campanhas de prospecção</h2><p className="text-xs text-slate-500">Prepare a mensagem e a audiência antes de autorizar qualquer disparo.</p></div>
        <button onClick={() => setBuilderOpen(true)} disabled={!domain} className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"><Plus className="h-4 w-4" />Nova campanha</button>
      </div>
      {campaigns.length ? <div className="divide-y divide-slate-100">{campaigns.map(campaign => {
        const processed = Math.max(0, Number(campaign.totalRecipients || 0) - Number(campaign.queuedCount || 0));
        const progress = campaign.totalRecipients ? Math.min(100, Math.round(processed * 100 / campaign.totalRecipients)) : 0;
        const deliveryRate = campaign.sentCount ? Math.round(Number(campaign.deliveredCount || 0) * 100 / campaign.sentCount) : 0;
        const openRate = campaign.deliveredCount ? Math.round(Number(campaign.openedCount || 0) * 100 / campaign.deliveredCount) : 0;
        const clickRate = campaign.deliveredCount ? Math.round(Number(campaign.clickedCount || 0) * 100 / campaign.deliveredCount) : 0;
        const showResults = Boolean(campaign.startedAt || campaign.sentCount || campaign.failedCount);
        return <div key={campaign.id} className="px-6 py-4">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2"><h3 className="font-bold text-slate-900">{campaign.name}</h3><StatusPill status={campaign.status} /></div>
              <p className="mt-1 truncate text-sm text-slate-600">{campaign.subject}</p>
              <p className="mt-1 text-xs text-slate-400">{campaign.senderName} &lt;{campaign.senderEmail}&gt; · {new Date(campaign.createdAt).toLocaleDateString('pt-BR')}</p>
              {showResults && <div className="mt-3 max-w-xl"><div className="mb-1 flex justify-between text-[11px] text-slate-500"><span>{Number(campaign.sentCount || 0).toLocaleString('pt-BR')} enviados · {Number(campaign.failedCount || 0).toLocaleString('pt-BR')} falhas</span><span>{progress}%</span></div><div className="h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-indigo-600 transition-all" style={{ width: `${progress}%` }} /></div></div>}
              {showResults && <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                <CampaignMetric label="Entregues" value={campaign.deliveredCount} rate={deliveryRate} />
                <CampaignMetric label="Aberturas" value={campaign.openedCount} rate={openRate} />
                <CampaignMetric label="Cliques" value={campaign.clickedCount} rate={clickRate} />
                <CampaignMetric label="Bounces" value={campaign.bouncedCount} danger />
                <CampaignMetric label="Spam" value={campaign.complainedCount} danger />
                <CampaignMetric label="Descadastros" value={campaign.unsubscribedCount} />
              </div>}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="mr-2 rounded-lg bg-slate-50 px-4 py-2 text-center"><strong className="block text-lg text-slate-900">{Number(campaign.totalRecipients || 0).toLocaleString('pt-BR')}</strong><span className="text-[11px] text-slate-500">destinatários</span></div>
              {campaign.status === 'draft' && <button onClick={() => setStartCampaign(campaign)} disabled={domain?.status !== 'verified' || !provider?.apiConfigured} className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-40"><Play className="h-3.5 w-3.5" />Iniciar</button>}
              {['queued', 'sending', 'scheduled'].includes(campaign.status) && <button onClick={() => campaignAction(campaign, 'pause')} className="flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700"><Pause className="h-3.5 w-3.5" />Pausar</button>}
              {campaign.status === 'paused' && <button onClick={() => campaignAction(campaign, 'resume')} className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white"><Play className="h-3.5 w-3.5" />Retomar</button>}
              {['draft', 'queued', 'sending', 'scheduled', 'paused'].includes(campaign.status) && <button onClick={() => campaignAction(campaign, 'cancel')} className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-bold text-rose-600">Cancelar</button>}
            </div>
          </div>
        </div>;
      })}</div> : <div className="px-6 py-14 text-center"><Mail className="mx-auto h-9 w-9 text-slate-300" /><p className="mt-3 font-semibold text-slate-700">Nenhuma campanha preparada</p><p className="mt-1 text-xs text-slate-500">Crie um rascunho para revisar a mensagem e a audiência.</p></div>}
    </section>

    {builderOpen && <EmailCampaignBuilder domain={domain!} defaultSenderName={user?.name || ''} onClose={() => setBuilderOpen(false)} onSaved={() => { setBuilderOpen(false); load(); }} />}
    {startCampaign && <StartCampaignModal campaign={startCampaign} onClose={() => setStartCampaign(null)} onStarted={() => { setStartCampaign(null); nextDispatchDelayRef.current = 1000; load(); }} />}
  </div>;
}

function CampaignMetric({ label, value, rate, danger = false }: { label: string; value?: number; rate?: number; danger?: boolean }) {
  return <div className={`rounded-lg border px-2.5 py-2 ${danger && Number(value || 0) > 0 ? 'border-rose-200 bg-rose-50' : 'border-slate-200 bg-slate-50'}`}>
    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
    <p className={`mt-0.5 text-sm font-extrabold ${danger && Number(value || 0) > 0 ? 'text-rose-700' : 'text-slate-800'}`}>{Number(value || 0).toLocaleString('pt-BR')}{rate !== undefined && <span className="ml-1 text-[10px] font-semibold text-slate-400">{rate}%</span>}</p>
  </div>;
}

function StartCampaignModal({ campaign, onClose, onStarted }: { campaign: Campaign; onClose: () => void; onStarted: () => void }) {
  const { authFetch, business } = useAuth();
  const [rate, setRate] = useState(campaign.sendRatePerMinute || 30);
  const [dailyLimit, setDailyLimit] = useState(campaign.dailyLimit || 500);
  const [batchSize, setBatchSize] = useState(campaign.batchSize || 10);
  const [scheduleMode, setScheduleMode] = useState<'now' | 'later'>('now');
  const [scheduledAt, setScheduledAt] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const start = async () => {
    if (!business?.id || !confirmed) return;
    setBusy(true); setError('');
    try {
      const schedule = scheduleMode === 'later' && scheduledAt ? new Date(scheduledAt) : null;
      if (schedule && schedule.getTime() <= Date.now() + 60000) throw new Error('Escolha um horário futuro com pelo menos um minuto de antecedência.');
      const response = await authFetch(`/api/prospecting/email/campaigns/${campaign.id}/start?businessId=${business.id}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmation: 'INICIAR', expectedRecipientCount: campaign.totalRecipients, sendRatePerMinute: rate, dailyLimit, batchSize, scheduledAt: schedule?.toISOString() || null }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Falha ao iniciar a campanha.');
      onStarted();
    } catch (error: any) { setError(error.message); }
    finally { setBusy(false); }
  };

  return <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/65 p-4"><div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
    <header className="flex items-center justify-between border-b border-slate-200 px-6 py-4"><div><h2 className="font-bold text-slate-900">Autorizar campanha</h2><p className="text-xs text-slate-500">{campaign.name}</p></div><button onClick={onClose} disabled={busy} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button></header>
    <div className="space-y-5 p-6">
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4"><div className="flex gap-3"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" /><div><p className="text-sm font-bold text-amber-900">Esta ação autoriza envios reais</p><p className="mt-1 text-xs leading-relaxed text-amber-800">A campanha possui <strong>{campaign.totalRecipients.toLocaleString('pt-BR')} destinatários</strong>. Você poderá pausar ou cancelar, mas mensagens já enviadas não podem ser recuperadas.</p></div></div></div>
      <div className="grid grid-cols-3 gap-3"><label className="text-xs font-bold text-slate-700">Por minuto<input type="number" min={1} max={100} value={rate} onChange={event => setRate(Number(event.target.value))} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal" /></label><label className="text-xs font-bold text-slate-700">Limite diário<input type="number" min={1} max={10000} value={dailyLimit} onChange={event => setDailyLimit(Number(event.target.value))} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal" /></label><label className="text-xs font-bold text-slate-700">Por lote<input type="number" min={1} max={25} value={batchSize} onChange={event => setBatchSize(Number(event.target.value))} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal" /></label></div>
      <div><p className="mb-2 text-xs font-bold text-slate-700">Quando iniciar?</p><div className="grid grid-cols-2 gap-2"><button onClick={() => setScheduleMode('now')} className={`rounded-lg border px-3 py-2 text-xs font-bold ${scheduleMode === 'now' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-600'}`}>Agora</button><button onClick={() => setScheduleMode('later')} className={`rounded-lg border px-3 py-2 text-xs font-bold ${scheduleMode === 'later' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-600'}`}>Agendar</button></div>{scheduleMode === 'later' && <input type="datetime-local" value={scheduledAt} onChange={event => setScheduledAt(event.target.value)} className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm" />}</div>
      <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-4 text-xs leading-relaxed text-slate-700"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} className="mt-0.5" /><span>Revisei remetente, assunto, conteúdo, audiência e base legal. Confirmo o início de até <strong>{campaign.totalRecipients.toLocaleString('pt-BR')} envios</strong> com os limites acima.</span></label>
      {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">{error}</p>}
    </div>
    <footer className="flex justify-end gap-2 border-t border-slate-200 px-6 py-4"><button onClick={onClose} disabled={busy} className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-bold text-slate-600">Voltar</button><button onClick={start} disabled={!confirmed || busy || (scheduleMode === 'later' && !scheduledAt)} className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-40">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}{scheduleMode === 'later' ? 'Agendar campanha' : 'Iniciar campanha'}</button></footer>
  </div></div>;
}

function EmailCampaignBuilder({ domain, defaultSenderName, onClose, onSaved }: { domain: DomainConfig; defaultSenderName: string; onClose: () => void; onSaved: () => void }) {
  const { authFetch, business, user } = useAuth();
  const [filters, setFilters] = useState<AudienceFilters>(initialFilters);
  const [preview, setPreview] = useState<AudiencePreview>(initialPreview);
  const [previewing, setPreviewing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: '', senderName: localStorage.getItem('prospecting_sender_name') || defaultSenderName,
    senderLocalPart: 'contato', replyToEmail: user?.email || '', objective: 'present_platform', offer: '',
    subject: '', previewText: '', textBody: '', legalBasis: 'legitimate_interest',
    processingPurpose: 'Realizar contato comercial B2B relacionado aos serviços da empresa.',
    balanceTestReference: 'Contato dirigido a endereços profissionais, com mensagem pertinente à atividade da empresa e opção clara de descadastramento.',
    includeUnsubscribe: true, testRecipientEmail: '',
  });

  const hasTestRecipient = Boolean(form.testRecipientEmail.trim());
  const validTestRecipient = emailPattern.test(form.testRecipientEmail.trim());

  const query = useMemo(() => new URLSearchParams({ businessId: business?.id || '', ...filters }).toString(), [business?.id, filters]);
  useEffect(() => {
    if (hasTestRecipient) {
      setPreview({ ...initialPreview, totalWithEmail: validTestRecipient ? 1 : 0, invalidCount: validTestRecipient ? 0 : 1, eligibleCount: validTestRecipient ? 1 : 0 });
      return;
    }
    const timer = window.setTimeout(async () => {
      if (!business?.id) return;
      setPreviewing(true);
      try {
        const response = await authFetch(`/api/prospecting/email/campaigns/audience-preview?${query}`);
        const data = await response.json().catch(() => ({}));
        if (response.ok) setPreview(data);
      } finally { setPreviewing(false); }
    }, 350);
    return () => window.clearTimeout(timer);
  }, [query, hasTestRecipient, validTestRecipient]);

  const generate = async () => {
    setGenerating(true); setError('');
    try {
      const response = await authFetch(`/api/prospecting/email/campaigns/generate-copy?businessId=${business?.id}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ objective: form.objective, offer: form.offer, senderName: form.senderName }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Falha ao gerar a mensagem.');
      setForm(current => ({ ...current, subject: data.subject, previewText: data.previewText, textBody: data.textBody, name: current.name || `Campanha ${new Date().toLocaleDateString('pt-BR')}` }));
    } catch (error: any) { setError(error.message); }
    finally { setGenerating(false); }
  };

  const save = async () => {
    if (!business?.id) return;
    setSaving(true); setError('');
    try {
      const response = await authFetch(`/api/prospecting/email/campaigns?businessId=${business.id}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, audienceFilters: filters }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Falha ao salvar a campanha.');
      localStorage.setItem('prospecting_sender_name', form.senderName.trim());
      onSaved();
    } catch (error: any) { setError(error.message); }
    finally { setSaving(false); }
  };

  const canSave = form.name.trim() && form.senderName.trim() && form.subject.trim() && form.textBody.trim().length >= 40 && preview.eligibleCount > 0 && form.includeUnsubscribe;

  return <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/60 p-3">
    <div className="max-h-[96vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4"><div><h2 className="text-lg font-bold text-slate-900">Nova campanha de e-mail</h2><p className="text-xs text-slate-500">Crie e salve o rascunho. Nenhum e-mail será enviado nesta etapa.</p></div><button onClick={onClose} disabled={saving} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button></header>
      <div className="grid gap-6 p-6 lg:grid-cols-[1.25fr_.75fr]">
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-xs font-bold text-slate-700">Nome da campanha<input value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} placeholder="Ex.: Convite parceiros agosto" className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-normal outline-none focus:border-indigo-500" /></label>
            <label className="text-xs font-bold text-slate-700">Objetivo<select value={form.objective} onChange={event => setForm({ ...form, objective: event.target.value })} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-normal outline-none"><option value="present_platform">Apresentar a empresa</option><option value="advertise_products">Convidar para anunciar</option><option value="partnership">Propor parceria</option><option value="schedule_meeting">Agendar conversa</option></select></label>
          </div>
          <label className="block text-xs font-bold text-slate-700">Oferta ou foco da abordagem <span className="font-normal text-slate-400">(opcional)</span><input value={form.offer} onChange={event => setForm({ ...form, offer: event.target.value })} placeholder="O que você quer apresentar para toda a base?" className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-normal outline-none focus:border-indigo-500" /></label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-xs font-bold text-slate-700">Nome do remetente<input value={form.senderName} onChange={event => setForm({ ...form, senderName: event.target.value })} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-normal outline-none" /></label>
            <label className="text-xs font-bold text-slate-700">E-mail do remetente<div className="mt-1.5 flex overflow-hidden rounded-lg border border-slate-300"><input value={form.senderLocalPart} onChange={event => setForm({ ...form, senderLocalPart: event.target.value.toLowerCase() })} className="min-w-0 flex-1 px-3 py-2.5 text-sm font-normal outline-none" /><span className="border-l border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-normal text-slate-500">@{domain.domain}</span></div></label>
          </div>
          <label className="block text-xs font-bold text-slate-700">E-mail para respostas<input type="email" value={form.replyToEmail} onChange={event => setForm({ ...form, replyToEmail: event.target.value })} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-normal outline-none" /></label>
          <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-4"><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-bold text-indigo-950">Abordagem universal</p><p className="text-xs text-indigo-700">A mesma mensagem será usada para todos os destinatários.</p></div><button onClick={generate} disabled={generating || !form.senderName.trim()} className="flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}Gerar com IA</button></div></div>
          <label className="block text-xs font-bold text-slate-700">Assunto<input value={form.subject} onChange={event => setForm({ ...form, subject: event.target.value })} maxLength={200} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-normal outline-none" /></label>
          <label className="block text-xs font-bold text-slate-700">Texto de prévia<input value={form.previewText} onChange={event => setForm({ ...form, previewText: event.target.value })} maxLength={240} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-normal outline-none" /></label>
          <label className="block text-xs font-bold text-slate-700">Mensagem<textarea value={form.textBody} onChange={event => setForm({ ...form, textBody: event.target.value })} rows={10} className="mt-1.5 w-full resize-y rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-normal leading-relaxed outline-none focus:border-indigo-500" /></label>
        </div>
        <aside className="space-y-5">
          <div className="rounded-xl border border-slate-200 p-4"><h3 className="mb-3 text-sm font-bold text-slate-900">Audiência</h3><div className="space-y-3">
            <label className="block text-xs font-semibold text-slate-600">E-mail de teste <span className="font-normal text-slate-400">(opcional)</span><input type="email" value={form.testRecipientEmail} onChange={event => setForm({ ...form, testRecipientEmail: event.target.value })} placeholder="seu-email@exemplo.com" className="mt-1 w-full rounded-lg border border-indigo-300 px-3 py-2 text-sm outline-none focus:border-indigo-500" /><span className="mt-1 block font-normal text-indigo-700">Preenchido, envia somente para este endereço e ignora os filtros.</span></label>
            <fieldset disabled={hasTestRecipient} className={hasTestRecipient ? 'space-y-3 opacity-50' : 'space-y-3'}>
              <label className="block text-xs font-semibold text-slate-600">Origem<select value={filters.origin} onChange={event => setFilters({ ...filters, origin: event.target.value as AudienceFilters['origin'] })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"><option value="all">Toda a base</option><option value="spreadsheet">Base importada</option><option value="search">Empresas pesquisadas</option></select></label>
              <div className="grid grid-cols-2 gap-2"><label className="text-xs font-semibold text-slate-600">Status<select value={filters.status} onChange={event => setFilters({ ...filters, status: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2 text-xs"><option value="all">Todos</option><option value="new">Novos</option><option value="reviewed">Revisados</option><option value="qualified">Qualificados</option><option value="imported">No CRM</option></select></label><label className="text-xs font-semibold text-slate-600">Compatibilidade<select value={filters.fit} onChange={event => setFilters({ ...filters, fit: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2 text-xs"><option value="all">Todas</option><option value="high">Alta</option><option value="medium">Média</option><option value="low">Baixa</option></select></label></div>
              <div className="grid grid-cols-[80px_1fr] gap-2"><input value={filters.state} onChange={event => setFilters({ ...filters, state: event.target.value.toUpperCase().slice(0, 2) })} placeholder="UF" className="rounded-lg border border-slate-300 px-3 py-2 text-xs" /><input value={filters.segment} onChange={event => setFilters({ ...filters, segment: event.target.value })} placeholder="Filtrar segmento" className="rounded-lg border border-slate-300 px-3 py-2 text-xs" /></div>
            </fieldset>
          </div><div className="mt-4 rounded-xl bg-slate-950 p-4 text-white"><div className="flex items-center justify-between"><span className="text-xs text-slate-300">{hasTestRecipient ? 'Destinatário de teste' : 'Elegíveis para o rascunho'}</span>{previewing && <Loader2 className="h-4 w-4 animate-spin" />}</div><strong className="mt-1 block text-3xl">{preview.eligibleCount.toLocaleString('pt-BR')}</strong><div className="mt-3 space-y-1 text-[11px] text-slate-400">{hasTestRecipient ? <p>{validTestRecipient ? form.testRecipientEmail.trim() : 'Informe um endereço de e-mail válido'}</p> : <><p>{preview.totalWithEmail.toLocaleString('pt-BR')} registros com e-mail</p><p>{preview.duplicateCount.toLocaleString('pt-BR')} duplicados removidos</p><p>{preview.invalidCount.toLocaleString('pt-BR')} endereços inválidos</p><p>{preview.suppressedCount.toLocaleString('pt-BR')} descadastrados ou bloqueados</p></>}</div></div></div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4"><div className="flex items-center gap-2 text-sm font-bold text-emerald-900"><ShieldCheck className="h-4 w-4" />Conformidade</div><div className="mt-3 space-y-3">
            <label className="block text-xs font-semibold text-emerald-900">Base legal<select value={form.legalBasis} onChange={event => setForm({ ...form, legalBasis: event.target.value })} className="mt-1 w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs"><option value="legitimate_interest">Legítimo interesse</option><option value="consent">Consentimento</option></select></label>
            <label className="block text-xs font-semibold text-emerald-900">Finalidade<textarea value={form.processingPurpose} onChange={event => setForm({ ...form, processingPurpose: event.target.value })} rows={2} className="mt-1 w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs font-normal" /></label>
            {form.legalBasis === 'legitimate_interest' && <label className="block text-xs font-semibold text-emerald-900">Teste de balanceamento<textarea value={form.balanceTestReference} onChange={event => setForm({ ...form, balanceTestReference: event.target.value })} rows={3} className="mt-1 w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs font-normal" /></label>}
            <label className="flex items-start gap-2 text-xs text-emerald-900"><input type="checkbox" checked={form.includeUnsubscribe} onChange={event => setForm({ ...form, includeUnsubscribe: event.target.checked })} className="mt-0.5" />Incluir opção obrigatória de descadastramento em todas as mensagens.</label>
          </div></div>
        </aside>
      </div>
      {error && <div className="mx-6 mb-4 rounded-lg bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</div>}
      <footer className="sticky bottom-0 flex items-center justify-between border-t border-slate-200 bg-white px-6 py-4"><p className="text-xs text-slate-500"><strong>Importante:</strong> salvar cria apenas o rascunho e a lista de destinatários.</p><div className="flex gap-2"><button onClick={onClose} disabled={saving} className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-bold text-slate-600">Cancelar</button><button onClick={save} disabled={!canSave || saving} className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-40">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}Salvar rascunho</button></div></footer>
    </div>
  </div>;
}
