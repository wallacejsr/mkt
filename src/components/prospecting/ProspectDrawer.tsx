import React, { useState, useEffect } from 'react';
import { 
  X, 
  Building2, 
  Globe, 
  Mail, 
  Phone, 
  MapPin, 
  ExternalLink, 
  CheckCircle2, 
  Sparkles, 
  PlusCircle, 
  RefreshCw, 
  Send, 
  ShieldCheck, 
  AlertCircle 
} from 'lucide-react';
import { useAuth } from '../../lib/auth-context';

export interface ProspectDetail {
  id: string;
  companyName: string;
  legalName?: string;
  segment?: string;
  description?: string;
  city?: string;
  state?: string;
  country?: string;
  website?: string;
  domain?: string;
  phone?: string;
  email?: string;
  taxId?: string;
  address?: string;
  neighborhood?: string;
  postalCode?: string;
  notes?: string;
  sourceType?: 'search' | 'spreadsheet';
  importBatchKey?: string;
  importFileName?: string;
  emailType?: string;
  websiteStatus?: string;
  sourceUrl?: string;
  contactSource?: string;
  confidence?: 'high' | 'medium' | 'low';
  qualificationScore?: number;
  qualificationReason?: string;
  qualificationFit?: 'high' | 'medium' | 'low';
  possibleNeed?: string;
  status: string;
  crmLeadId?: string;
  createdAt: string;
}

export interface ProspectContactDetail {
  id: string;
  type: 'email' | 'phone' | 'whatsapp' | 'other';
  value: string;
  label?: string;
  sourceUrl?: string;
  confidence: 'high' | 'medium' | 'low';
  isPrimary: boolean;
}

interface Props {
  prospectId: string | null;
  onClose: () => void;
  onImportToCRM: (id: string) => Promise<void>;
  onRefreshProspects: () => void;
  onOpenApproach: (prospectName: string, approach: any) => void;
}

export function ProspectDrawer({ prospectId, onClose, onImportToCRM, onRefreshProspects, onOpenApproach }: Props) {
  const { authFetch, business } = useAuth();
  const [prospect, setProspect] = useState<ProspectDetail | null>(null);
  const [contacts, setContacts] = useState<ProspectContactDetail[]>([]);
  const [loading, setLoading] = useState(false);
  const [qualifying, setQualifying] = useState(false);
  const [generatingApproach, setGeneratingApproach] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (prospectId) {
      fetchProspectDetail(prospectId);
    } else {
      setProspect(null);
      setContacts([]);
    }
  }, [prospectId]);

  const fetchProspectDetail = async (id: string) => {
    try {
      setLoading(true);
      setError(null);
      const res = await authFetch(`/api/prospecting/prospects/${id}?businessId=${business?.id}`);
      if (!res.ok) throw new Error('Falha ao buscar detalhes do prospect.');
      const data = await res.json();
      setProspect(data.prospect);
      const savedContacts = data.contacts || [];
      if (savedContacts.length) {
        setContacts(savedContacts);
      } else {
        const directContacts: ProspectContactDetail[] = [];
        if (data.prospect?.email) directContacts.push({ id: 'primary-email', type: 'email', value: data.prospect.email, label: 'E-mail da base', confidence: data.prospect.confidence || 'medium', isPrimary: true });
        if (data.prospect?.phone) directContacts.push({ id: 'primary-phone', type: 'phone', value: data.prospect.phone, label: 'Telefone da base', confidence: data.prospect.confidence || 'medium', isPrimary: true });
        setContacts(directContacts);
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar dados do prospect.');
    } finally {
      setLoading(false);
    }
  };

  const handleReQualify = async () => {
    if (!prospect) return;
    try {
      setQualifying(true);
      const res = await authFetch(`/api/prospecting/prospects/${prospect.id}/qualify?businessId=${business?.id}`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Falha ao qualificar prospect.');
      const data = await res.json();
      setProspect(data.prospect);
      onRefreshProspects();
    } catch (err: any) {
      alert(err.message || 'Erro ao qualificar prospect.');
    } finally {
      setQualifying(false);
    }
  };

  const handleGenerateApproach = async () => {
    if (!prospect) return;
    try {
      setGeneratingApproach(true);
      const res = await authFetch(`/api/prospecting/prospects/${prospect.id}/generate-approach?businessId=${business?.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error('Falha ao gerar proposta de abordagem.');
      const data = await res.json();
      onOpenApproach(prospect.companyName, data.approach);
    } catch (err: any) {
      alert(err.message || 'Erro ao gerar proposta de abordagem.');
    } finally {
      setGeneratingApproach(false);
    }
  };

  const handleImport = async () => {
    if (!prospect) return;
    try {
      setImporting(true);
      await onImportToCRM(prospect.id);
      await fetchProspectDetail(prospect.id);
    } catch (err: any) {
      alert(err.message || 'Erro ao importar para CRM.');
    } finally {
      setImporting(false);
    }
  };

  if (!prospectId) return null;

  const getConfidenceBadge = (confidence?: string) => {
    switch (confidence) {
      case 'high':
        return <span className="px-2 py-0.5 text-[11px] font-semibold bg-emerald-100 text-emerald-700 rounded-full">Alta Confiança</span>;
      case 'medium':
        return <span className="px-2 py-0.5 text-[11px] font-semibold bg-amber-100 text-amber-700 rounded-full">Média Confiança</span>;
      default:
        return <span className="px-2 py-0.5 text-[11px] font-semibold bg-slate-100 text-slate-600 rounded-full">Baixa Confiança</span>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'imported':
        return <span className="px-2.5 py-1 text-xs font-semibold bg-blue-100 text-blue-800 rounded-full">Adicionado ao CRM</span>;
      case 'qualified':
        return <span className="px-2.5 py-1 text-xs font-semibold bg-emerald-100 text-emerald-800 rounded-full">Qualificado</span>;
      case 'disqualified':
        return <span className="px-2.5 py-1 text-xs font-semibold bg-slate-100 text-slate-600 rounded-full">Descartado</span>;
      default:
        return <span className="px-2.5 py-1 text-xs font-semibold bg-indigo-100 text-indigo-800 rounded-full">Novo Prospect</span>;
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-xs flex justify-end">
      <div className="w-full max-w-xl bg-white h-full shadow-2xl flex flex-col border-l border-slate-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-lg">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 line-clamp-1">{prospect?.companyName || 'Carregando...'}</h2>
              <div className="flex items-center gap-2 mt-0.5">
                {prospect && getStatusBadge(prospect.status)}
                {prospect && getConfidenceBadge(prospect.confidence)}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-20 text-slate-400 text-sm">
              <RefreshCw className="w-5 h-5 animate-spin mr-2" />
              Carregando informações do prospect...
            </div>
          ) : error ? (
            <div className="p-4 bg-red-50 text-red-700 text-xs rounded-lg border border-red-200">
              {error}
            </div>
          ) : prospect ? (
            <>
              {/* Score e Qualificação AI */}
              <div className="bg-gradient-to-br from-indigo-50 to-slate-50 border border-indigo-100 rounded-xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-indigo-600" />
                    <span className="text-xs font-bold uppercase tracking-wider text-indigo-900">Score de Qualificação</span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-white px-3 py-1 rounded-full border border-indigo-200 shadow-2xs">
                    <span className="text-lg font-extrabold text-indigo-700">{prospect.qualificationScore || 0}</span>
                    <span className="text-xs text-slate-400">/ 100</span>
                  </div>
                </div>

                {prospect.qualificationReason && (
                  <p className="text-xs text-slate-700 leading-relaxed bg-white/80 p-3 rounded-lg border border-indigo-50">
                    <strong>Análise: </strong> {prospect.qualificationReason}
                  </p>
                )}

                {prospect.possibleNeed && (
                  <p className="text-xs text-slate-600 bg-white/80 p-3 rounded-lg border border-indigo-50">
                    <strong>Oportunidade Potencial: </strong> {prospect.possibleNeed}
                  </p>
                )}

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    onClick={handleReQualify}
                    disabled={qualifying}
                    className="text-xs font-medium text-indigo-700 hover:text-indigo-900 flex items-center gap-1 transition-colors"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${qualifying ? 'animate-spin' : ''}`} />
                    Reanalisar Qualificação
                  </button>
                </div>
              </div>

              {/* Informações Gerais */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Dados da Empresa</h3>
                <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 text-xs">
                  {prospect.segment && (
                    <div className="flex items-center gap-2 text-slate-700">
                      <Building2 className="w-4 h-4 text-slate-400" />
                      <span className="font-medium text-slate-900">{prospect.segment}</span>
                    </div>
                  )}

                  {(prospect.city || prospect.state) && (
                    <div className="flex items-center gap-2 text-slate-700">
                      <MapPin className="w-4 h-4 text-slate-400" />
                      <span>{[prospect.city, prospect.state, prospect.country].filter(Boolean).join(', ')}</span>
                    </div>
                  )}

                  {prospect.taxId && (
                    <div className="flex items-center gap-2 text-slate-700">
                      <ShieldCheck className="w-4 h-4 text-slate-400" />
                      <span><strong>CNPJ/CPF:</strong> {prospect.taxId}</span>
                    </div>
                  )}

                  {prospect.address && (
                    <div className="flex items-start gap-2 text-slate-700">
                      <MapPin className="mt-0.5 w-4 h-4 text-slate-400" />
                      <span>{[prospect.address, prospect.neighborhood, prospect.postalCode].filter(Boolean).join(' · ')}</span>
                    </div>
                  )}

                  {prospect.website && (
                    <div className="flex items-center gap-2 text-slate-700">
                      <Globe className="w-4 h-4 text-slate-400" />
                      <a
                        href={prospect.website}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="text-indigo-600 hover:underline flex items-center gap-1 font-medium"
                      >
                        {prospect.website}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  )}

                  {prospect.description && (
                    <p className="text-slate-600 pt-2 border-t border-slate-100 leading-relaxed">
                      {prospect.description}
                    </p>
                  )}
                  {prospect.notes && (
                    <p className="text-slate-600 pt-2 border-t border-slate-100 leading-relaxed whitespace-pre-line">
                      <strong>Observações:</strong> {prospect.notes}
                    </p>
                  )}
                </div>
              </div>

              {/* Contatos Públicos Descobertos */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Contatos Comerciais Públicos</h3>
                  <span className="text-[11px] text-slate-400">{contacts.length} encontrados</span>
                </div>

                {contacts.length === 0 ? (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center text-xs text-slate-500 space-y-1">
                    <p className="font-semibold text-slate-700">
                      {prospect.websiteStatus === 'no_website_found' && 'Site não encontrado'}
                      {prospect.websiteStatus === 'website_found_no_contact' && 'Site encontrado, sem e-mail público'}
                      {prospect.websiteStatus === 'fetch_failed' && 'Falha ao consultar site oficial'}
                      {prospect.websiteStatus === 'blocked_by_site' && 'Acesso ao site bloqueado (proteção contra bots)'}
                      {(!prospect.websiteStatus || prospect.websiteStatus === 'contact_found') && 'Nenhum e-mail público localizado nas páginas do site'}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      O pipeline rastreou as páginas públicas (/contato, /sobre, /atendimento) e não localizou e-mails/telefones visíveis ou estruturados.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {contacts.map((contact) => (
                      <div key={contact.id} className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 font-medium text-xs text-slate-800">
                            {contact.type === 'email' ? (
                              <Mail className="w-4 h-4 text-indigo-500" />
                            ) : (
                              <Phone className="w-4 h-4 text-emerald-500" />
                            )}
                            <span className="font-mono">{contact.value}</span>
                            {contact.isPrimary && (
                              <span className="px-1.5 py-0.5 text-[10px] font-bold bg-indigo-100 text-indigo-700 rounded">Principal</span>
                            )}
                          </div>
                          {getConfidenceBadge(contact.confidence)}
                        </div>

                        {contact.sourceUrl && (
                          <div className="text-[11px] text-slate-500 flex items-center gap-1 pt-1 border-t border-slate-100">
                            <span className="text-slate-400">Origem Pública:</span>
                            <a
                              href={contact.sourceUrl}
                              target="_blank"
                              rel="noreferrer noopener"
                              className="text-slate-600 hover:text-indigo-600 truncate max-w-[280px]"
                            >
                              {contact.sourceUrl}
                            </a>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Transparência e Origem */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-600 flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-slate-500 flex-shrink-0 mt-0.5" />
                <div>
                  <strong>Fonte de Origem: </strong> {prospect.contactSource || 'Pesquisa Pública em Diretórios Oficiais'}.
                  Todos os dados foram coletados de páginas públicas sem violar áreas restritas ou termos de uso.
                </div>
              </div>
            </>
          ) : null}
        </div>

        {/* Footer Actions */}
        {prospect && (
          <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between gap-3">
            <button
              onClick={handleGenerateApproach}
              disabled={generatingApproach}
              className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg shadow-2xs transition-colors flex items-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5 text-indigo-600" />
              Criar Abordagem
            </button>

            {prospect.status === 'imported' ? (
              <div className="text-xs font-semibold text-emerald-700 flex items-center gap-1.5 bg-emerald-50 px-3 py-2 rounded-lg border border-emerald-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Já adicionado ao CRM
              </div>
            ) : (
              <button
                onClick={handleImport}
                disabled={importing}
                className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
              >
                {importing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Adicionando...
                  </>
                ) : (
                  <>
                    <PlusCircle className="w-4 h-4" />
                    Adicionar ao CRM
                  </>
                )}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
