import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth-context.tsx';
import { ArrowLeft, Save, Check, Send, Wand2, RefreshCcw, Sparkles } from 'lucide-react';

export function ContentEditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { business, token } = useAuth();
  
  const [item, setItem] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [refining, setRefining] = useState(false);

  useEffect(() => {
    fetchItem();
  }, [id, business, token]);

  const fetchItem = async () => {
    if (!id || !business || !token) return;
    try {
      const res = await fetch(`/api/content/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setItem(await res.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (status?: string) => {
    if (!item || !business || !token) return;
    setSaving(true);
    const updatedStatus = status || item.status;
    
    try {
      const res = await fetch(`/api/content/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ ...item, status: updatedStatus })
      });
      if (res.ok) {
        setItem(await res.json());
        if (status === 'published') {
          alert('Conteúdo marcado como publicado!');
        }
      }
    } catch (e) {
      alert('Erro ao salvar.');
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateComplete = async () => {
    if (!id || !business || !token) return;
    setGenerating(true);
    try {
      const res = await fetch(`/api/content/${id}/generate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setItem(await res.json());
      } else {
        alert('Erro ao gerar conteúdo.');
      }
    } catch (e) {
      alert('Erro de conexão.');
    } finally {
      setGenerating(false);
    }
  };

  const handleRefine = async (field: string, currentText: string, instruction: string) => {
    if (!currentText || !instruction || !id || !business || !token) return;
    setRefining(true);
    try {
      const res = await fetch(`/api/content/${id}/refine`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ field, currentText, instruction })
      });
      if (res.ok) {
        const data = await res.json();
        setItem((prev: any) => ({ ...prev, [field]: data.refinedText }));
      }
    } catch (e) {
      alert('Erro ao refinar.');
    } finally {
      setRefining(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-slate-500">Carregando editor...</div>;
  if (!item) return <div className="p-8 text-center text-red-500">Conteúdo não encontrado.</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      <header className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/content')} className="p-2 text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-slate-900">{item.title || 'Novo Conteúdo'}</h1>
              <span className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-md ${
                item.status === 'published' ? 'bg-green-100 text-green-700' :
                item.status === 'ready' ? 'bg-blue-100 text-blue-700' :
                item.status === 'draft' ? 'bg-amber-100 text-amber-700' :
                'bg-slate-100 text-slate-600'
              }`}>
                {item.status}
              </span>
            </div>
            <p className="text-sm text-slate-500 mt-1">
              {item.scheduledDate ? new Date(item.scheduledDate).toLocaleDateString('pt-BR') : 'Sem data'} · {item.channel || 'Canal não definido'} · {item.format || 'Formato não definido'}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          {item.status !== 'published' && (
            <button 
              onClick={() => handleSave('ready')}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium border border-slate-300 bg-white text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
            >
              <Check className="w-4 h-4" /> Marcar Pronto
            </button>
          )}
          {item.status === 'ready' && (
            <button 
              onClick={() => handleSave('published')}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-sm"
            >
              <Send className="w-4 h-4" /> Publicado
            </button>
          )}
          <button 
            onClick={() => handleSave()}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
          >
            <Save className="w-4 h-4" /> {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          
          {(!item.body && !item.hook) && (
            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-6 border border-indigo-100 shadow-sm flex flex-col items-center text-center">
              <Wand2 className="w-8 h-8 text-indigo-600 mb-3" />
              <h3 className="font-bold text-slate-900 mb-2">Conteúdo Vazio</h3>
              <p className="text-sm text-slate-600 max-w-md mb-6">Você pode escrever o conteúdo do zero ou pedir para a Inteligência Artificial gerar o primeiro rascunho com base no contexto estratégico.</p>
              <button 
                onClick={handleGenerateComplete}
                disabled={generating}
                className="px-6 py-3 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 shadow-sm transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {generating ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {generating ? 'Gerando conteúdo...' : 'Gerar Conteúdo com IA'}
              </button>
            </div>
          )}

          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-5">
            <div>
              <label className="block text-sm font-bold text-slate-900 mb-1">Título / Tema</label>
              <input 
                type="text" 
                value={item.title || ''}
                onChange={e => setItem({...item, title: e.target.value})}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-600 outline-none font-medium"
              />
            </div>
            
            <div>
              <div className="flex justify-between items-end mb-1">
                <label className="block text-sm font-bold text-slate-900">Hook (Gancho)</label>
                {item.hook && <button onClick={() => handleRefine('hook', item.hook, 'Escreva um hook mais chamativo e direto.')} className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1 font-medium"><Sparkles className="w-3 h-3"/> Melhorar</button>}
              </div>
              <textarea 
                value={item.hook || ''}
                onChange={e => setItem({...item, hook: e.target.value})}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-600 outline-none resize-none"
                rows={2}
                placeholder="A primeira frase para chamar atenção..."
              />
            </div>

            <div>
              <div className="flex justify-between items-end mb-1">
                <label className="block text-sm font-bold text-slate-900">Corpo do Conteúdo / Legenda Principal</label>
                {item.body && (
                  <div className="flex gap-3">
                    <button onClick={() => handleRefine('body', item.body, 'Deixe o texto mais curto e direto.')} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">Encurtar</button>
                    <button onClick={() => handleRefine('body', item.body, 'Deixe o texto mais comercial e focado na conversão.')} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">Comercial</button>
                    <button onClick={() => handleRefine('body', item.body, 'Melhore a fluidez e engajamento deste texto.')} className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1 font-medium"><Sparkles className="w-3 h-3"/> Melhorar</button>
                  </div>
                )}
              </div>
              <textarea 
                value={item.body || ''}
                onChange={e => setItem({...item, body: e.target.value})}
                className="w-full border border-slate-300 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-600 outline-none resize-y"
                rows={8}
                placeholder="Desenvolva o conteúdo aqui..."
              />
            </div>

            <div>
              <div className="flex justify-between items-end mb-1">
                <label className="block text-sm font-bold text-slate-900">Chamada para Ação (CTA)</label>
                {item.cta && <button onClick={() => handleRefine('cta', item.cta, 'Escreva uma CTA diferente e mais persuasiva.')} className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1 font-medium"><Sparkles className="w-3 h-3"/> Outra opção</button>}
              </div>
              <input 
                type="text" 
                value={item.cta || ''}
                onChange={e => setItem({...item, cta: e.target.value})}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-600 outline-none"
              />
            </div>
            
            {item.format === 'Vídeo' || item.format === 'Reels' || item.format === 'TikTok' ? (
              <div>
                <label className="block text-sm font-bold text-slate-900 mb-1">Roteiro Sugerido</label>
                <textarea 
                  value={item.videoScript || ''}
                  onChange={e => setItem({...item, videoScript: e.target.value})}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-600 outline-none font-mono text-xs bg-slate-50"
                  rows={6}
                />
              </div>
            ) : null}

          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-slate-50 rounded-xl border border-slate-200 p-5 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest mb-4">Configuração</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Data Agendada</label>
                <input 
                  type="date" 
                  value={item.scheduledDate || ''}
                  onChange={e => setItem({...item, scheduledDate: e.target.value})}
                  className="w-full border border-slate-300 rounded-md px-3 py-1.5 text-sm outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Canal</label>
                <input 
                  type="text" 
                  value={item.channel || ''}
                  onChange={e => setItem({...item, channel: e.target.value})}
                  className="w-full border border-slate-300 rounded-md px-3 py-1.5 text-sm outline-none bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Formato</label>
                <input 
                  type="text" 
                  value={item.format || ''}
                  onChange={e => setItem({...item, format: e.target.value})}
                  className="w-full border border-slate-300 rounded-md px-3 py-1.5 text-sm outline-none bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Etapa do Funil</label>
                <select 
                  value={item.funnelStage || ''}
                  onChange={e => setItem({...item, funnelStage: e.target.value})}
                  className="w-full border border-slate-300 rounded-md px-3 py-1.5 text-sm outline-none bg-white"
                >
                  <option value="awareness">Awareness (Consciência)</option>
                  <option value="consideration">Consideration (Consideração)</option>
                  <option value="conversion">Conversion (Conversão)</option>
                  <option value="retention">Retention (Retenção)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Objetivo</label>
                <input 
                  type="text" 
                  value={item.objective || ''}
                  onChange={e => setItem({...item, objective: e.target.value})}
                  className="w-full border border-slate-300 rounded-md px-3 py-1.5 text-sm outline-none bg-white"
                />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
             <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest mb-4">Direção Visual</h3>
             <textarea 
                value={item.visualDirection || ''}
                onChange={e => setItem({...item, visualDirection: e.target.value})}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-600 outline-none resize-none"
                rows={4}
                placeholder="Ex: Arte limpa focada em topografia, cores da marca..."
              />
          </div>
        </div>
      </div>
      
      {refining && (
        <div className="fixed bottom-4 right-4 bg-slate-900 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 animate-pulse">
          <Sparkles className="w-4 h-4 text-indigo-300" />
          <span className="text-sm font-medium">A IA está refinando o texto...</span>
        </div>
      )}
    </div>
  );
}
