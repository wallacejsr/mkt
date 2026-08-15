import { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth-context';
import { useNavigate, Link } from 'react-router-dom';
import {
  AlertCircle,
  TrendingUp,
  CalendarDays,
  Megaphone,
  ArrowRight,
  Briefcase,
  Users,
  Building2,
  DollarSign,
  CheckCircle2,
  FileText
} from 'lucide-react';

export function DashboardPage() {
  const { user, business, token } = useAuth();
  const navigate = useNavigate();

  const [topAttention, setTopAttention] = useState<any[]>([]);
  const [topOpportunities, setTopOpportunities] = useState<any[]>([]);
  const [todaysContent, setTodaysContent] = useState<any[]>([]);
  const [activeCampaigns, setActiveCampaigns] = useState<any[]>([]);
  const [pipelineSummary, setPipelineSummary] = useState<any>(null);
  const [prospectStats, setProspectStats] = useState<{ newCount: number; qualifiedCount: number; importedCount: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token || !business) return;

    loadDashboardData();
  }, [token, business]);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      // 1. Recommendations via Engine
      const recsRes = await fetch(`/api/recommendations?businessId=${business?.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (recsRes.ok) {
        const allRecs = await recsRes.json();
        // Atenção necessária: top 3
        setTopAttention(allRecs.slice(0, 3));
        // Oportunidades: top 2 starting from index 3 or filter by category 'opportunity'
        const opps = allRecs.filter((r: any) => r.category === 'opportunity' || r.type === 'many_proposals' || r.type === 'pipeline_at_risk');
        setTopOpportunities(opps.length > 0 ? opps.slice(0, 2) : allRecs.slice(3, 5));
      }

      // 2. Today's Content
      const contentRes = await fetch(`/api/content/today?businessId=${business?.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (contentRes.ok) {
        setTodaysContent(await contentRes.json());
      }

      // 3. Active Campaigns
      const campRes = await fetch(`/api/campaigns?businessId=${business?.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (campRes.ok) {
        const camps = await campRes.json();
        setActiveCampaigns(camps.filter((c: any) => c.status === 'active' || c.status === 'ready').slice(0, 2));
      }

      // 4. Pipeline Summary
      const summaryRes = await fetch(`/api/leads/summary?businessId=${business?.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (summaryRes.ok) {
        setPipelineSummary(await summaryRes.json());
      }

      // 5. Prospecting Stats
      const prospectRes = await fetch(`/api/prospecting/prospects?businessId=${business?.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (prospectRes.ok) {
        const data = await prospectRes.json();
        const list = data.prospects || [];
        if (list.length > 0) {
          setProspectStats({
            newCount: list.filter((p: any) => p.status === 'new').length,
            qualifiedCount: list.filter((p: any) => p.status === 'qualified').length,
            importedCount: list.filter((p: any) => p.status === 'imported').length,
          });
        }
      }
    } catch (e) {
      console.error("Dashboard Load Error:", e);
    } finally {
      setLoading(false);
    }
  };

  const getUserFirstName = () => {
    if (user?.name) return user.name.split(' ')[0];
    if (user?.email) return user.email.split('@')[0];
    return 'Usuário';
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(val || 0);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-12">
      {/* Header */}
      <header className="border-b border-slate-200/80 pb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Bom dia, {getUserFirstName()}.
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Aqui está o que merece sua atenção hoje.
          </p>
        </div>

        {/* Compact Results Banner */}
        <div className="bg-indigo-50 border border-indigo-100 p-3.5 rounded-2xl flex items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600 text-white rounded-xl">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div className="text-xs">
              <span className="font-bold text-indigo-900 block">Resultados (Este mês)</span>
              <span className="text-slate-600 font-medium">
                {pipelineSummary?.newCount || 0} leads · {pipelineSummary?.customerCount || 0} clientes
              </span>
            </div>
          </div>
          <Link
            to="/analytics"
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl transition-colors whitespace-nowrap shadow-sm"
          >
            Ver Analytics →
          </Link>
        </div>
      </header>

      {/* Grid Principal */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Coluna Esquerda: Recomendações Principais & Oportunidades */}
        <div className="lg:col-span-2 space-y-8">
          {/* Seção 1: Atenção Necessária */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-rose-100 text-rose-700 rounded-lg">
                  <AlertCircle className="w-4 h-4" />
                </div>
                <h2 className="text-base font-bold text-slate-900">Atenção Necessária</h2>
              </div>
              <Link
                to="/opportunities"
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
              >
                Ver todas
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {topAttention.length > 0 ? (
              <div className="space-y-3">
                {topAttention.map(rec => (
                  <div
                    key={rec.id}
                    className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors hover:border-slate-300 hover:bg-white"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded ${
                          rec.priority === 'critical'
                            ? 'bg-rose-100 text-rose-800'
                            : rec.priority === 'high'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {rec.priority}
                        </span>
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{rec.category}</span>
                      </div>
                      <h3 className="text-sm font-bold text-slate-900">{rec.title}</h3>
                      <p className="text-xs text-slate-600">{rec.description}</p>
                    </div>

                    {rec.actionUrl && (
                      <button
                        onClick={() => navigate(rec.actionUrl)}
                        className="self-start sm:self-auto px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold transition-colors shrink-0 shadow-sm"
                      >
                        Ação
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500 text-sm">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                Excelente! Nenhuma pendência crítica identificada no momento.
              </div>
            )}
          </div>

          {/* Seção 2: Oportunidades */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg">
                  <TrendingUp className="w-4 h-4" />
                </div>
                <h2 className="text-base font-bold text-slate-900">Oportunidades</h2>
              </div>
              <Link
                to="/opportunities"
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
              >
                Ver feed completo
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {topOpportunities.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {topOpportunities.map(opp => (
                  <div
                    key={opp.id}
                    className="p-4 rounded-xl border border-emerald-200/80 bg-emerald-50/20 flex flex-col justify-between space-y-3"
                  >
                    <div>
                      <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block mb-1">
                        Oportunidade
                      </span>
                      <h3 className="text-sm font-bold text-slate-900">{opp.title}</h3>
                      <p className="text-xs text-slate-600 mt-1 line-clamp-2">{opp.description}</p>
                    </div>

                    {opp.actionUrl && (
                      <button
                        onClick={() => navigate(opp.actionUrl)}
                        className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 hover:text-emerald-900 pt-2 border-t border-emerald-100"
                      >
                        Ver oportunidade
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic py-4">
                Mantenha seu pipeline atualizado para descobrir novas oportunidades de fechamento.
              </p>
            )}
          </div>

          {/* Seção 3: Seu Marketing Hoje */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-900">Seu Marketing Hoje</h2>
              <span className="text-xs text-slate-400">Conteúdo & Campanhas</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Conteúdo Hoje */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <CalendarDays className="w-4 h-4 text-indigo-600" />
                  Conteúdo do Dia
                </h3>
                {todaysContent.length > 0 ? (
                  todaysContent.map(item => (
                    <div key={item.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-bold uppercase text-indigo-600">{item.channel}</span>
                        <span className="text-[10px] bg-slate-200 px-1.5 py-0.5 rounded text-slate-700">{item.status}</span>
                      </div>
                      <p className="text-xs font-bold text-slate-900 truncate">{item.title}</p>
                      <button
                        onClick={() => navigate(`/content/${item.id}`)}
                        className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 mt-2 block"
                      >
                        Abrir conteúdo →
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-500">
                    Nenhum conteúdo agendado para hoje.
                    <button
                      onClick={() => navigate('/content')}
                      className="block text-indigo-600 font-semibold mt-1"
                    >
                      Planejar conteúdo →
                    </button>
                  </div>
                )}
              </div>

              {/* Campanha Ativa */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Megaphone className="w-4 h-4 text-purple-600" />
                  Campanhas Ativas
                </h3>
                {activeCampaigns.length > 0 ? (
                  activeCampaigns.map(camp => (
                    <div key={camp.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-bold uppercase text-purple-600">Ativa</span>
                        {camp.endDate && <span className="text-[10px] text-slate-500">Fim: {camp.endDate}</span>}
                      </div>
                      <p className="text-xs font-bold text-slate-900 truncate">{camp.name}</p>
                      <button
                        onClick={() => navigate(`/campaigns/${camp.id}`)}
                        className="text-[11px] font-semibold text-purple-600 hover:text-purple-800 mt-2 block"
                      >
                        Ver detalhes →
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-500">
                    Nenhuma campanha ativa no momento.
                    <button
                      onClick={() => navigate('/campaigns/new')}
                      className="block text-purple-600 font-semibold mt-1"
                    >
                      Criar campanha →
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Coluna Direita: Pipeline Summary */}
        <div className="space-y-6">
          <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-md border border-slate-800">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-indigo-400" />
                <h2 className="text-base font-bold">Resumo do Pipeline</h2>
              </div>
              <Link
                to="/leads"
                className="text-xs text-indigo-300 hover:text-white font-medium flex items-center gap-1"
              >
                Abrir CRM
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            {pipelineSummary ? (
              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white/10 p-3 rounded-xl border border-white/10">
                    <div className="text-[10px] text-slate-400 uppercase font-bold">Novos Leads</div>
                    <div className="text-xl font-extrabold mt-0.5 text-white">{pipelineSummary.newCount}</div>
                  </div>
                  <div className="bg-white/10 p-3 rounded-xl border border-white/10">
                    <div className="text-[10px] text-slate-400 uppercase font-bold">Em Negociação</div>
                    <div className="text-xl font-extrabold mt-0.5 text-amber-300">{pipelineSummary.inNegotiationCount}</div>
                  </div>
                  <div className="bg-white/10 p-3 rounded-xl border border-white/10">
                    <div className="text-[10px] text-slate-400 uppercase font-bold">Propostas</div>
                    <div className="text-xl font-extrabold mt-0.5 text-indigo-300">{pipelineSummary.proposalCount}</div>
                  </div>
                  <div className="bg-white/10 p-3 rounded-xl border border-white/10">
                    <div className="text-[10px] text-slate-400 uppercase font-bold">Clientes</div>
                    <div className="text-xl font-extrabold mt-0.5 text-emerald-400">{pipelineSummary.customerCount}</div>
                  </div>
                </div>

                <div className="bg-indigo-950/60 p-4 rounded-xl border border-indigo-800/50 space-y-2">
                  <div className="flex items-center justify-between text-xs text-indigo-200">
                    <span>Valor Potencial do Funil</span>
                    <DollarSign className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="text-2xl font-black text-emerald-300">
                    {formatCurrency(pipelineSummary.totalPotentialValue)}
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Total em potencial acumulado nos leads em aberto.
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400 py-4">Carregando métricas do funil...</p>
            )}
          </div>

          {/* Card Prospecção B2B (exibido somente se houver dados) */}
          {prospectStats && (
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-indigo-600" />
                  <h2 className="text-base font-bold text-slate-900">Prospecção B2B</h2>
                </div>
                <Link
                  to="/prospecting"
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                >
                  Ver prospecção
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <span className="block font-extrabold text-slate-800 text-base">{prospectStats.newCount}</span>
                  <span className="text-[10px] text-slate-400">Novos</span>
                </div>
                <div className="bg-emerald-50/50 p-2.5 rounded-xl border border-emerald-100">
                  <span className="block font-extrabold text-emerald-700 text-base">{prospectStats.qualifiedCount}</span>
                  <span className="text-[10px] text-emerald-800">Qualificados</span>
                </div>
                <div className="bg-blue-50/50 p-2.5 rounded-xl border border-blue-100">
                  <span className="block font-extrabold text-blue-700 text-base">{prospectStats.importedCount}</span>
                  <span className="text-[10px] text-blue-800">No CRM</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
