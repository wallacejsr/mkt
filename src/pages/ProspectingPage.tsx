import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Building2, 
  Search, 
  Plus, 
  Filter, 
  Download, 
  CheckSquare, 
  Square, 
  Globe, 
  Mail, 
  Phone, 
  MapPin, 
  Sparkles, 
  ExternalLink, 
  Calendar, 
  ChevronRight, 
  PlusCircle, 
  ShieldCheck, 
  RefreshCw,
  X,
  FileSpreadsheet,
  Upload,
  UserCheck,
  UserX
} from 'lucide-react';
import { useAuth } from '../lib/auth-context';
import { NewSearchModal } from '../components/prospecting/NewSearchModal';
import { ProspectDrawer, ProspectDetail } from '../components/prospecting/ProspectDrawer';
import { ApproachModal } from '../components/prospecting/ApproachModal';
import { SpreadsheetImportModal } from '../components/prospecting/SpreadsheetImportModal';

interface SearchHistoryItem {
  id: string;
  segment: string;
  city?: string;
  state?: string;
  requestedLimit: number;
  totalFound: number;
  totalWithEmail: number;
  totalWithPhone: number;
  status: string;
  createdAt: string;
}

export function ProspectingPage() {
  const { authFetch, business } = useAuth();
  
  const [searches, setSearches] = useState<SearchHistoryItem[]>([]);
  const [prospects, setProspects] = useState<ProspectDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'search' | 'spreadsheet'>('search');
  const [isSpreadsheetModalOpen, setIsSpreadsheetModalOpen] = useState(false);
  const [filterState, setFilterState] = useState('');
  const [filterSegment, setFilterSegment] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 });
  
  // Modals & Drawers state
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [selectedProspectId, setSelectedProspectId] = useState<string | null>(null);
  
  // Approach Modal state
  const [approachModalState, setApproachModalState] = useState<{
    isOpen: boolean;
    companyName: string;
    approach: any;
  }>({ isOpen: false, companyName: '', approach: null });

  // Filters state
  const [filterEmail, setFilterEmail] = useState(false);
  const [filterPhone, setFilterPhone] = useState(false);
  const [filterWebsite, setFilterWebsite] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterFit, setFilterFit] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Bulk Selection
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkImporting, setBulkImporting] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);

  useEffect(() => {
    if (business?.id) {
      fetchData();
    }
  }, [business?.id, activeTab, filterEmail, filterPhone, filterWebsite, filterStatus, filterFit, filterState, filterSegment, searchQuery, page]);

  useEffect(() => {
    setPage(1);
    setSelectedIds([]);
  }, [activeTab, filterEmail, filterPhone, filterWebsite, filterStatus, filterFit, filterState, filterSegment, searchQuery]);

  const fetchData = async () => {
    try {
      setLoading(true);
      // Fetch recent searches
      if (activeTab === 'search') {
        const searchRes = await authFetch(`/api/prospecting/searches?businessId=${business?.id}`);
        if (searchRes.ok) {
          const data = await searchRes.json();
          setSearches(data.searches || []);
        }
      }

      // Build prospects query
      const params = new URLSearchParams({ businessId: business?.id || '' });
      if (filterEmail) params.append('hasEmail', 'true');
      if (filterPhone) params.append('hasPhone', 'true');
      if (filterWebsite) params.append('hasWebsite', 'true');
      if (filterStatus !== 'all') params.append('status', filterStatus);
      if (filterFit !== 'all') params.append('fit', filterFit);
      params.append('origin', activeTab);
      params.append('page', String(page));
      params.append('pageSize', '100');
      if (filterState.trim()) params.append('state', filterState.trim());
      if (filterSegment.trim()) params.append('segment', filterSegment.trim());
      if (searchQuery.trim()) params.append('search', searchQuery.trim());

      const prospectRes = await authFetch(`/api/prospecting/prospects?${params.toString()}`);
      if (prospectRes.ok) {
        const data = await prospectRes.json();
        setProspects(data.prospects || []);
        setPagination(data.pagination || { page: 1, total: data.prospects?.length || 0, totalPages: 1 });
      }
    } catch (err) {
      console.error('Error loading prospecting data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSearch = async (searchData: any) => {
    const res = await authFetch(`/api/prospecting/search?businessId=${business?.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(searchData),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Falha ao iniciar busca.');
    }

    await fetchData();
  };

  const handleSelectAll = () => {
    if (selectedIds.length === prospects.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(prospects.map(p => p.id));
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleImportSingle = async (id: string) => {
    const res = await authFetch(`/api/prospecting/prospects/import?businessId=${business?.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prospectIds: [id] }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Falha ao importar prospect para CRM.');
    }

    await fetchData();
  };

  const handleBulkImport = async () => {
    if (selectedIds.length === 0) return;

    if (!confirm(`Deseja adicionar ${selectedIds.length} empresa(s) ao seu CRM?`)) {
      return;
    }

    try {
      setBulkImporting(true);
      const res = await authFetch(`/api/prospecting/prospects/import?businessId=${business?.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prospectIds: selectedIds }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Falha ao importar selecionados.');
      }

      const data = await res.json();
      alert(`${data.importedCount} empresas adicionadas ao CRM com sucesso!`);
      setSelectedIds([]);
      await fetchData();
    } catch (err: any) {
      alert(err.message || 'Erro ao importar empresas.');
    } finally {
      setBulkImporting(false);
    }
  };

  const handleExportCSV = async () => {
    try {
      setExportingCsv(true);
      const res = await authFetch(`/api/prospecting/prospects/export?businessId=${business?.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prospectIds: selectedIds.length > 0 ? selectedIds : undefined }),
      });

      if (!res.ok) throw new Error('Falha ao exportar CSV.');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `prospects_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } catch (err: any) {
      alert(err.message || 'Erro ao exportar CSV.');
    } finally {
      setExportingCsv(false);
    }
  };

  const handleBulkStatus = async (status: 'qualified' | 'disqualified') => {
    if (!selectedIds.length) return;
    try {
      const res = await authFetch(`/api/prospecting/prospects/status?businessId=${business?.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prospectIds: selectedIds, status }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Falha ao atualizar empresas.');
      setSelectedIds([]);
      await fetchData();
    } catch (err: any) {
      alert(err.message || 'Erro ao atualizar empresas.');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'imported':
        return <span className="px-2 py-0.5 text-[11px] font-semibold bg-blue-100 text-blue-800 rounded-full">No CRM</span>;
      case 'qualified':
        return <span className="px-2 py-0.5 text-[11px] font-semibold bg-emerald-100 text-emerald-800 rounded-full">Qualificado</span>;
      case 'disqualified':
        return <span className="px-2 py-0.5 text-[11px] font-semibold bg-slate-100 text-slate-600 rounded-full">Descartado</span>;
      default:
        return <span className="px-2 py-0.5 text-[11px] font-semibold bg-indigo-50 text-indigo-700 rounded-full">Novo</span>;
    }
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Prospecção</h1>
          <p className="text-sm text-slate-500 mt-1">
            Encontre empresas e contatos comerciais públicos para novas oportunidades.
          </p>
        </div>

        <button
          onClick={() => activeTab === 'search' ? setIsSearchModalOpen(true) : setIsSpreadsheetModalOpen(true)}
          className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold text-sm shadow-sm transition-colors flex items-center gap-2 self-start md:self-auto"
        >
          {activeTab === 'search' ? <Plus className="w-4 h-4" /> : <Upload className="w-4 h-4" />}
          {activeTab === 'search' ? 'Nova busca' : 'Importar planilha'}
        </button>
      </div>

      <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-2xs">
        <button
          onClick={() => setActiveTab('search')}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${activeTab === 'search' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
        >
          <Search className="h-4 w-4" /> Buscar empresas
        </button>
        <button
          onClick={() => setActiveTab('spreadsheet')}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${activeTab === 'spreadsheet' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
        >
          <FileSpreadsheet className="h-4 w-4" /> Base importada
        </button>
      </div>

      {/* Main Content */}
      {activeTab === 'search' && searches.length === 0 && !loading && prospects.length === 0 ? (
        /* Empty State */
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center max-w-2xl mx-auto my-8 shadow-2xs">
          <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <Building2 className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Encontre seus próximos clientes</h2>
          <p className="text-sm text-slate-600 leading-relaxed max-w-md mx-auto mb-6">
            Pesquise empresas por segmento e localização, encontre contatos comerciais públicos e adicione os melhores prospects ao seu CRM.
          </p>
          <button
            onClick={() => setIsSearchModalOpen(true)}
            className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm rounded-xl shadow-md transition-all inline-flex items-center gap-2"
          >
            <Search className="w-4 h-4" />
            Começar busca
          </button>
        </div>
      ) : (
        <>
          {/* Histórico de Buscas Recentes */}
          {activeTab === 'search' && searches.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">Buscas Recentes</h2>
                <span className="text-xs text-slate-400">{searches.length} pesquisas realizadas</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {searches.slice(0, 3).map((search) => (
                  <Link
                    key={search.id}
                    to={`/prospecting/${search.id}`}
                    className="bg-white border border-slate-200 rounded-xl p-4 hover:border-indigo-300 hover:shadow-sm transition-all group"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-bold text-sm text-slate-800 group-hover:text-indigo-600 transition-colors">
                          {search.segment}
                        </h3>
                        <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3 text-slate-400" />
                          {[search.city, search.state].filter(Boolean).join(', ') || 'Brasil'}
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-600 transition-colors" />
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
                      <div>
                        <strong>{search.totalFound}</strong> empresas
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-400">
                        <span>{search.totalWithEmail} e-mails</span>
                        <span>•</span>
                        <span>{search.totalWithPhone} fones</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Prospects Section */}
          <div className="space-y-4">
            {/* Filters Bar */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-3">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                {/* Search Bar */}
                <div className="relative flex-1 max-w-md">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar por empresa, site, e-mail ou cidade..."
                    className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Bulk Actions & Export */}
                <div className="flex items-center gap-2 self-end md:self-auto">
                  {selectedIds.length > 0 && (
                    <>
                      {activeTab === 'spreadsheet' && (
                        <>
                          <button onClick={() => handleBulkStatus('qualified')} className="px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg font-semibold text-xs flex items-center gap-1.5">
                            <UserCheck className="h-3.5 w-3.5" /> Qualificar
                          </button>
                          <button onClick={() => handleBulkStatus('disqualified')} className="px-3 py-1.5 bg-slate-50 text-slate-600 border border-slate-200 rounded-lg font-semibold text-xs flex items-center gap-1.5">
                            <UserX className="h-3.5 w-3.5" /> Descartar
                          </button>
                        </>
                      )}
                      <button
                        onClick={handleBulkImport}
                        disabled={bulkImporting}
                        className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold text-xs transition-colors flex items-center gap-1.5 shadow-2xs"
                      >
                        <PlusCircle className="w-3.5 h-3.5" />
                        Adicionar {selectedIds.length} ao CRM
                      </button>
                    </>
                  )}

                  <button
                    onClick={handleExportCSV}
                    disabled={exportingCsv}
                    className="px-3.5 py-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg font-medium text-xs transition-colors flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-500" />
                    Exportar CSV
                  </button>
                </div>
              </div>

              {/* Filter Chips */}
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 text-xs">
                <span className="text-slate-400 text-[11px] font-medium mr-1 flex items-center gap-1">
                  <Filter className="w-3 h-3" /> Filtros:
                </span>

                <button
                  onClick={() => setFilterEmail(!filterEmail)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                    filterEmail
                      ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  Com e-mail
                </button>

                {activeTab === 'spreadsheet' && (
                  <>
                    <input
                      value={filterState}
                      onChange={event => setFilterState(event.target.value.toUpperCase().slice(0, 2))}
                      placeholder="UF"
                      className="w-16 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600 outline-none focus:border-indigo-400"
                    />
                    <input
                      value={filterSegment}
                      onChange={event => setFilterSegment(event.target.value)}
                      placeholder="Segmento"
                      className="w-32 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600 outline-none focus:border-indigo-400"
                    />
                  </>
                )}

                <button
                  onClick={() => setFilterPhone(!filterPhone)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                    filterPhone
                      ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  Com telefone
                </button>

                {activeTab === 'search' && (
                  <button
                    onClick={() => setFilterWebsite(!filterWebsite)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                      filterWebsite
                        ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Com site
                  </button>
                )}

                <select
                  value={filterFit}
                  onChange={(e) => setFilterFit(e.target.value)}
                  className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-full text-xs font-medium text-slate-600 focus:outline-none"
                >
                  <option value="all">Todas as Compatibilidades</option>
                  <option value="high">Alta Compatibilidade</option>
                  <option value="medium">Média Compatibilidade</option>
                  <option value="low">Baixa Compatibilidade</option>
                </select>

                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-full text-xs font-medium text-slate-600 focus:outline-none"
                >
                  <option value="all">Todos os Status</option>
                  <option value="new">Novos</option>
                  <option value="qualified">Qualificados</option>
                  <option value="imported">No CRM</option>
                  <option value="disqualified">Descartados</option>
                </select>
              </div>
            </div>

            {/* Prospects Table */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
              {loading ? (
                <div className="py-20 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Carregando empresas...
                </div>
              ) : prospects.length === 0 ? (
                <div className="py-16 text-center text-xs text-slate-500">
                  Nenhuma empresa encontrada com os filtros selecionados.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                      <tr>
                        <th className="p-3 w-10 text-center">
                          <button onClick={handleSelectAll} className="text-slate-400 hover:text-slate-600">
                            {selectedIds.length === prospects.length ? (
                              <CheckSquare className="w-4 h-4 text-indigo-600" />
                            ) : (
                              <Square className="w-4 h-4" />
                            )}
                          </button>
                        </th>
                        <th className="p-3">Empresa</th>
                        <th className="p-3">Segmento</th>
                        <th className="p-3">Cidade</th>
                        <th className="p-3">{activeTab === 'spreadsheet' ? 'CNPJ/CPF' : 'Site'}</th>
                        <th className="p-3">E-mail Comercial</th>
                        <th className="p-3">Telefone</th>
                        <th className="p-3 text-center">Score</th>
                        <th className="p-3">Status</th>
                        <th className="p-3 text-right">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {prospects.map((prospect) => {
                        const isSelected = selectedIds.includes(prospect.id);
                        return (
                          <tr
                            key={prospect.id}
                            className={`hover:bg-slate-50/80 transition-colors ${
                              isSelected ? 'bg-indigo-50/30' : ''
                            }`}
                          >
                            <td className="p-3 text-center">
                              <button onClick={() => handleToggleSelect(prospect.id)} className="text-slate-400 hover:text-slate-600">
                                {isSelected ? (
                                  <CheckSquare className="w-4 h-4 text-indigo-600" />
                                ) : (
                                  <Square className="w-4 h-4" />
                                )}
                              </button>
                            </td>

                            <td className="p-3">
                              <button
                                onClick={() => setSelectedProspectId(prospect.id)}
                                className="font-bold text-slate-900 hover:text-indigo-600 text-left transition-colors"
                              >
                                {prospect.companyName}
                              </button>
                            </td>

                            <td className="p-3 text-slate-600">
                              {prospect.segment || '-'}
                            </td>

                            <td className="p-3 text-slate-600">
                              {[prospect.city, prospect.state].filter(Boolean).join(', ') || '-'}
                            </td>

                            <td className="p-3">
                              {activeTab === 'spreadsheet' ? (
                                <span className="font-mono text-[11px] text-slate-700">{prospect.taxId || '-'}</span>
                              ) : prospect.website ? (
                                <a
                                  href={prospect.website}
                                  target="_blank"
                                  rel="noreferrer noopener"
                                  className="text-indigo-600 hover:underline flex items-center gap-1"
                                >
                                  <Globe className="w-3 h-3 text-slate-400" />
                                  <span className="truncate max-w-[120px]">{prospect.domain || 'Site'}</span>
                                </a>
                              ) : (
                                <span className="text-slate-300">-</span>
                              )}
                            </td>

                            <td className="p-3 font-mono text-[11px]">
                              {prospect.email ? (
                                <span className="text-slate-800">{prospect.email}</span>
                              ) : (
                                <span className="text-slate-300">-</span>
                              )}
                            </td>

                            <td className="p-3 font-mono text-[11px] text-slate-700">
                              {prospect.phone || '-'}
                            </td>

                            <td className="p-3 text-center">
                              <span className="px-2 py-0.5 rounded-full font-extrabold text-[11px] bg-slate-100 text-slate-800">
                                {prospect.qualificationScore || 0}
                              </span>
                            </td>

                            <td className="p-3">
                              {getStatusBadge(prospect.status)}
                            </td>

                            <td className="p-3 text-right">
                              {prospect.status === 'imported' ? (
                                <span className="text-[11px] text-emerald-600 font-semibold">CRM OK</span>
                              ) : (
                                <button
                                  onClick={() => handleImportSingle(prospect.id)}
                                  className="px-2.5 py-1 bg-white border border-slate-200 hover:bg-slate-50 text-indigo-600 rounded-md font-semibold text-[11px] transition-colors inline-flex items-center gap-1 shadow-2xs"
                                >
                                  <Plus className="w-3 h-3" /> CRM
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            {activeTab === 'spreadsheet' && pagination.totalPages > 1 && (
              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-600">
                <span>{pagination.total.toLocaleString('pt-BR')} empresas · página {pagination.page} de {pagination.totalPages}</span>
                <div className="flex gap-2">
                  <button disabled={page <= 1} onClick={() => setPage(current => Math.max(1, current - 1))} className="rounded-lg border border-slate-200 px-3 py-1.5 font-semibold disabled:opacity-40">Anterior</button>
                  <button disabled={page >= pagination.totalPages} onClick={() => setPage(current => current + 1)} className="rounded-lg border border-slate-200 px-3 py-1.5 font-semibold disabled:opacity-40">Próxima</button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* New Search Modal */}
      <NewSearchModal
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
        onSubmit={handleCreateSearch}
      />

      <SpreadsheetImportModal
        isOpen={isSpreadsheetModalOpen}
        onClose={() => setIsSpreadsheetModalOpen(false)}
        onImported={() => {
          setPage(1);
          fetchData();
        }}
      />

      {/* Prospect Side Drawer */}
      <ProspectDrawer
        prospectId={selectedProspectId}
        onClose={() => setSelectedProspectId(null)}
        onImportToCRM={handleImportSingle}
        onRefreshProspects={fetchData}
        onOpenApproach={(companyName, approach) => {
          setApproachModalState({ isOpen: true, companyName, approach });
        }}
      />

      {/* Approach Proposal Modal */}
      <ApproachModal
        isOpen={approachModalState.isOpen}
        onClose={() => setApproachModalState({ ...approachModalState, isOpen: false })}
        companyName={approachModalState.companyName}
        approach={approachModalState.approach}
      />
    </div>
  );
}
