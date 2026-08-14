import { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth-context';

export function StrategyPage() {
  const { business, token } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const fetchStrategy = async () => {
    if (!token || !business) return;
    try {
      const res = await fetch(`/api/strategy/current?businessId=${business.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const contentType = res.headers.get("content-type");
      if (res.ok && contentType && contentType.includes("application/json")) {
        const json = await res.json();
        setData(json);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStrategy();
  }, [token, business]);

  const handleRegenerate = async () => {
    if (!token || !business) return;
    setIsRegenerating(true);
    setShowModal(false);
    try {
      const res = await fetch(`/api/strategy/regenerate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ businessId: business.id, orgId: "FETCH_IN_BACKEND" })
      });
      if (res.ok) {
        await fetchStrategy();
      } else {
        alert("Erro ao regenerar");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsRegenerating(false);
    }
  };

  if (loading) return <div className="p-8">Carregando estratégia...</div>;
  if (isRegenerating) return <div className="p-8">Gerando nova estratégia baseada nos seus dados mais recentes. Por favor, aguarde...</div>;

  if (!data?.strategy) {
    return (
      <div className="max-w-7xl mx-auto space-y-6">
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-lg font-semibold text-slate-800">Estratégia</h1>
            <p className="text-xs text-slate-500">Seu plano de marketing baseado nas informações da sua empresa.</p>
          </div>
        </header>
        <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 text-center">
          <h2 className="text-lg font-bold">Você ainda não possui uma estratégia.</h2>
          <button className="mt-4 px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-md hover:bg-indigo-700">
            Criar estratégia
          </button>
        </div>
      </div>
    );
  }

  const { strategy, channels, planWeeks, opportunities, goal } = data;

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-slate-800">Estratégia</h1>
          <p className="text-xs text-slate-500">Seu plano de marketing baseado nas informações da sua empresa.</p>
          <p className="text-[10px] text-slate-400 mt-1 uppercase font-bold">Gerado em {new Date(strategy.createdAt).toLocaleDateString()}</p>
        </div>
        <div className="flex gap-4">
          <button onClick={() => setShowModal(true)} className="px-4 py-2 text-sm font-bold border border-slate-200 rounded-md hover:bg-slate-50">
            Atualizar estratégia
          </button>
        </div>
      </header>

      {/* Main Goal Highlight */}
      {goal && (
        <section className="bg-slate-900 rounded-2xl p-6 text-white shadow-sm">
          <div className="flex justify-between items-end">
            <div>
              <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-1">Objetivo Principal</h4>
              <h2 className="text-2xl font-bold">{goal.goalType?.replace(/_/g, ' ')}</h2>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-indigo-300">{goal.targetMetric || 'Foco Contínuo'}</p>
              <p className="text-[10px] text-slate-400 uppercase font-medium">Meta / {goal.timeframe || 'Em andamento'}</p>
            </div>
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Col: Summary, Positioning, Audience */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest mb-4">Visão Geral</h3>
            <p className="text-sm text-slate-600 leading-relaxed">{strategy.businessSummary}</p>
          </div>

          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest mb-4">Posicionamento</h3>
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Mensagem Principal</p>
                <p className="text-sm font-medium text-slate-900">{strategy.positioningStatement}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Proposta de Valor</p>
                <p className="text-sm text-slate-600">{strategy.valueProposition}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Diferenciais</p>
                <ul className="list-disc pl-5 text-sm text-slate-600 space-y-1">
                  {strategy.differentiators?.map((diff: string, i: number) => <li key={i}>{diff}</li>)}
                </ul>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest mb-4">Plano de 30 Dias</h3>
            <div className="space-y-6">
              {planWeeks?.map((w: any) => (
                <div key={w.id}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 rounded bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-sm">{w.week}</div>
                    <div>
                      <p className="text-xs font-bold text-slate-500 uppercase">Semana {w.week}</p>
                      <p className="text-sm font-bold text-slate-900">{w.objective}</p>
                    </div>
                  </div>
                  <div className="space-y-2 pl-11">
                    {w.actions?.map((act: string, i: number) => (
                      <div key={i} className="flex items-start gap-3 text-sm text-slate-700">
                        <div className="w-4 h-4 rounded border border-slate-300 shrink-0 mt-0.5 flex items-center justify-center text-white hover:bg-slate-100 cursor-pointer transition-colors"></div>
                        <p>{act}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Col: Priority Channels & Opportunities */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest mb-4">Canais Prioritários</h3>
            <div className="space-y-3">
              {channels?.map((ch: any) => (
                <div key={ch.id} className="p-3 bg-slate-50 border border-slate-100 rounded-lg">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-bold text-sm text-indigo-700">#{ch.priority} {ch.channel}</span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">{ch.reason}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest mb-4">Oportunidades</h3>
            <div className="space-y-4">
              {opportunities?.map((opp: any) => (
                <div key={opp.id} className="border-l-2 border-indigo-500 pl-3">
                  <p className="text-sm font-bold text-slate-800">{opp.title}</p>
                  <p className="text-xs text-slate-600 mt-1">{opp.description}</p>
                  <span className="inline-block mt-2 text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-bold uppercase">Impacto {opp.impact}</span>
                </div>
              ))}
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest mb-4">Cliente Ideal</h3>
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Perfil</p>
                <p className="text-sm text-slate-700">{strategy.idealCustomerDesc}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Principais Dores</p>
                <div className="flex flex-wrap gap-2">
                  {strategy.idealCustomerPains?.map((p: string, i: number) => <span key={i} className="px-2 py-1 bg-red-50 text-red-700 text-xs rounded-md border border-red-100">{p}</span>)}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Desejos</p>
                <div className="flex flex-wrap gap-2">
                  {strategy.idealCustomerDesires?.map((d: string, i: number) => <span key={i} className="px-2 py-1 bg-emerald-50 text-emerald-700 text-xs rounded-md border border-emerald-100">{d}</span>)}
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>

      {showModal && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-6 max-w-md w-full">
            <h2 className="text-lg font-bold mb-2">Atualizar sua estratégia?</h2>
            <p className="text-sm text-slate-500 mb-6">A estratégia será recriada utilizando as informações atuais da empresa. O histórico anterior será salvo.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50 rounded-md">Cancelar</button>
              <button onClick={handleRegenerate} className="px-4 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-md">Gerar nova estratégia</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
