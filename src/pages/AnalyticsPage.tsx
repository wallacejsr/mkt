import React, { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth-context';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Users,
  DollarSign,
  Briefcase,
  Megaphone,
  CalendarDays,
  Download,
  Sparkles,
  RefreshCw,
  Filter,
  AlertTriangle,
  Info,
  Clock,
  PieChart as PieChartIcon,
  HelpCircle,
  ArrowRight
} from 'lucide-react';

export function AnalyticsPage() {
  const { business, token } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('30d');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [comparePrevious, setComparePrevious] = useState(true);
  const [aiInsights, setAiInsights] = useState<any[]>([]);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    if (business && token) {
      loadAnalytics();
    }
  }, [business, token, period, comparePrevious]);

  const loadAnalytics = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const queryParams = new URLSearchParams({
        businessId: business?.id || '',
        period,
        comparePrevious: comparePrevious ? 'true' : 'false'
      });

      if (period === 'custom' && customStart && customEnd) {
        queryParams.append('customStart', customStart);
        queryParams.append('customEnd', customEnd);
      }

      const res = await fetch(`/api/analytics/overview?${queryParams.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        const json = await res.json();
        setData(json);
      } else {
        const error = await res.json().catch(() => null);
        setData(null);
        setLoadError(error?.error || `Não foi possível carregar o Analytics (${res.status}).`);
      }
    } catch (e) {
      console.error("Failed to load analytics:", e);
      setData(null);
      setLoadError('Não foi possível conectar ao servidor de Analytics.');
    } finally {
      setLoading(false);
    }
  };

  const handleExportCsv = () => {
    if (!token || !business) return;
    fetch(`/api/analytics/export?businessId=${business.id}&period=${period}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(async response => {
        if (!response.ok) throw new Error('Falha ao exportar o relatório.');
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `analytics_${period}.csv`;
        link.click();
        URL.revokeObjectURL(url);
      })
      .catch(error => setLoadError(error.message));
  };

  const loadAiInsights = async () => {
    setInsightsLoading(true);
    try {
      const res = await fetch(`/api/analytics/insights?businessId=${business?.id}&period=${period}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const json = await res.json();
        setAiInsights(json.insights || []);
      }
    } catch (e) {
      console.error("AI Insights Error:", e);
    } finally {
      setInsightsLoading(false);
    }
  };

  const formatCurrency = (val: number | null | undefined) => {
    if (val === null || val === undefined) return "R$ 0,00";
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const formatChange = (change: number | null | undefined) => {
    if (change === null || change === undefined) {
      return <span className="text-slate-400 text-xs font-normal">Sem base de comparação</span>;
    }
    const isPositive = change >= 0;
    return (
      <span className={`inline-flex items-center gap-0.5 text-xs font-bold ${isPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
        {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
        {Math.abs(change).toFixed(1)}% vs. anterior
      </span>
    );
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-slate-500">
        <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-indigo-600" />
        <p className="text-sm font-medium">Carregando inteligência e métricas agregadas...</p>
      </div>
    );
  }

  if (loadError && !data) {
    return (
      <div className="p-12 max-w-xl mx-auto text-center">
        <AlertTriangle className="w-10 h-10 mx-auto mb-3 text-amber-500" />
        <h1 className="text-lg font-bold text-slate-900">Analytics indisponível</h1>
        <p className="text-sm text-slate-500 mt-2">{loadError}</p>
        <button onClick={loadAnalytics} className="mt-5 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl">
          Tentar novamente
        </button>
      </div>
    );
  }

  const { overview, pipeline, lostReasons, campaigns, channels, contentExecution, timeline } = data || {};

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 pb-16">
      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Analytics</h1>
          <p className="text-sm text-slate-500 mt-1">
            Entenda o desempenho do seu marketing e das suas vendas com dados reais.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Period Selector */}
          <div className="inline-flex items-center bg-white border border-slate-200 rounded-xl p-1 shadow-sm text-xs font-medium">
            {[
              { id: '7d', label: '7 dias' },
              { id: '30d', label: '30 dias' },
              { id: '90d', label: '90 dias' },
              { id: 'this_month', label: 'Este mês' },
              { id: 'last_month', label: 'Mês passado' },
              { id: 'custom', label: 'Personalizado' },
            ].map(p => (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id)}
                className={`px-3 py-1.5 rounded-lg transition-colors ${
                  period === p.id
                    ? 'bg-indigo-600 text-white font-semibold shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Custom Date Inputs if custom selected */}
          {period === 'custom' && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={customStart}
                onChange={e => setCustomStart(e.target.value)}
                className="text-xs p-1.5 border border-slate-200 rounded-lg bg-white"
              />
              <span className="text-xs text-slate-400">até</span>
              <input
                type="date"
                value={customEnd}
                onChange={e => setCustomEnd(e.target.value)}
                className="text-xs p-1.5 border border-slate-200 rounded-lg bg-white"
              />
              <button
                onClick={loadAnalytics}
                className="px-2.5 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded-lg"
              >
                Filtrar
              </button>
            </div>
          )}

          {/* Compare Toggle */}
          <button
            onClick={() => setComparePrevious(!comparePrevious)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border transition-colors ${
              comparePrevious
                ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            Comparar período
          </button>

          {/* Export Button */}
          <button
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition-colors shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            Exportar CSV
          </button>
        </div>
      </div>

      {/* 1. Visão Geral — 6 Indicadores Principais */}
      <section className="space-y-4">
        <h2 className="text-base font-bold text-slate-900">Visão geral</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {/* Leads */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Leads</div>
            <div className="text-2xl font-black text-slate-900">{overview?.totalLeads || 0}</div>
            <div>{formatChange(overview?.changes?.leads)}</div>
          </div>

          {/* Clientes */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Clientes</div>
            <div className="text-2xl font-black text-emerald-600">{overview?.totalCustomers || 0}</div>
            <div>{formatChange(overview?.changes?.customers)}</div>
          </div>

          {/* Taxa de Conversão */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Taxa de Conversão</div>
            <div className="text-2xl font-black text-indigo-600">
              {(overview?.conversionRate || 0).toFixed(1)}%
            </div>
            <div>{formatChange(overview?.changes?.conversionRate)}</div>
          </div>

          {/* Receita Atribuída */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Receita Atribuída</div>
            <div className="text-xl font-black text-slate-900 truncate">
              {formatCurrency(overview?.attributedRevenue)}
            </div>
            <div>{formatChange(overview?.changes?.revenue)}</div>
          </div>

          {/* Valor em Pipeline */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Em Pipeline</div>
            <div className="text-xl font-black text-amber-600 truncate">
              {formatCurrency(overview?.potentialPipelineValue)}
            </div>
            <div className="text-[11px] text-slate-400">Potencial ativo</div>
          </div>

          {/* Investimento */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Investimento</div>
            <div className="text-xl font-black text-slate-900 truncate">
              {formatCurrency(overview?.totalInvestment)}
            </div>
            <div className="text-[11px] text-slate-400">Soma de orçamentos</div>
          </div>
        </div>

        {/* CAC / CPL / ROAS Badges if available */}
        <div className="flex flex-wrap gap-4 text-xs bg-slate-50 p-4 rounded-xl border border-slate-200">
          <div className="flex items-center gap-1.5">
            <strong className="text-slate-700">CPL (Custo por Lead):</strong>
            {overview?.cpl !== null ? (
              <span className="font-bold text-slate-900">{formatCurrency(overview?.cpl)}</span>
            ) : (
              <span className="text-slate-400 italic">Ainda não há dados suficientes para calcular o CPL</span>
            )}
          </div>
          <span className="text-slate-300">|</span>
          <div className="flex items-center gap-1.5">
            <strong className="text-slate-700">CAC (Custo por Cliente):</strong>
            {overview?.cac !== null ? (
              <span className="font-bold text-slate-900">{formatCurrency(overview?.cac)}</span>
            ) : (
              <span className="text-slate-400 italic">Ainda não há dados suficientes para calcular o CAC</span>
            )}
          </div>
          <span className="text-slate-300">|</span>
          <div className="flex items-center gap-1.5">
            <strong className="text-slate-700">ROAS (Retorno em Anúncios):</strong>
            {overview?.roas !== null ? (
              <span className="font-bold text-emerald-700">{overview?.roas.toFixed(2)}x</span>
            ) : (
              <span className="text-slate-400 italic">Ainda não há dados suficientes para calcular o ROAS</span>
            )}
          </div>
        </div>
      </section>

      {/* 2. Série Temporal — Tendência Temporal */}
      <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">Evolução Temporal</h2>
            <p className="text-xs text-slate-500">Leads e conversões gerados diariamente no período</p>
          </div>
        </div>

        {timeline && timeline.length > 0 ? (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timeline} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorCustomers" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', color: '#fff', fontSize: '12px' }}
                />
                <Area type="monotone" dataKey="leads" name="Leads" stroke="#4f46e5" fillOpacity={1} fill="url(#colorLeads)" />
                <Area type="monotone" dataKey="customers" name="Clientes" stroke="#10b981" fillOpacity={1} fill="url(#colorCustomers)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="py-12 text-center text-xs text-slate-400">Sem dados temporais suficientes para o gráfico</div>
        )}
      </section>

      {/* 3. Funil de Vendas & Motivos de Perda */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Funil de Vendas */}
        <section className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">Funil de Vendas</h2>
              <p className="text-xs text-slate-500">Distribuição atual de leads por estágio no pipeline</p>
            </div>
            {pipeline?.avgConversionTimeDays != null && (
              <div className="flex items-center gap-1.5 bg-indigo-50 px-3 py-1.5 rounded-xl border border-indigo-100 text-xs text-indigo-700 font-semibold">
                <Clock className="w-3.5 h-3.5" />
                Tempo médio até venda: {pipeline.avgConversionTimeDays.toFixed(1)} dias
              </div>
            )}
          </div>

          <div className="space-y-3">
            {[
              { key: 'new', label: 'Novo Lead', color: 'bg-blue-500' },
              { key: 'contacted', label: 'Contatado', color: 'bg-indigo-500' },
              { key: 'interested', label: 'Interessado', color: 'bg-purple-500' },
              { key: 'proposal', label: 'Proposta Enviada', color: 'bg-amber-500' },
              { key: 'customer', label: 'Cliente Convertido', color: 'bg-emerald-500' },
              { key: 'lost', label: 'Perdido', color: 'bg-rose-400' },
            ].map(st => {
              const stageData = pipeline?.stages?.[st.key] || { count: 0, value: 0 };
              const totalAll = Object.values(pipeline?.stages || {}).reduce((sum: number, s: any) => sum + s.count, 0) || 1;
              const widthPct = Math.max(8, (stageData.count / (totalAll as number)) * 100);

              return (
                <div key={st.key} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700">{st.label}</span>
                    <span className="text-slate-500">
                      <strong>{stageData.count}</strong> leads · {formatCurrency(stageData.value)}
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${st.color} transition-all duration-500 rounded-full`}
                      style={{ width: `${widthPct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Motivos de Perda */}
        <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-base font-bold text-slate-900">Motivos de Perda</h2>
            <p className="text-xs text-slate-500">Onde estamos perdendo oportunidades</p>
          </div>

          {lostReasons && lostReasons.length > 0 ? (
            <div className="space-y-3">
              {lostReasons.map((lr: any, idx: number) => (
                <div key={idx} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-700">{lr.reason}</span>
                    <span className="font-bold text-slate-900">{lr.percentage.toFixed(1)}% ({lr.count})</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-rose-500 h-full rounded-full"
                      style={{ width: `${Math.max(4, lr.percentage)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center text-xs text-slate-400">
              Nenhum lead marcado como perdido até o momento.
            </div>
          )}
        </section>
      </div>

      {/* 4. Performance das Campanhas (CRM vs Manual) */}
      <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">Performance das Campanhas</h2>
            <p className="text-xs text-slate-500">
              Comparação entre dados reais do CRM e informados manualmente
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="inline-flex items-center gap-1 text-slate-600">
              <span className="w-2 h-2 rounded-full bg-indigo-600"></span> Dados do CRM
            </span>
            <span className="inline-flex items-center gap-1 text-slate-600">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span> Informados Manualmente
            </span>
          </div>
        </div>

        {campaigns && campaigns.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase font-semibold text-[10px] border-b border-slate-200">
                <tr>
                  <th className="p-3">Campanha</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Investimento</th>
                  <th className="p-3">Leads (CRM / Manual)</th>
                  <th className="p-3">Clientes (CRM)</th>
                  <th className="p-3">Conversão</th>
                  <th className="p-3">Receita Atribuída</th>
                  <th className="p-3">ROAS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {campaigns.map((c: any) => (
                  <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3 font-bold text-slate-900">{c.name}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-700">
                        {c.status}
                      </span>
                    </td>
                    <td className="p-3 font-medium">{formatCurrency(c.investment)}</td>
                    <td className="p-3">
                      <span className="font-bold text-indigo-700">{c.crm.leads}</span>
                      {c.manual.leads !== null && (
                        <span className={`ml-1 text-[11px] ${c.hasDiscrepancy ? 'text-amber-600 font-bold' : 'text-slate-400'}`}>
                          / {c.manual.leads} {c.hasDiscrepancy && '(Divergente)'}
                        </span>
                      )}
                    </td>
                    <td className="p-3 font-bold text-emerald-600">{c.crm.customers}</td>
                    <td className="p-3 font-medium">{c.crm.conversionRate.toFixed(1)}%</td>
                    <td className="p-3 font-bold text-slate-900">{formatCurrency(c.crm.revenue)}</td>
                    <td className="p-3">
                      {c.crm.roas !== null ? (
                        <span className="font-bold text-emerald-700">{c.crm.roas.toFixed(2)}x</span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-8 text-center text-xs text-slate-400">
            Nenhuma campanha cadastrada para o período selecionado.
          </div>
        )}
      </section>

      {/* 5. Canais de Aquisição (Origem de Leads) */}
      <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="border-b border-slate-100 pb-3">
          <h2 className="text-base font-bold text-slate-900">Canais & Origens de Leads</h2>
          <p className="text-xs text-slate-500">De onde vêm os seus leads e onde ocorrem as vendas</p>
        </div>

        {channels && channels.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={channels} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="channel" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                  <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', color: '#fff', fontSize: '12px' }} />
                  <Bar dataKey="leads" name="Leads" fill="#4f46e5" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="customers" name="Clientes" fill="#10b981" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="space-y-2">
              {channels.map((ch: any, idx: number) => (
                <div key={idx} className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between text-xs">
                  <div>
                    <strong className="text-slate-900">{ch.channel}</strong>
                    <div className="text-slate-500 text-[11px]">
                      {ch.leads} leads · {ch.customers} clientes ({ch.conversionRate.toFixed(1)}%)
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-emerald-700">{formatCurrency(ch.revenue)}</div>
                    <div className="text-[10px] text-slate-400">Receita</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="py-8 text-center text-xs text-slate-400">
            Ainda não há origens de leads registradas no CRM.
          </div>
        )}
      </section>

      {/* 6. Execução do Calendário de Conteúdo */}
      <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">Execução do Calendário de Conteúdo</h2>
            <p className="text-xs text-slate-500">Acompanhamento da cadência de publicação planejada vs. executada</p>
          </div>
          <span className="text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-3 py-1 rounded-xl">
            {contentExecution?.percentage.toFixed(0)}% Concluído
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 text-center">
            <div className="text-xs text-slate-500 font-semibold uppercase">Planejados</div>
            <div className="text-2xl font-black text-slate-900 mt-1">{contentExecution?.planned || 0}</div>
          </div>
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 text-center">
            <div className="text-xs text-slate-500 font-semibold uppercase">Publicados</div>
            <div className="text-2xl font-black text-indigo-600 mt-1">{contentExecution?.published || 0}</div>
          </div>
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 text-center">
            <div className="text-xs text-slate-500 font-semibold uppercase">Ritmo de Publicação</div>
            <div className="text-2xl font-black text-emerald-600 mt-1">
              {contentExecution?.percentage.toFixed(1)}%
            </div>
          </div>
        </div>
      </section>

      {/* 7. IA Analítica Estratégica (Opcional) */}
      <section className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-6 text-white shadow-md border border-indigo-900/50 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-indigo-900/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-500/20 rounded-xl border border-indigo-400/30 text-indigo-300">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">IA Analítica de Performance</h3>
              <p className="text-xs text-indigo-200 mt-0.5">Diagnóstico sintético baseado estritamente em dados reais agregados</p>
            </div>
          </div>

          <button
            onClick={loadAiInsights}
            disabled={insightsLoading}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl transition-colors self-start sm:self-auto shadow-sm"
          >
            <Sparkles className={`w-3.5 h-3.5 ${insightsLoading ? 'animate-spin' : ''}`} />
            {aiInsights.length > 0 ? 'Gerar Novamente' : 'Gerar Análise com IA'}
          </button>
        </div>

        {aiInsights.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {aiInsights.map((ins, idx) => (
              <div key={idx} className="p-4 bg-white/5 border border-white/10 rounded-xl space-y-2 text-xs text-indigo-100">
                <div className="flex items-center justify-between">
                  <strong className="text-white text-sm">{ins.title}</strong>
                  <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
                    {ins.confidence || 'alta'}
                  </span>
                </div>
                <p className="text-indigo-200 leading-relaxed">{ins.observation}</p>
                <div className="pt-2 border-t border-white/10 text-emerald-300 font-semibold flex items-center gap-1">
                  <ArrowRight className="w-3 h-3 shrink-0" />
                  {ins.recommended_action}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-indigo-300 italic">
            Clique no botão para gerar 3 diretrizes analíticas factuais sintetizadas sobre seus indicadores deste período.
          </p>
        )}
      </section>
    </div>
  );
}
