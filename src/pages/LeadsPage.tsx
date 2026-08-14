import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Lead, LeadStatus, LeadSummary, LeadSource } from '../types/lead';
import { LeadSummaryCards } from '../components/leads/LeadSummaryCards';
import { LeadKanbanBoard } from '../components/leads/LeadKanbanBoard';
import { LeadListView } from '../components/leads/LeadListView';
import { NewLeadModal } from '../components/leads/NewLeadModal';
import { LostReasonModal } from '../components/leads/LostReasonModal';
import { CustomerValueModal } from '../components/leads/CustomerValueModal';
import { LeadDrawer } from '../components/leads/LeadDrawer';
import { 
  Plus, 
  Search, 
  Filter, 
  Kanban, 
  List, 
  Users, 
  Sparkles, 
  Megaphone, 
  X,
  AlertCircle
} from 'lucide-react';

export function LeadsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const campaignParam = searchParams.get('campaignId') || searchParams.get('campaign') || '';

  const [leads, setLeads] = useState<Lead[]>([]);
  const [summary, setSummary] = useState<LeadSummary>({
    total: 0,
    newCount: 0,
    contactedCount: 0,
    interestedCount: 0,
    proposalCount: 0,
    inNegotiationCount: 0,
    customerCount: 0,
    lostCount: 0,
    totalPotentialValue: 0,
    totalActualValue: 0,
  });

  const [campaigns, setCampaigns] = useState<{ id: string; name: string }[]>([]);
  const [products, setProducts] = useState<{ id: string; name: string }[]>([]);

  // View settings
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [showLost, setShowLost] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [selectedSource, setSelectedSource] = useState<string>('');
  const [selectedCampaign, setSelectedCampaign] = useState<string>(campaignParam);

  // Modals & Drawer State
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);

  // State transitions
  const [pendingStatusMove, setPendingStatusMove] = useState<{
    leadId: string;
    newStatus: LeadStatus;
    leadName: string;
    potentialValue?: number | null;
  } | null>(null);

  const [isLostModalOpen, setIsLostModalOpen] = useState(false);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);

  const [loading, setLoading] = useState(true);

  const getBusinessId = () => {
    const fromUrl = searchParams.get('businessId');
    if (fromUrl) return fromUrl;
    return localStorage.getItem('currentBusinessId') || '';
  };

  useEffect(() => {
    if (campaignParam) {
      setSelectedCampaign(campaignParam);
    }
    fetchData();
    fetchCampaignsAndProducts();
  }, [searchParams]);

  useEffect(() => {
    fetchLeads();
  }, [search, selectedStatus, selectedSource, selectedCampaign]);

  const fetchData = async () => {
    setLoading(true);
    await Promise.all([fetchLeads(), fetchSummary()]);
    setLoading(false);
  };

  const fetchCampaignsAndProducts = async () => {
    const businessId = getBusinessId();
    if (!businessId) return;

    try {
      const [cRes, pRes] = await Promise.all([
        fetch(`/api/campaigns?businessId=${businessId}`),
        fetch(`/api/strategy/current?businessId=${businessId}`) // strategy endpoint also fetches products
      ]);

      if (cRes.ok) {
        const cData = await cRes.json();
        setCampaigns(cData.map((c: any) => ({ id: c.id, name: c.name })));
      }

      if (pRes.ok) {
        const pData = await pRes.json();
        if (pData.products) {
          setProducts(pData.products.map((p: any) => ({ id: p.id, name: p.name })));
        }
      }
    } catch (err) {
      console.error("Error fetching campaigns or products:", err);
    }
  };

  const fetchSummary = async () => {
    const businessId = getBusinessId();
    if (!businessId) return;

    try {
      const res = await fetch(`/api/leads/summary?businessId=${businessId}`);
      if (res.ok) {
        const data = await res.json();
        setSummary(data);
      }
    } catch (err) {
      console.error("Error fetching lead summary:", err);
    }
  };

  const fetchLeads = async () => {
    const businessId = getBusinessId();
    if (!businessId) return;

    try {
      const queryParams = new URLSearchParams({
        businessId,
        ...(search ? { search } : {}),
        ...(selectedStatus ? { status: selectedStatus } : {}),
        ...(selectedSource ? { source: selectedSource } : {}),
        ...(selectedCampaign ? { campaignId: selectedCampaign } : {}),
      });

      const res = await fetch(`/api/leads?${queryParams.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setLeads(data);
      }
    } catch (err) {
      console.error("Error fetching leads:", err);
    }
  };

  const handleCreateLead = async (leadData: any) => {
    const businessId = getBusinessId();
    const res = await fetch(`/api/leads?businessId=${businessId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(leadData),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Erro ao cadastrar lead");
    }

    await fetchData();
  };

  const handleMoveStatus = async (leadId: string, newStatus: LeadStatus) => {
    const targetLead = leads.find((l) => l.id === leadId);
    if (!targetLead) return;

    if (newStatus === 'lost') {
      setPendingStatusMove({
        leadId,
        newStatus,
        leadName: targetLead.name,
      });
      setIsLostModalOpen(true);
      return;
    }

    if (newStatus === 'customer') {
      setPendingStatusMove({
        leadId,
        newStatus,
        leadName: targetLead.name,
        potentialValue: targetLead.potentialValue,
      });
      setIsCustomerModalOpen(true);
      return;
    }

    await executeStatusUpdate(leadId, newStatus);
  };

  const executeStatusUpdate = async (leadId: string, newStatus: LeadStatus, extraData: any = {}) => {
    const businessId = getBusinessId();
    try {
      // Optimistic local update
      setLeads((prev) =>
        prev.map((l) => (l.id === leadId ? { ...l, status: newStatus, ...extraData } : l))
      );

      const res = await fetch(`/api/leads/${leadId}/status?businessId=${businessId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newStatus,
          ...extraData,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to update status on server");
      }

      await fetchSummary();
    } catch (err) {
      console.error("Status update error, reverting:", err);
      await fetchLeads(); // revert on failure
    }
  };

  const handleConfirmLost = async (reason: string) => {
    if (!pendingStatusMove) return;
    setIsLostModalOpen(false);
    await executeStatusUpdate(pendingStatusMove.leadId, 'lost', { lostReason: reason });
    setPendingStatusMove(null);
  };

  const handleConfirmCustomer = async (actualValue: number | null) => {
    if (!pendingStatusMove) return;
    setIsCustomerModalOpen(false);
    await executeStatusUpdate(pendingStatusMove.leadId, 'customer', { actualValue });
    setPendingStatusMove(null);
  };

  const handleClearFilters = () => {
    setSearch('');
    setSelectedStatus('');
    setSelectedSource('');
    setSelectedCampaign('');
    setSearchParams({});
  };

  const filteredLeads = leads.filter((l) => showLost || l.status !== 'lost');

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Leads</h1>
          <p className="text-sm text-slate-500 mt-1">
            Acompanhe seus contatos e oportunidades comerciais.
          </p>
        </div>

        <button
          onClick={() => setIsNewModalOpen(true)}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-semibold text-sm rounded-xl shadow-sm transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>+ Novo lead</span>
        </button>
      </div>

      {/* Summary Cards */}
      <LeadSummaryCards summary={summary} />

      {/* Active Campaign Filter Banner */}
      {selectedCampaign && (
        <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl flex items-center justify-between text-xs text-indigo-900">
          <div className="flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-indigo-600" />
            <span>
              Filtrando por campanha: <strong>{campaigns.find(c => c.id === selectedCampaign)?.name || 'Campanha'}</strong>
            </span>
          </div>
          <button
            onClick={() => {
              setSelectedCampaign('');
              setSearchParams({});
            }}
            className="text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1"
          >
            <X className="w-3.5 h-3.5" />
            Remover filtro
          </button>
        </div>
      )}

      {/* Control Bar: Filters, Search, View Mode */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, empresa, telefone ou e-mail..."
            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-xl text-xs font-medium text-slate-700 bg-white focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Todos os status</option>
            <option value="new">Novo</option>
            <option value="contacted">Contatado</option>
            <option value="interested">Interessado</option>
            <option value="proposal">Proposta</option>
            <option value="customer">Cliente</option>
            <option value="lost">Perdido</option>
          </select>

          {/* Source Filter */}
          <select
            value={selectedSource}
            onChange={(e) => setSelectedSource(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-xl text-xs font-medium text-slate-700 bg-white focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Todas as origens</option>
            <option value="Instagram">Instagram</option>
            <option value="Facebook">Facebook</option>
            <option value="Google">Google</option>
            <option value="WhatsApp">WhatsApp</option>
            <option value="LinkedIn">LinkedIn</option>
            <option value="Site">Site</option>
            <option value="Indicação">Indicação</option>
            <option value="Campanha">Campanha</option>
            <option value="Manual">Manual</option>
            <option value="Outro">Outro</option>
          </select>

          {/* Show Lost toggle */}
          <button
            onClick={() => setShowLost(!showLost)}
            className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-colors ${
              showLost
                ? 'bg-rose-50 text-rose-700 border-rose-200'
                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
            }`}
          >
            {showLost ? 'Ocultar Perdidos' : 'Exibir Perdidos'}
          </button>

          {(search || selectedStatus || selectedSource || selectedCampaign) && (
            <button
              onClick={handleClearFilters}
              className="px-3 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800"
            >
              Limpar filtros
            </button>
          )}
        </div>

        {/* View Toggle */}
        <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200 self-end md:self-auto">
          <button
            onClick={() => setViewMode('kanban')}
            className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              viewMode === 'kanban'
                ? 'bg-white text-indigo-700 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Kanban className="w-4 h-4" />
            <span>Kanban</span>
          </button>

          <button
            onClick={() => setViewMode('list')}
            className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              viewMode === 'list'
                ? 'bg-white text-indigo-700 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <List className="w-4 h-4" />
            <span>Lista</span>
          </button>
        </div>
      </div>

      {/* Main View Area */}
      {loading ? (
        <div className="py-16 text-center text-slate-400">
          Carregando seus leads e oportunidades...
        </div>
      ) : summary.total === 0 ? (
        /* Empty State */
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center max-w-lg mx-auto my-8">
          <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Users className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">Você ainda não possui leads.</h3>
          <p className="text-sm text-slate-500 mt-2 mb-6">
            Cadastre seus contatos para começar a acompanhar oportunidades e vendas.
          </p>
          <button
            onClick={() => setIsNewModalOpen(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm rounded-xl shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            Adicionar primeiro lead
          </button>
        </div>
      ) : (
        /* Kanban or List View */
        <div>
          {viewMode === 'kanban' ? (
            <LeadKanbanBoard
              leads={filteredLeads}
              onMoveStatus={handleMoveStatus}
              onSelectLead={(l) => setSelectedLeadId(l.id)}
              showLostColumn={showLost}
            />
          ) : (
            <LeadListView
              leads={filteredLeads}
              onSelectLead={(l) => setSelectedLeadId(l.id)}
            />
          )}
        </div>
      )}

      {/* Modals & Drawer */}
      <NewLeadModal
        isOpen={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)}
        onSubmit={handleCreateLead}
        campaigns={campaigns}
        products={products}
      />

      <LostReasonModal
        isOpen={isLostModalOpen}
        leadName={pendingStatusMove?.leadName || ''}
        onClose={() => {
          setIsLostModalOpen(false);
          setPendingStatusMove(null);
        }}
        onConfirm={handleConfirmLost}
      />

      <CustomerValueModal
        isOpen={isCustomerModalOpen}
        leadName={pendingStatusMove?.leadName || ''}
        initialPotentialValue={pendingStatusMove?.potentialValue}
        onClose={() => {
          setIsCustomerModalOpen(false);
          setPendingStatusMove(null);
        }}
        onConfirm={handleConfirmCustomer}
      />

      <LeadDrawer
        leadId={selectedLeadId}
        onClose={() => setSelectedLeadId(null)}
        onStatusChange={handleMoveStatus}
        onRefreshLeads={fetchData}
        campaigns={campaigns}
        products={products}
      />
    </div>
  );
}
