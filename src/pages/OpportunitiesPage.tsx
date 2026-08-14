import React, { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth-context';
import { Link } from 'react-router-dom';
import {
  Sparkles,
  AlertTriangle,
  TrendingUp,
  FileText,
  Megaphone,
  Target,
  ArrowRight,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Filter,
  Info,
  Clock,
  DollarSign,
  Briefcase
} from 'lucide-react';

export function OpportunitiesPage() {
  const { business, token } = useAuth();
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [insights, setInsights] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [activeCategory, setActiveCategory] = useState('all');
  const [activeStatus, setActiveStatus] = useState('active');
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    if (business && token) {
      loadData();
    }
  }, [business, token, activeCategory, activeStatus]);

  const loadData = async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams({
        businessId: business?.id || '',
        category: activeCategory,
        status: activeStatus
      });

      const [recsRes, sumRes] = await Promise.all([
        fetch(`/api/recommendations?${queryParams.toString()}`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`/api/recommendations/summary?businessId=${business?.id}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      if (recsRes.ok) {
        setRecommendations(await recsRes.json());
      }
      if (sumRes.ok) {
        setSummary(await sumRes.json());
      }
    } catch (e) {
      console.error("Error loading opportunities:", e);
    } finally {
      setLoading(false);
    }
  };

  const loadAiInsights = async () => {
    setInsightsLoading(true);
    try {
      const res = await fetch(`/api/recommendations/insights?businessId=${business?.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setInsights(data.insights || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setInsightsLoading(false);
    }
  };

  const handleDismiss = async (id: string) => {
    setProcessingId(id);
    try {
      const res = await fetch(`/api/recommendations/${id}/dismiss?businessId=${business?.id}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setRecommendations(prev => prev.filter(r => r.id !== id));
        loadData();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setProcessingId(null);
    }
  };

  const handleComplete = async (id: string) => {
    setProcessingId(id);
    try {
      const res = await fetch(`/api/recommendations/${id}/complete?businessId=${business?.id}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setRecommendations(prev => prev.filter(r => r.id !== id));
        loadData();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setProcessingId(null);
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'critical':
        return <span className="px-2.5 py-1 text-xs font-bold bg-rose-100 text-rose-800 rounded-full uppercase tracking-wider">Crítica</span>;
      case 'high':
        return <span className="px-2.5 py-1 text-xs font-bold bg-amber-100 text-amber-800 rounded-full uppercase tracking-wider">Alta</span>;
      case 'medium':
        return <span className="px-2.5 py-1 text-xs font-bold bg-blue-100 text-blue-800 rounded-full uppercase tracking-wider">Média</span>;
      default:
        return <span className="px-2.5 py-1 text-xs font-bold bg-slate-100 text-slate-700 rounded-full uppercase tracking-wider">Baixa</span>;
    }
  };

  const getImpactBadge = (impact: string) => {
    switch (impact) {
      case 'high':
        return <span className="text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">Impacto Alto</span>;
      case 'medium':
        return <span className="text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">Impacto Médio</span>;
      default:
        return <span className="text-xs font-medium text-slate-600 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded">Impacto Baixo</span>;
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'sales':
        return <Briefcase className="w-4 h-4 text-emerald-600" />;
      case 'content':
        return <FileText className="w-4 h-4 text-indigo-600" />;
      case 'campaign':
        return <Megaphone className="w-4 h-4 text-purple-600" />;
      case 'strategy':
        return <Target className="w-4 h-4 text-amber-600" />;
      default:
        return <TrendingUp className="w-4 h-4 text-indigo-600" />;
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Oportunidades & Recomendações</h1>
          <p className="text-sm text-slate-500 mt-1">
            Ações e oportunidades identificadas a partir dos dados do seu negócio.
          </p>
        </div>
        <button
          onClick={loadData}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-semibold rounded-xl transition-colors shadow-sm self-start sm:self-auto"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
          Atualizar Dados
        </button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 text-rose-600 text-xs font-bold uppercase tracking-wider mb-2">
              <AlertTriangle className="w-4 h-4" />
              Atenção Necessária
            </div>
            <div className="text-2xl font-extrabold text-slate-900">{summary.attentionNeeded}</div>
            <div className="text-xs text-slate-500 mt-1">Recomendações de alta prioridade</div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 text-emerald-600 text-xs font-bold uppercase tracking-wider mb-2">
              <TrendingUp className="w-4 h-4" />
              Oportunidades
            </div>
            <div className="text-2xl font-extrabold text-slate-900">{summary.opportunities}</div>
            <div className="text-xs text-slate-500 mt-1">Ações de alavancagem comercial</div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 text-indigo-600 text-xs font-bold uppercase tracking-wider mb-2">
              <FileText className="w-4 h-4" />
              Conteúdo
            </div>
            <div className="text-2xl font-extrabold text-slate-900">{summary.contentCount}</div>
            <div className="text-xs text-slate-500 mt-1">Gargalos ou vácuos de pauta</div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 text-purple-600 text-xs font-bold uppercase tracking-wider mb-2">
              <Megaphone className="w-4 h-4" />
              Campanhas
            </div>
            <div className="text-2xl font-extrabold text-slate-900">{summary.campaignCount}</div>
            <div className="text-xs text-slate-500 mt-1">Tarefas e prazos de campanhas</div>
          </div>
        </div>
      )}

      {/* Optional Strategic Insights Section */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-6 text-white shadow-md border border-indigo-900/50">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 pb-4 border-b border-indigo-900/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-500/20 rounded-xl border border-indigo-400/30 text-indigo-300">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Insights Estratégicos Inteligentes</h3>
              <p className="text-xs text-indigo-200 mt-0.5">Visão executiva sintetizada a partir dos dados consolidados do seu negócio</p>
            </div>
          </div>

          <button
            onClick={loadAiInsights}
            disabled={insightsLoading}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl transition-colors self-start sm:self-auto"
          >
            <Sparkles className={`w-3.5 h-3.5 ${insightsLoading ? 'animate-spin' : ''}`} />
            {insights.length > 0 ? 'Gerar Novamente' : 'Gerar Insights Estratégicos'}
          </button>
        </div>

        {insights.length > 0 ? (
          <div className="space-y-2.5">
            {insights.map((insight, idx) => (
              <div key={idx} className="flex items-start gap-3 bg-white/5 border border-white/10 p-3.5 rounded-xl text-sm text-indigo-100">
                <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                <span>{insight}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-indigo-300 italic">
            Clique no botão acima para sintetizar 3 diretrizes executivas com base no seu objetivo, pipeline e histórico recente.
          </p>
        )}
      </div>

      {/* Filters & Status Tabs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        {/* Category Tabs */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider mr-2 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> Categoria:
          </span>
          {[
            { id: 'all', label: 'Todas' },
            { id: 'sales', label: 'Vendas' },
            { id: 'content', label: 'Conteúdo' },
            { id: 'campaign', label: 'Campanhas' },
            { id: 'strategy', label: 'Estratégia' },
            { id: 'opportunity', label: 'Oportunidades' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveCategory(tab.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                activeCategory === tab.id
                  ? 'bg-indigo-600 text-white shadow-sm font-semibold'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-1.5 border-t md:border-t-0 pt-3 md:pt-0 border-slate-100">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider mr-1">Status:</span>
          {[
            { id: 'active', label: 'Ativas' },
            { id: 'completed', label: 'Concluídas' },
            { id: 'dismissed', label: 'Dispensadas' },
          ].map(st => (
            <button
              key={st.id}
              onClick={() => setActiveStatus(st.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                activeStatus === st.id
                  ? 'bg-slate-900 text-white font-semibold'
                  : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>
      </div>

      {/* Feed List */}
      {loading ? (
        <div className="p-12 text-center text-slate-500">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-600" />
          Analisando dados do negócio e calculando recomendações...
        </div>
      ) : recommendations.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3 shadow-sm">
          <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
          <h3 className="text-lg font-bold text-slate-800">Nenhuma recomendação nesta categoria</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            {activeStatus === 'active'
              ? 'Tudo em dia! Não identificamos pendências ou gargalos críticos no momento.'
              : 'Nenhum item encontrado no histórico selecionado.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {recommendations.map(rec => (
            <div
              key={rec.id}
              className={`bg-white rounded-2xl border p-5 shadow-sm transition-all hover:shadow-md ${
                rec.priority === 'critical'
                  ? 'border-rose-200 bg-rose-50/10'
                  : rec.priority === 'high'
                  ? 'border-amber-200'
                  : 'border-slate-200'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="space-y-2 flex-1">
                  {/* Badges Bar */}
                  <div className="flex flex-wrap items-center gap-2">
                    {getPriorityBadge(rec.priority)}
                    {getImpactBadge(rec.impact)}
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-medium text-slate-600 bg-slate-100 rounded-md capitalize">
                      {getCategoryIcon(rec.category)}
                      {rec.category}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">
                      Score: {rec.priorityScore}/100
                    </span>
                  </div>

                  {/* Title & Description */}
                  <div>
                    <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                      {rec.title}
                    </h3>
                    <p className="text-sm text-slate-600 mt-1 leading-relaxed">
                      {rec.description}
                    </p>
                  </div>

                  {/* Reason & Value */}
                  {rec.reason && (
                    <div className="text-xs text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-100 flex items-start gap-2">
                      <Info className="w-3.5 h-3.5 text-indigo-500 shrink-0 mt-0.5" />
                      <span><strong className="text-slate-700">Por que agir:</strong> {rec.reason}</span>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex sm:flex-col items-center sm:items-end gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                  {rec.actionUrl && (
                    <Link
                      to={rec.actionUrl}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl transition-colors shadow-sm w-full sm:w-auto justify-center"
                    >
                      Executar Ação
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  )}

                  {rec.status === 'active' && (
                    <div className="flex items-center gap-1 w-full sm:w-auto justify-end">
                      <button
                        onClick={() => handleComplete(rec.id)}
                        disabled={processingId === rec.id}
                        title="Marcar como Concluída"
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Concluir
                      </button>
                      <button
                        onClick={() => handleDismiss(rec.id)}
                        disabled={processingId === rec.id}
                        title="Dispensar"
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        Dispensar
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
