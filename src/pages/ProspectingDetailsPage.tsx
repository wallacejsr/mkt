import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  ArrowLeft, 
  Search, 
  MapPin, 
  Globe, 
  Mail, 
  Phone, 
  Building2, 
  PlusCircle, 
  Download, 
  RefreshCw, 
  CheckSquare, 
  Square, 
  Sparkles,
  CheckCircle2
} from 'lucide-react';
import { useAuth } from '../lib/auth-context';
import { ProspectDrawer, ProspectDetail } from '../components/prospecting/ProspectDrawer';
import { ApproachModal } from '../components/prospecting/ApproachModal';

export function ProspectingDetailsPage() {
  const { searchId } = useParams<{ searchId: string }>();
  const { authFetch, business } = useAuth();

  const [search, setSearch] = useState<any>(null);
  const [prospects, setProspects] = useState<ProspectDetail[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedProspectId, setSelectedProspectId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkImporting, setBulkImporting] = useState(false);

  const [approachModalState, setApproachModalState] = useState<{
    isOpen: boolean;
    companyName: string;
    approach: any;
  }>({ isOpen: false, companyName: '', approach: null });

  useEffect(() => {
    if (searchId && business?.id) {
      fetchSearchDetails();
    }
  }, [searchId, business?.id]);

  const fetchSearchDetails = async () => {
    try {
      setLoading(true);
      const res = await authFetch(`/api/prospecting/searches/${searchId}?businessId=${business?.id}`);
      if (!res.ok) throw new Error('Busca não encontrada.');
      const data = await res.json();
      setSearch(data.search);
      setProspects(data.prospects || []);
    } catch (err) {
      console.error('Error loading search details:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedIds.length === prospects.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(prospects.map(p => p.id));
    }
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

    await fetchSearchDetails();
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

      if (!res.ok) throw new Error('Falha ao importar selecionados.');
      const data = await res.json();
      alert(`${data.importedCount} empresas adicionadas ao CRM com sucesso!`);
      setSelectedIds([]);
      await fetchSearchDetails();
    } catch (err: any) {
      alert(err.message || 'Erro ao importar.');
    } finally {
      setBulkImporting(false);
    }
  };

  if (loading) {
    return (
      <div className="py-20 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
        <RefreshCw className="w-4 h-4 animate-spin" />
        Carregando detalhes da busca...
      </div>
    );
  }

  if (!search) {
    return (
      <div className="py-20 text-center text-slate-600 space-y-4">
        <p>Busca não encontrada.</p>
        <Link to="/prospecting" className="text-indigo-600 hover:underline font-semibold text-sm">
          &larr; Voltar para Prospecção
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Header Back Button */}
      <div>
        <Link
          to="/prospecting"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-indigo-600 transition-colors mb-2"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Voltar para Prospecção
        </Link>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-slate-200 rounded-xl p-6 shadow-2xs">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 text-xs font-bold uppercase bg-indigo-50 text-indigo-700 rounded-full">
                Busca de Prospecção
              </span>
              <span className="text-xs text-slate-400">
                {search.createdAt ? new Date(search.createdAt).toLocaleDateString('pt-BR') : ''}
              </span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mt-2">{search.segment}</h1>
            <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
              <MapPin className="w-3.5 h-3.5 text-slate-400" />
              {[search.city, search.state, search.country].filter(Boolean).join(', ')}
              {search.keywords && <span className="ml-2 font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">kw: {search.keywords}</span>}
            </p>
          </div>

          <div className="flex items-center gap-4 text-xs border-t md:border-t-0 md:border-l border-slate-100 pt-3 md:pt-0 md:pl-6">
            <div className="text-center">
              <span className="block text-lg font-extrabold text-slate-900">{search.totalFound || 0}</span>
              <span className="text-slate-400 text-[11px]">Encontradas</span>
            </div>

            <div className="text-center">
              <span className="block text-lg font-extrabold text-indigo-600">{search.totalWithEmail || 0}</span>
              <span className="text-slate-400 text-[11px]">Com E-mail</span>
            </div>

            <div className="text-center">
              <span className="block text-lg font-extrabold text-emerald-600">{search.totalWithPhone || 0}</span>
              <span className="text-slate-400 text-[11px]">Com Telefone</span>
            </div>
          </div>
        </div>
      </div>

      {/* Prospects Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs space-y-3 p-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">Empresas Encontradas ({prospects.length})</h2>

          {selectedIds.length > 0 && (
            <button
              onClick={handleBulkImport}
              disabled={bulkImporting}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold text-xs transition-colors flex items-center gap-1.5"
            >
              <PlusCircle className="w-3.5 h-3.5" /> Adicionar {selectedIds.length} ao CRM
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="p-3 w-10 text-center">
                  <button onClick={handleSelectAll} className="text-slate-400 hover:text-slate-600">
                    {selectedIds.length === prospects.length && prospects.length > 0 ? (
                      <CheckSquare className="w-4 h-4 text-indigo-600" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>
                </th>
                <th className="p-3">Empresa</th>
                <th className="p-3">Cidade</th>
                <th className="p-3">Site</th>
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
                  <tr key={prospect.id} className={`hover:bg-slate-50/80 transition-colors ${isSelected ? 'bg-indigo-50/30' : ''}`}>
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
                      {[prospect.city, prospect.state].filter(Boolean).join(', ') || '-'}
                    </td>

                    <td className="p-3">
                      {prospect.website ? (
                        <a
                          href={prospect.website}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="text-indigo-600 hover:underline flex items-center gap-1 font-medium"
                        >
                          <Globe className="w-3 h-3 text-slate-400 flex-shrink-0" />
                          <span className="truncate max-w-[120px]">{prospect.domain || 'Site'}</span>
                        </a>
                      ) : (
                        <span className="text-slate-400 text-[11px] italic">Site não encontrado</span>
                      )}
                    </td>

                    <td className="p-3 font-mono text-[11px]">
                      {prospect.email ? (
                        <span className="text-slate-900 font-semibold">{prospect.email}</span>
                      ) : (
                        <span className="text-slate-400 text-[11px] font-sans italic">
                          {prospect.websiteStatus === 'no_website_found' && 'Site não encontrado'}
                          {prospect.websiteStatus === 'website_found_no_contact' && 'Site encontrado, sem e-mail público'}
                          {prospect.websiteStatus === 'fetch_failed' && 'Falha ao consultar site'}
                          {prospect.websiteStatus === 'blocked_by_site' && 'Acesso bloqueado pelo site'}
                          {(!prospect.websiteStatus || prospect.websiteStatus === 'contact_found') && 'Sem e-mail público'}
                        </span>
                      )}
                    </td>

                    <td className="p-3 font-mono text-[11px]">
                      {prospect.phone ? (
                        <span className="text-slate-800">{prospect.phone}</span>
                      ) : (
                        <span className="text-slate-400 text-[11px] font-sans italic">
                          {prospect.websiteStatus === 'no_website_found' ? 'Site não encontrado' : 'Sem telefone público'}
                        </span>
                      )}
                    </td>

                    <td className="p-3 text-center font-extrabold">
                      {prospect.qualificationScore || 0}
                    </td>

                    <td className="p-3 font-semibold text-[11px]">
                      {prospect.status === 'imported' ? (
                        <span className="text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">No CRM</span>
                      ) : (
                        <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">Qualificado</span>
                      )}
                    </td>

                    <td className="p-3 text-right">
                      {prospect.status === 'imported' ? (
                        <span className="text-[11px] text-emerald-600 font-semibold flex items-center justify-end gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Adicionado
                        </span>
                      ) : (
                        <button
                          onClick={() => handleImportSingle(prospect.id)}
                          className="px-2.5 py-1 bg-indigo-600 text-white hover:bg-indigo-700 rounded-md font-semibold text-[11px] transition-colors shadow-2xs"
                        >
                          Adicionar ao CRM
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Prospect Drawer */}
      <ProspectDrawer
        prospectId={selectedProspectId}
        onClose={() => setSelectedProspectId(null)}
        onImportToCRM={handleImportSingle}
        onRefreshProspects={fetchSearchDetails}
        onOpenApproach={(companyName, approach) => {
          setApproachModalState({ isOpen: true, companyName, approach });
        }}
      />

      {/* Approach Modal */}
      <ApproachModal
        isOpen={approachModalState.isOpen}
        onClose={() => setApproachModalState({ ...approachModalState, isOpen: false })}
        companyName={approachModalState.companyName}
        approach={approachModalState.approach}
      />
    </div>
  );
}
