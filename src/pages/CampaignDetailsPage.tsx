import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../lib/auth-context';
import { 
  ArrowLeft, Megaphone, Users, Target, CheckCircle2,
  Calendar, CreditCard, MessageSquare, Plus, FileText,
  Mail, Image as ImageIcon, Copy, Smartphone, Sparkles, Loader2, Play, Package
} from 'lucide-react';

export function CampaignDetailsPage() {
  const { id } = useParams();
  const { business, token } = useAuth();
  const [campaign, setCampaign] = useState<any>(null);
  const [crmMetrics, setCrmMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview'); // overview, assets, results
  const [assetLoading, setAssetLoading] = useState(false);

  useEffect(() => {
    if (business && id && token) {
      loadCampaign();
      loadCrmMetrics();
    }
  }, [business, id, token]);

  const loadCrmMetrics = async () => {
    try {
      const res = await fetch(`/api/leads/campaign-metrics/${id}?businessId=${business?.id}`);
      if (res.ok) {
        setCrmMetrics(await res.json());
      }
    } catch (e) {
      console.error(e);
    }
  };

  const loadCampaign = async () => {
    try {
      const res = await fetch(`/api/campaigns/${id}?businessId=${business?.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setCampaign(await res.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    try {
      const res = await fetch(`/api/campaigns/${id}?businessId=${business?.id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        setCampaign({ ...campaign, status: newStatus });
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleGenerateAsset = async (type: string) => {
    setAssetLoading(true);
    try {
      const res = await fetch(`/api/campaigns/${id}/assets/generate?businessId=${business?.id}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ assetType: type })
      });
      if (res.ok) {
        const newAsset = await res.json();
        setCampaign({ ...campaign, assets: [newAsset, ...(campaign.assets || [])] });
        setActiveTab('assets');
      }
    } catch (e) {
      console.error(e);
      alert("Erro ao gerar material.");
    } finally {
      setAssetLoading(false);
    }
  };

  const handleSaveMetrics = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const data = {
      impressions: Number(formData.get('impressions')),
      clicks: Number(formData.get('clicks')),
      leads: Number(formData.get('leads')),
      sales: Number(formData.get('sales')),
      investmentSpent: Number(formData.get('investmentSpent')),
      revenueGenerated: Number(formData.get('revenueGenerated'))
    };

    try {
      const res = await fetch(`/api/campaigns/${id}?businessId=${business?.id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(data)
      });
      if (res.ok) {
        const updated = await res.json();
        setCampaign({ ...campaign, ...updated });
        alert("Resultados atualizados com sucesso!");
      }
    } catch (error) {
      console.error(error);
      alert("Erro ao salvar resultados.");
    }
  };

  const handleAddToCalendar = async (asset: any) => {
    try {
      const res = await fetch(`/api/campaigns/${id}/assets/${asset.id}/to-content?businessId=${business?.id}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ 
          date: new Date().toISOString().split('T')[0],
          channel: asset.channel || 'Desconhecido',
          format: asset.type
        })
      });
      if (res.ok) {
        alert("Material adicionado ao calendário de conteúdo com sucesso!");
      } else {
        alert("Erro ao enviar material para o calendário.");
      }
    } catch (e) {
      console.error(e);
      alert("Erro ao enviar material.");
    }
  };

  if (loading) return <div className="p-8 text-center text-slate-500">Carregando detalhes...</div>;
  if (!campaign) return <div className="p-8 text-center text-red-500">Campanha não encontrada.</div>;

  // Calculos de Métricas
  const ctr = campaign.impressions ? ((campaign.clicks / campaign.impressions) * 100).toFixed(2) : '0.00';
  const cpl = campaign.leads ? (campaign.investmentSpent / campaign.leads).toFixed(2) : '0.00';
  const cac = campaign.sales ? (campaign.investmentSpent / campaign.sales).toFixed(2) : '0.00';
  const roas = campaign.investmentSpent ? (campaign.revenueGenerated / campaign.investmentSpent).toFixed(2) : '0.00';
  const conversionRate = campaign.leads ? ((campaign.sales / campaign.leads) * 100).toFixed(2) : '0.00';

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20">
      {/* Header */}
      <div className="flex items-center gap-4 text-sm text-slate-500 mb-2">
        <Link to="/campaigns" className="hover:text-indigo-600 flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" />
          Voltar para Campanhas
        </Link>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col md:flex-row md:items-start justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-bold text-slate-900">{campaign.name}</h1>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium uppercase tracking-wider ${
              campaign.status === 'active' ? 'bg-green-100 text-green-700' :
              campaign.status === 'ready' ? 'bg-blue-100 text-blue-700' :
              'bg-slate-100 text-slate-600'
            }`}>
              {campaign.status}
            </span>
          </div>
          <p className="text-slate-600">{campaign.description}</p>
          
          <div className="flex flex-wrap gap-4 mt-4">
            <div className="flex items-center text-sm text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
              <Calendar className="w-4 h-4 mr-2 text-slate-400" />
              {campaign.startDate ? new Date(campaign.startDate).toLocaleDateString('pt-BR') : 'Sem data'} → {campaign.endDate ? new Date(campaign.endDate).toLocaleDateString('pt-BR') : 'Sem data'}
            </div>
            {campaign.budget && (
              <div className="flex items-center text-sm text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                <CreditCard className="w-4 h-4 mr-2 text-slate-400" />
                {campaign.budget}
              </div>
            )}
            <div className="flex items-center text-sm text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
              <Package className="w-4 h-4 mr-2 text-slate-400" />
              {campaign.product?.name || 'Institucional'}
            </div>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-3">
          {campaign.status !== 'active' && (
            <button 
              onClick={() => handleStatusChange('active')}
              className="bg-green-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-green-700 transition-colors flex items-center gap-2"
            >
              <Play className="w-4 h-4" />
              Ativar Campanha
            </button>
          )}
          {campaign.status === 'active' && (
            <button 
              onClick={() => handleStatusChange('paused')}
              className="bg-amber-100 text-amber-700 px-4 py-2 rounded-lg font-medium hover:bg-amber-200 transition-colors"
            >
              Pausar
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 space-x-8">
        <button 
          onClick={() => setActiveTab('overview')}
          className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'overview' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          Visão Geral
        </button>
        <button 
          onClick={() => setActiveTab('assets')}
          className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'assets' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          Materiais & Peças ({campaign.assets?.length || 0})
        </button>
        <button 
          onClick={() => setActiveTab('results')}
          className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'results' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          Resultados
        </button>
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        
        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Context Cards */}
            <div className="space-y-6">
              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <div className="flex items-center gap-2 font-semibold text-slate-900 mb-3">
                  <Target className="w-5 h-5 text-indigo-600" />
                  Público & Oferta
                </div>
                <div className="space-y-4">
                  <div>
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Perfil do Público</span>
                    <p className="text-sm text-slate-700">{campaign.targetAudience?.description || 'Não especificado'}</p>
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Proposta de Valor</span>
                    <p className="text-sm text-slate-700">{campaign.offer?.value_proposition || 'Não especificado'}</p>
                  </div>
                  {campaign.offer?.urgency && (
                    <div>
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Urgência / Prazo</span>
                      <p className="text-sm text-slate-700">{campaign.offer.urgency}</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <div className="flex items-center gap-2 font-semibold text-slate-900 mb-3">
                  <MessageSquare className="w-5 h-5 text-indigo-600" />
                  Mensagem Principal
                </div>
                <p className="text-lg font-medium text-slate-800 mb-4">{campaign.mainArgument}</p>
                <div className="space-y-2">
                  {campaign.messaging?.supporting_arguments?.map((arg: string, i: number) => (
                    <div key={i} className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                      <p className="text-sm text-slate-700">{arg}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Execution Plan */}
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="flex items-center gap-2 font-semibold text-slate-900 mb-4">
                <CheckCircle2 className="w-5 h-5 text-indigo-600" />
                Plano de Execução
              </div>
              <div className="space-y-3">
                {campaign.tasks?.map((task: any) => (
                  <div key={task.id} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
                    <input type="checkbox" className="mt-1 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300" defaultChecked={task.status === 'done'} />
                    <div>
                      <p className="text-sm font-medium text-slate-900">{task.title}</p>
                      {task.description && <p className="text-xs text-slate-500 mt-1">{task.description}</p>}
                    </div>
                  </div>
                ))}
                {(!campaign.tasks || campaign.tasks.length === 0) && (
                  <p className="text-sm text-slate-500">Nenhuma tarefa no plano.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ASSETS TAB */}
        {activeTab === 'assets' && (
          <div className="space-y-6">
            <div className="flex flex-wrap gap-3">
              <button onClick={() => handleGenerateAsset('ad')} disabled={assetLoading} className="bg-white border border-slate-200 hover:border-indigo-300 px-4 py-2 rounded-lg text-sm font-medium text-slate-700 flex items-center gap-2 transition-colors">
                {assetLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Megaphone className="w-4 h-4" />} Gerar Anúncios
              </button>
              <button onClick={() => handleGenerateAsset('social_post')} disabled={assetLoading} className="bg-white border border-slate-200 hover:border-indigo-300 px-4 py-2 rounded-lg text-sm font-medium text-slate-700 flex items-center gap-2 transition-colors">
                {assetLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />} Gerar Posts
              </button>
              <button onClick={() => handleGenerateAsset('landing_page')} disabled={assetLoading} className="bg-white border border-slate-200 hover:border-indigo-300 px-4 py-2 rounded-lg text-sm font-medium text-slate-700 flex items-center gap-2 transition-colors">
                {assetLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />} Estrutura de Landing Page
              </button>
              <button onClick={() => handleGenerateAsset('whatsapp')} disabled={assetLoading} className="bg-white border border-slate-200 hover:border-indigo-300 px-4 py-2 rounded-lg text-sm font-medium text-slate-700 flex items-center gap-2 transition-colors">
                {assetLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Smartphone className="w-4 h-4" />} Funil WhatsApp
              </button>
              <button onClick={() => handleGenerateAsset('email')} disabled={assetLoading} className="bg-white border border-slate-200 hover:border-indigo-300 px-4 py-2 rounded-lg text-sm font-medium text-slate-700 flex items-center gap-2 transition-colors">
                {assetLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />} E-mail Marketing
              </button>
              <button onClick={() => handleGenerateAsset('creative_brief')} disabled={assetLoading} className="bg-white border border-slate-200 hover:border-indigo-300 px-4 py-2 rounded-lg text-sm font-medium text-slate-700 flex items-center gap-2 transition-colors">
                {assetLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />} Briefing de Criativo
              </button>
            </div>

            {(!campaign.assets || campaign.assets.length === 0) ? (
              <div className="text-center p-12 bg-white rounded-xl border border-slate-200">
                <Sparkles className="w-12 h-12 text-indigo-200 mx-auto mb-3" />
                <h3 className="text-lg font-medium text-slate-900">Nenhum material gerado</h3>
                <p className="text-slate-500 mt-1">Utilize os botões acima para a IA redigir as peças da sua campanha.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {campaign.assets.map((asset: any) => (
                  <div key={asset.id} className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-md text-xs font-bold tracking-wider uppercase">
                          {asset.type.replace('_', ' ')}
                        </span>
                      </div>
                      <span className="text-xs text-slate-400">{new Date(asset.createdAt).toLocaleDateString('pt-BR')}</span>
                    </div>
                    <h4 className="font-bold text-slate-900 mb-3">{asset.title}</h4>
                    
                    <div className="text-sm text-slate-600 bg-slate-50 p-4 rounded-lg overflow-y-auto max-h-64 mb-4 whitespace-pre-wrap border border-slate-100 flex-1">
                      {typeof asset.content === 'object' ? JSON.stringify(asset.content, null, 2) : asset.content}
                    </div>

                    <div className="mt-auto border-t border-slate-100 pt-4 flex gap-2">
                      <button onClick={() => handleAddToCalendar(asset)} className="flex-1 bg-white border border-slate-300 text-slate-700 py-1.5 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">
                        Adicionar ao Calendário
                      </button>
                      <button className="bg-white border border-slate-300 text-slate-700 px-3 py-1.5 rounded-lg hover:bg-slate-50 transition-colors" title="Copiar texto">
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* RESULTS TAB */}
        {activeTab === 'results' && (
          <div className="space-y-6">
            {/* Seção CRM Auto-calculada */}
            {crmMetrics && (
              <div className="bg-gradient-to-br from-indigo-900 to-slate-900 text-white rounded-2xl p-6 shadow-md border border-indigo-700">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-4 border-b border-indigo-800">
                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-widest text-indigo-300 block">
                      Métricas em Tempo Real
                    </span>
                    <h3 className="text-lg font-bold">Métricas Calculadas pelo CRM</h3>
                  </div>
                  <Link
                    to={`/leads?campaignId=${campaign.id}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg transition-colors self-start sm:self-auto"
                  >
                    <Users className="w-3.5 h-3.5" />
                    Ver Leads Esta Campanha ({crmMetrics.leadsGenerated})
                  </Link>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="bg-white/10 p-3.5 rounded-xl border border-white/10">
                    <div className="text-xs text-indigo-200">Leads Gerados</div>
                    <div className="text-xl font-bold mt-1">{crmMetrics.leadsGenerated}</div>
                  </div>
                  <div className="bg-white/10 p-3.5 rounded-xl border border-white/10">
                    <div className="text-xs text-indigo-200">Clientes Convertidos</div>
                    <div className="text-xl font-bold text-emerald-400 mt-1">{crmMetrics.customersConverted}</div>
                  </div>
                  <div className="bg-white/10 p-3.5 rounded-xl border border-white/10">
                    <div className="text-xs text-indigo-200">Taxa de Conversão</div>
                    <div className="text-xl font-bold mt-1">{crmMetrics.conversionRate}%</div>
                  </div>
                  <div className="bg-white/10 p-3.5 rounded-xl border border-white/10">
                    <div className="text-xs text-indigo-200">Valor Potencial</div>
                    <div className="text-xl font-bold text-indigo-200 mt-1">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(crmMetrics.totalPotentialValue)}
                    </div>
                  </div>
                  <div className="bg-white/10 p-3.5 rounded-xl border border-white/10 col-span-2 md:col-span-1">
                    <div className="text-xs text-indigo-200">Receita Atribuída</div>
                    <div className="text-xl font-bold text-emerald-300 mt-1">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(crmMetrics.totalAttributedRevenue)}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <h3 className="text-base font-bold text-slate-800">Dados Registrados Manualmente</h3>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="bg-white border border-slate-200 p-4 rounded-xl">
                <div className="text-sm font-medium text-slate-500 mb-1">CTR</div>
                <div className="text-2xl font-bold text-slate-900">{ctr}%</div>
              </div>
              <div className="bg-white border border-slate-200 p-4 rounded-xl">
                <div className="text-sm font-medium text-slate-500 mb-1">CPL</div>
                <div className="text-2xl font-bold text-slate-900">R$ {cpl}</div>
              </div>
              <div className="bg-white border border-slate-200 p-4 rounded-xl">
                <div className="text-sm font-medium text-slate-500 mb-1">CAC</div>
                <div className="text-2xl font-bold text-slate-900">R$ {cac}</div>
              </div>
              <div className="bg-white border border-slate-200 p-4 rounded-xl">
                <div className="text-sm font-medium text-slate-500 mb-1">Conversão</div>
                <div className="text-2xl font-bold text-slate-900">{conversionRate}%</div>
              </div>
              <div className="bg-white border border-slate-200 p-4 rounded-xl">
                <div className="text-sm font-medium text-slate-500 mb-1">ROAS</div>
                <div className="text-2xl font-bold text-slate-900">{roas}x</div>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-6">
              <h3 className="text-lg font-bold text-slate-900 mb-4">Atualizar Resultados</h3>
              <form onSubmit={handleSaveMetrics} className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Impressões</label>
                  <input type="number" name="impressions" defaultValue={campaign.impressions} className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Cliques</label>
                  <input type="number" name="clicks" defaultValue={campaign.clicks} className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Leads (Cadastros)</label>
                  <input type="number" name="leads" defaultValue={campaign.leads} className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Vendas (Qtd)</label>
                  <input type="number" name="sales" defaultValue={campaign.sales} className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Investimento Gasto (R$)</label>
                  <input type="number" name="investmentSpent" defaultValue={campaign.investmentSpent} className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Receita Gerada (R$)</label>
                  <input type="number" name="revenueGenerated" defaultValue={campaign.revenueGenerated} className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div className="md:col-span-3 flex justify-end mt-2">
                  <button type="submit" className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-indigo-700 transition-colors">
                    Salvar Métricas
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
