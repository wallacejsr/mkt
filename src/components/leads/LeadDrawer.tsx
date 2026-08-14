import React, { useState, useEffect } from 'react';
import { Lead, LeadActivity, LeadStatus } from '../../types/lead';
import { useAuth } from '../../lib/auth-context';
import { 
  X, 
  Phone, 
  Mail, 
  Building, 
  Tag, 
  Megaphone, 
  Package, 
  DollarSign, 
  Calendar, 
  Clock, 
  MessageSquare, 
  Plus, 
  UserCheck, 
  Send,
  CheckCircle2,
  AlertCircle,
  Edit2
} from 'lucide-react';

interface Props {
  leadId: string | null;
  onClose: () => void;
  onStatusChange: (leadId: string, newStatus: LeadStatus) => Promise<void>;
  onRefreshLeads: () => void;
  campaigns: { id: string; name: string }[];
  products: { id: string; name: string }[];
}

export function LeadDrawer({ leadId, onClose, onStatusChange, onRefreshLeads, campaigns, products }: Props) {
  const { authFetch, business } = useAuth();
  const [lead, setLead] = useState<Lead | null>(null);
  const [activities, setActivities] = useState<LeadActivity[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'timeline' | 'contact' | 'note' | 'edit'>('timeline');

  // Contact form state
  const [contactChannel, setContactChannel] = useState('WhatsApp');
  const [contactNotes, setContactNotes] = useState('');
  const [nextAction, setNextAction] = useState('');
  const [nextActionAt, setNextActionAt] = useState('');
  const [submittingContact, setSubmittingContact] = useState(false);

  // Note form state
  const [noteText, setNoteText] = useState('');
  const [submittingNote, setSubmittingNote] = useState(false);

  // Edit form state
  const [editName, setEditName] = useState('');
  const [editCompany, setEditCompany] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editValue, setEditValue] = useState('');
  const [submittingEdit, setSubmittingEdit] = useState(false);

  useEffect(() => {
    if (leadId) {
      fetchLeadDetails(leadId);
    } else {
      setLead(null);
      setActivities([]);
    }
  }, [leadId]);

  const fetchLeadDetails = async (id: string) => {
    try {
      setLoading(true);
      const res = await authFetch(`/api/leads/${id}?businessId=${getBusinessId()}`);
      if (!res.ok) throw new Error("Failed to fetch lead details");
      const data = await res.json();
      setLead(data.lead);
      setActivities(data.activities || []);

      // Populate edit fields
      if (data.lead) {
        setEditName(data.lead.name || '');
        setEditCompany(data.lead.companyName || '');
        setEditPhone(data.lead.phone || '');
        setEditEmail(data.lead.email || '');
        setEditValue(data.lead.potentialValue ? data.lead.potentialValue.toString() : '');
        setNextAction(data.lead.nextAction || '');
        setNextActionAt(data.lead.nextActionAt ? data.lead.nextActionAt.split('T')[0] : '');
      }
    } catch (err) {
      console.error("Error fetching lead details:", err);
    } finally {
      setLoading(false);
    }
  };

  const getBusinessId = () => {
    if (business?.id) return business.id;
    const searchParams = new URLSearchParams(window.location.search);
    const fromUrl = searchParams.get('businessId');
    if (fromUrl) return fromUrl;
    const stored = localStorage.getItem('currentBusinessId');
    return stored || '';
  };

  if (!leadId) return null;

  const handleRegisterContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lead) return;

    try {
      setSubmittingContact(true);
      const res = await authFetch(`/api/leads/${lead.id}/activities?businessId=${getBusinessId()}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'contact',
          contactChannel,
          notes: contactNotes.trim(),
          nextAction: nextAction.trim() || null,
          nextActionAt: nextActionAt || null,
        }),
      });

      if (!res.ok) throw new Error("Failed to register contact");

      setContactNotes('');
      setActiveTab('timeline');
      await fetchLeadDetails(lead.id);
      onRefreshLeads();
    } catch (err) {
      console.error("Error registering contact:", err);
    } finally {
      setSubmittingContact(false);
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lead || !noteText.trim()) return;

    try {
      setSubmittingNote(true);
      const res = await authFetch(`/api/leads/${lead.id}/activities?businessId=${getBusinessId()}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'note',
          notes: noteText.trim(),
        }),
      });

      if (!res.ok) throw new Error("Failed to add note");

      setNoteText('');
      setActiveTab('timeline');
      await fetchLeadDetails(lead.id);
      onRefreshLeads();
    } catch (err) {
      console.error("Error adding note:", err);
    } finally {
      setSubmittingNote(false);
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lead) return;

    try {
      setSubmittingEdit(true);
      const res = await authFetch(`/api/leads/${lead.id}?businessId=${getBusinessId()}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName.trim(),
          companyName: editCompany.trim() || null,
          phone: editPhone.trim() || null,
          email: editEmail.trim() || null,
          potentialValue: editValue ? parseFloat(editValue) : null,
          nextAction: nextAction.trim() || null,
          nextActionAt: nextActionAt || null,
        }),
      });

      if (!res.ok) throw new Error("Failed to update lead");

      setActiveTab('timeline');
      await fetchLeadDetails(lead.id);
      onRefreshLeads();
    } catch (err) {
      console.error("Error editing lead:", err);
    } finally {
      setSubmittingEdit(false);
    }
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return 'Data não informada';
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatCurrency = (val?: number | null) => {
    if (!val) return 'R$ 0';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      maximumFractionDigits: 0,
    }).format(val);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/50 backdrop-blur-sm flex justify-end">
      <div className="w-full max-w-xl bg-white h-full shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-300">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-200 bg-slate-50 flex items-start justify-between">
          <div className="flex-1 pr-4">
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase font-semibold px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-md border border-indigo-100">
                {lead?.source || 'Lead'}
              </span>
              {lead?.status && (
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-800">
                  {lead.status}
                </span>
              )}
            </div>
            <h2 className="text-xl font-bold text-slate-900 mt-2">{lead?.name || 'Carregando...'}</h2>
            {lead?.companyName && (
              <p className="text-sm text-slate-500 flex items-center gap-1 mt-0.5">
                <Building className="w-4 h-4 text-slate-400" />
                <span>{lead.companyName}</span>
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading || !lead ? (
          <div className="flex-1 flex items-center justify-center p-8 text-slate-400">
            Carregando detalhes do lead...
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto flex flex-col">
            
            {/* Lead Meta Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-slate-100/70 border-b border-slate-200 text-xs">
              <div>
                <span className="text-slate-400 font-medium block">Valor Potencial</span>
                <span className="font-bold text-slate-800 text-sm">{formatCurrency(lead.potentialValue)}</span>
              </div>
              {lead.actualValue && (
                <div>
                  <span className="text-slate-400 font-medium block">Valor Venda</span>
                  <span className="font-bold text-emerald-600 text-sm">{formatCurrency(lead.actualValue)}</span>
                </div>
              )}
              <div>
                <span className="text-slate-400 font-medium block">Telefone</span>
                <span className="font-medium text-slate-700">{lead.phone || '-'}</span>
              </div>
              <div>
                <span className="text-slate-400 font-medium block">E-mail</span>
                <span className="font-medium text-slate-700 truncate block">{lead.email || '-'}</span>
              </div>
            </div>

            {/* Quick Action Navigation */}
            <div className="flex border-b border-slate-200 bg-white px-4 pt-3 gap-2 text-xs font-semibold">
              <button
                onClick={() => setActiveTab('timeline')}
                className={`pb-3 px-3 border-b-2 transition-colors flex items-center gap-1.5 ${
                  activeTab === 'timeline'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                <Clock className="w-4 h-4" />
                Timeline ({activities.length})
              </button>

              <button
                onClick={() => setActiveTab('contact')}
                className={`pb-3 px-3 border-b-2 transition-colors flex items-center gap-1.5 ${
                  activeTab === 'contact'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                <Phone className="w-4 h-4" />
                Registrar Contato
              </button>

              <button
                onClick={() => setActiveTab('note')}
                className={`pb-3 px-3 border-b-2 transition-colors flex items-center gap-1.5 ${
                  activeTab === 'note'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                <MessageSquare className="w-4 h-4" />
                Observação
              </button>

              <button
                onClick={() => setActiveTab('edit')}
                className={`pb-3 px-3 border-b-2 transition-colors flex items-center gap-1.5 ${
                  activeTab === 'edit'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                <Edit2 className="w-4 h-4" />
                Editar
              </button>
            </div>

            {/* Tab Content */}
            <div className="p-6 flex-1 overflow-y-auto">

              {/* TAB 1: TIMELINE */}
              {activeTab === 'timeline' && (
                <div className="space-y-6">
                  {/* Próxima Ação Banner */}
                  {lead.nextAction && (
                    <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl flex items-start justify-between gap-3">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">
                          Próxima Ação
                        </span>
                        <p className="text-sm font-semibold text-indigo-950 mt-0.5">{lead.nextAction}</p>
                        {lead.nextActionAt && (
                          <p className="text-xs text-indigo-700 mt-1 flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            Agendado para: {new Date(lead.nextActionAt).toLocaleDateString('pt-BR')}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Activity History */}
                  <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">
                      Histórico de Atividades
                    </h4>

                    {activities.length === 0 ? (
                      <p className="text-sm text-slate-400 italic">Nenhuma atividade registrada ainda.</p>
                    ) : (
                      <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                        {activities.map((act) => (
                          <div key={act.id} className="relative">
                            {/* Dot icon */}
                            <div className="absolute -left-6 top-0.5 w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px]">
                              {act.type === 'conversion' ? '🎉' : act.type === 'contact' ? '📞' : '📝'}
                            </div>

                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-slate-800">{act.description}</span>
                              </div>
                              <span className="text-[11px] text-slate-400 block mt-0.5">
                                {formatDate(act.createdAt)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 2: REGISTRAR CONTATO */}
              {activeTab === 'contact' && (
                <form onSubmit={handleRegisterContact} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                      Canal do Contato
                    </label>
                    <select
                      value={contactChannel}
                      onChange={(e) => setContactChannel(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                    >
                      <option value="WhatsApp">WhatsApp</option>
                      <option value="Ligação">Ligação Telefônica</option>
                      <option value="E-mail">E-mail</option>
                      <option value="Reunião">Reunião Presencial/Online</option>
                      <option value="Outro">Outro</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                      Resumo da Conversa / Observações
                    </label>
                    <textarea
                      rows={3}
                      value={contactNotes}
                      onChange={(e) => setContactNotes(e.target.value)}
                      placeholder="Detalhe o que foi conversado..."
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                      required
                    />
                  </div>

                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                    <p className="text-xs font-bold text-slate-700">Agendar Próxima Ação (Opcional)</p>
                    <div>
                      <input
                        type="text"
                        value={nextAction}
                        onChange={(e) => setNextAction(e.target.value)}
                        placeholder="Ex: Enviar proposta comercial"
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm bg-white"
                      />
                    </div>
                    <div>
                      <input
                        type="date"
                        value={nextActionAt}
                        onChange={(e) => setNextActionAt(e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm bg-white"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={submittingContact}
                    className="w-full py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors disabled:opacity-50"
                  >
                    {submittingContact ? 'Registrando...' : 'Salvar Registro de Contato'}
                  </button>
                </form>
              )}

              {/* TAB 3: ADICIONAR OBSERVAÇÃO */}
              {activeTab === 'note' && (
                <form onSubmit={handleAddNote} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                      Nova Observação
                    </label>
                    <textarea
                      rows={4}
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      placeholder="Adicione notas internas sobre este lead..."
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submittingNote}
                    className="w-full py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors disabled:opacity-50"
                  >
                    {submittingNote ? 'Adicionando...' : 'Adicionar à Timeline'}
                  </button>
                </form>
              )}

              {/* TAB 4: EDITAR INFORMACÕES */}
              {activeTab === 'edit' && (
                <form onSubmit={handleSaveEdit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                      Nome do Lead
                    </label>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                      Empresa
                    </label>
                    <input
                      type="text"
                      value={editCompany}
                      onChange={(e) => setEditCompany(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                        Telefone
                      </label>
                      <input
                        type="text"
                        value={editPhone}
                        onChange={(e) => setEditPhone(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                        E-mail
                      </label>
                      <input
                        type="email"
                        value={editEmail}
                        onChange={(e) => setEditEmail(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                      Valor Potencial (R$)
                    </label>
                    <input
                      type="number"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submittingEdit}
                    className="w-full py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors disabled:opacity-50"
                  >
                    {submittingEdit ? 'Salvando...' : 'Salvar Alterações'}
                  </button>
                </form>
              )}

            </div>
          </div>
        )}
      </div>
    </div>
  );
}
