import { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth-context.tsx';
import { useNavigate } from 'react-router-dom';
import { Calendar, List, Plus, Wand2, CalendarDays, Search, Filter } from 'lucide-react';

export function ContentPage() {
  const { user, business, token } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'calendar' | 'list'>('list');
  const [search, setSearch] = useState('');
  
  // Modal state
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [generating, setGenerating] = useState(false);
  
  const [calConfig, setCalConfig] = useState({
    periodDays: 30,
    frequencyDesc: '3 conteúdos por semana',
    channels: ['Instagram', 'LinkedIn'],
    objective: 'autoridade'
  });

  useEffect(() => {
    fetchItems();
  }, [business, token]);

  const fetchItems = async () => {
    if (!business || !token) return;
    try {
      const res = await fetch(`/api/content?businessId=${business.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setItems(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateCalendar = async () => {
    if (!business || !token) return;
    setGenerating(true);
    try {
      const res = await fetch('/api/content/generate-calendar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          businessId: business.id,
          ...calConfig
        })
      });
      if (res.ok) {
        await fetchItems();
        setShowCalendarModal(false);
      } else {
        const err = await res.json();
        alert('Erro ao gerar: ' + err.error);
      }
    } catch (e) {
      alert('Erro de conexão.');
    } finally {
      setGenerating(false);
    }
  };

  const handleManualCreate = async () => {
    if (!business || !token) return;
    try {
      const res = await fetch('/api/content', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          businessId: business.id,
          title: "Novo Conteúdo",
          status: "idea"
        })
      });
      if (res.ok) {
        const data = await res.json();
        navigate(`/content/${data.id}`);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const filteredItems = items.filter(i => 
    i.title?.toLowerCase().includes(search.toLowerCase()) || 
    i.topic?.toLowerCase().includes(search.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'published': return <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-700">Publicado</span>;
      case 'ready': return <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-700">Pronto</span>;
      case 'draft': return <span className="px-2 py-1 text-xs rounded-full bg-amber-100 text-amber-700">Rascunho</span>;
      default: return <span className="px-2 py-1 text-xs rounded-full bg-slate-100 text-slate-700">Ideia</span>;
    }
  };

  if (loading) return <div className="p-8 text-center text-slate-500">Carregando conteúdos...</div>;

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Conteúdo</h1>
          <p className="text-sm text-slate-500 mt-1">Planeje e produza conteúdos alinhados à sua estratégia.</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => setShowCalendarModal(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium border border-slate-300 bg-white text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <CalendarDays className="w-4 h-4" />
            Gerar calendário
          </button>
          <button 
            onClick={handleManualCreate}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Criar conteúdo
          </button>
        </div>
      </header>

      {items.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center flex flex-col items-center justify-center">
          <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
            <CalendarDays className="w-8 h-8 text-slate-400" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Seu calendário ainda está vazio.</h2>
          <p className="text-slate-500 mb-6 max-w-md">
            Crie seu primeiro conteúdo ou deixe o Marketing OS planejar seus próximos dias baseado na sua estratégia.
          </p>
          <div className="flex gap-4">
            <button 
              onClick={() => setShowCalendarModal(true)}
              className="px-5 py-2.5 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
            >
              Gerar calendário
            </button>
            <button 
              onClick={handleManualCreate}
              className="px-5 py-2.5 text-sm font-medium border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Criar manualmente
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between gap-4">
            <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg w-fit">
              <button 
                onClick={() => setView('list')}
                className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${view === 'list' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <List className="w-4 h-4" /> Lista
              </button>
              <button 
                onClick={() => setView('calendar')}
                className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${view === 'calendar' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <Calendar className="w-4 h-4" /> Calendário
              </button>
            </div>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                placeholder="Buscar conteúdo..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent outline-none w-full sm:w-64"
              />
            </div>
          </div>

          {view === 'list' ? (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Data</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Título/Tema</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Canal/Formato</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                  {filteredItems.map(item => (
                    <tr 
                      key={item.id} 
                      onClick={() => navigate(`/content/${item.id}`)}
                      className="hover:bg-slate-50 cursor-pointer transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                        {item.scheduledDate ? new Date(item.scheduledDate).toLocaleDateString('pt-BR') : '-'}
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-medium text-slate-900">{item.title}</p>
                        <p className="text-xs text-slate-500 truncate max-w-xs">{item.topic || item.objective}</p>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                        <span className="font-medium text-slate-700">{item.channel || '-'}</span>
                        {item.format && <span className="text-slate-400 ml-1">· {item.format}</span>}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(item.status)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm min-h-[400px]">
              <p className="text-slate-500 text-center mt-20">Visualização de calendário simplificada para a lista atual.</p>
              <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredItems.slice(0, 12).map(item => (
                  <div key={item.id} onClick={() => navigate(`/content/${item.id}`)} className="border border-slate-200 p-4 rounded-lg cursor-pointer hover:border-indigo-300 hover:shadow-sm transition-all">
                     <div className="flex justify-between items-start mb-2">
                       <span className="text-xs font-semibold text-indigo-600">{item.scheduledDate ? new Date(item.scheduledDate).toLocaleDateString('pt-BR') : 'Sem data'}</span>
                       {getStatusBadge(item.status)}
                     </div>
                     <h3 className="text-sm font-bold text-slate-900 mb-1">{item.title}</h3>
                     <p className="text-xs text-slate-500">{item.channel} · {item.format}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {showCalendarModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl relative overflow-hidden">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Gerar Calendário Inteligente</h2>
            
            <div className="space-y-4 relative z-10">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Período</label>
                <select 
                  value={calConfig.periodDays}
                  onChange={e => setCalConfig({...calConfig, periodDays: parseInt(e.target.value)})}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-600 outline-none"
                >
                  <option value={7}>7 dias</option>
                  <option value={14}>14 dias</option>
                  <option value={30}>30 dias</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Frequência</label>
                <select 
                  value={calConfig.frequencyDesc}
                  onChange={e => setCalConfig({...calConfig, frequencyDesc: e.target.value})}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-600 outline-none"
                >
                  <option value="3 conteúdos por semana">3 conteúdos por semana</option>
                  <option value="5 conteúdos por semana">5 conteúdos por semana</option>
                  <option value="Todos os dias">Todos os dias</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Objetivo Foco</label>
                <select 
                  value={calConfig.objective}
                  onChange={e => setCalConfig({...calConfig, objective: e.target.value})}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-600 outline-none"
                >
                  <option value="autoridade">Autoridade / Educação</option>
                  <option value="engajamento">Engajamento / Comunidade</option>
                  <option value="geração de leads">Geração de Leads</option>
                  <option value="conversão">Conversão / Vendas</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3 mt-8 relative z-10">
              <button 
                onClick={() => setShowCalendarModal(false)}
                className="flex-1 px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                disabled={generating}
              >
                Cancelar
              </button>
              <button 
                onClick={handleGenerateCalendar}
                disabled={generating}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {generating ? (
                  <span className="animate-pulse">Gerando...</span>
                ) : (
                  <>
                    <Wand2 className="w-4 h-4" /> Gerar
                  </>
                )}
              </button>
            </div>
            
            {generating && (
              <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-20 flex flex-col items-center justify-center text-center p-6">
                <Wand2 className="w-8 h-8 text-indigo-600 animate-spin mb-4" />
                <p className="font-bold text-slate-900">Planejando conteúdo...</p>
                <p className="text-sm text-slate-500 mt-1">A inteligência artificial está analisando sua estratégia para criar a distribuição ideal.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
