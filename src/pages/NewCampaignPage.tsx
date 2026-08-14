import React, { useState, useEffect } from 'react';
import { useAuth } from '../lib/auth-context';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Sparkles, Loader2, Target, Package, Users, Megaphone, Settings } from 'lucide-react';

const OBJECTIVE_OPTIONS = [
  'gerar leads',
  'aumentar vendas',
  'divulgar produto',
  'lançamento',
  'recuperar clientes',
  'aumentar visitas',
  'gerar reconhecimento',
  'outro'
];

const CHANNEL_OPTIONS = [
  'Instagram',
  'Facebook',
  'LinkedIn',
  'Google Ads',
  'Meta Ads',
  'WhatsApp',
  'E-mail',
  'YouTube',
  'TikTok'
];

export function NewCampaignPage() {
  const { business, token } = useAuth();
  const navigate = useNavigate();
  
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const [audience, setAudience] = useState<any>(null);

  const [formData, setFormData] = useState({
    objective: '',
    productId: '',
    customAudience: null as any,
    channels: [] as string[],
    name: '',
    startDate: '',
    endDate: '',
    budget: '',
    targetMetric: '',
    instructions: ''
  });

  useEffect(() => {
    if (business && token) {
      loadContext();
    }
  }, [business, token]);

  const loadContext = async () => {
    try {
      const res = await fetch(`/api/businesses/${business?.id}/context`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setProducts(data.products || []);
        setAudience(data.targetAudiences?.[0] || null);
        
        // Auto-select channels if present in marketing profile
        const profile = data.marketingProfiles?.[0];
        if (profile?.channels) {
          setFormData(prev => ({ ...prev, channels: profile.channels }));
        }
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const payload = {
        ...formData,
        customAudience: audience
      };

      const res = await fetch(`/api/campaigns/generate?businessId=${business?.id}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify(payload)
      });
      
      if (res.ok) {
        const campaign = await res.json();
        navigate(`/campaigns/${campaign.id}`);
      } else {
        alert("Erro ao gerar campanha.");
      }
    } catch (error) {
      console.error(error);
      alert("Erro ao gerar campanha.");
    } finally {
      setLoading(false);
    }
  };

  const toggleChannel = (ch: string) => {
    setFormData(prev => ({
      ...prev,
      channels: prev.channels.includes(ch) 
        ? prev.channels.filter(c => c !== ch)
        : [...prev.channels, ch]
    }));
  };

  const renderStepContent = () => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-slate-900">Objetivo</h2>
              <p className="text-slate-500 mt-2">O que você quer conseguir com esta campanha?</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {OBJECTIVE_OPTIONS.map(obj => (
                <button
                  key={obj}
                  onClick={() => setFormData({ ...formData, objective: obj })}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    formData.objective === obj
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-700 ring-1 ring-indigo-600'
                      : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <span className="font-medium capitalize">{obj}</span>
                </button>
              ))}
            </div>
            {formData.objective === 'outro' && (
              <input 
                type="text" 
                placeholder="Qual o seu objetivo?" 
                className="w-full mt-4 p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                value={formData.instructions}
                onChange={e => setFormData({ ...formData, instructions: e.target.value })}
              />
            )}
          </div>
        );
      case 2:
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-slate-900">Produto ou Serviço</h2>
              <p className="text-slate-500 mt-2">O que você quer promover?</p>
            </div>
            <div className="grid grid-cols-1 gap-4">
              <button
                onClick={() => setFormData({ ...formData, productId: '' })}
                className={`p-4 rounded-xl border text-left transition-all ${
                  formData.productId === ''
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-700 ring-1 ring-indigo-600'
                    : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <div className="font-bold">Campanha Institucional</div>
                <div className="text-sm opacity-80">Promover a marca de forma geral, sem focar em um produto específico.</div>
              </button>
              {products.map(p => (
                <button
                  key={p.id}
                  onClick={() => setFormData({ ...formData, productId: p.id })}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    formData.productId === p.id
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-700 ring-1 ring-indigo-600'
                      : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <div className="font-bold">{p.name}</div>
                  <div className="text-sm opacity-80 line-clamp-1">{p.description}</div>
                </button>
              ))}
            </div>
          </div>
        );
      case 3:
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-slate-900">Público-Alvo</h2>
              <p className="text-slate-500 mt-2">Revise e ajuste o público desta campanha.</p>
            </div>
            {audience ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Perfil</label>
                  <textarea 
                    rows={2}
                    className="w-full p-3 border border-slate-200 rounded-lg"
                    value={audience.profile || ''}
                    onChange={e => setAudience({ ...audience, profile: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Dores (separadas por vírgula)</label>
                  <input 
                    type="text"
                    className="w-full p-3 border border-slate-200 rounded-lg"
                    value={Array.isArray(audience.pains) ? audience.pains.join(', ') : ''}
                    onChange={e => setAudience({ ...audience, pains: e.target.value.split(',').map((s: string) => s.trim()) })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Desejos (separados por vírgula)</label>
                  <input 
                    type="text"
                    className="w-full p-3 border border-slate-200 rounded-lg"
                    value={Array.isArray(audience.desires) ? audience.desires.join(', ') : ''}
                    onChange={e => setAudience({ ...audience, desires: e.target.value.split(',').map((s: string) => s.trim()) })}
                  />
                </div>
                <p className="text-xs text-slate-500">Isso ajustará o público apenas para esta campanha. O perfil global da empresa não será alterado.</p>
              </div>
            ) : (
              <div className="text-center p-8 bg-slate-50 rounded-xl">
                Nenhum público global encontrado. A IA deduzirá o público pelo objetivo e produto.
              </div>
            )}
          </div>
        );
      case 4:
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-slate-900">Canais</h2>
              <p className="text-slate-500 mt-2">Onde esta campanha será veiculada?</p>
            </div>
            <div className="flex flex-wrap gap-3 justify-center">
              {CHANNEL_OPTIONS.map(ch => (
                <button
                  key={ch}
                  onClick={() => toggleChannel(ch)}
                  className={`px-4 py-2 rounded-full border transition-all font-medium ${
                    formData.channels.includes(ch)
                      ? 'bg-indigo-600 border-indigo-600 text-white'
                      : 'bg-white border-slate-200 text-slate-700 hover:border-indigo-300'
                  }`}
                >
                  {ch}
                </button>
              ))}
            </div>
          </div>
        );
      case 5:
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-slate-900">Configuração Final</h2>
              <p className="text-slate-500 mt-2">Detalhes operacionais da campanha.</p>
            </div>
            <div className="space-y-4 max-w-md mx-auto">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nome da campanha</label>
                <input 
                  type="text"
                  placeholder="Ex: Oferta de Primavera"
                  className="w-full p-3 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Início</label>
                  <input 
                    type="date"
                    className="w-full p-3 border border-slate-200 rounded-lg outline-none"
                    value={formData.startDate}
                    onChange={e => setFormData({ ...formData, startDate: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Término</label>
                  <input 
                    type="date"
                    className="w-full p-3 border border-slate-200 rounded-lg outline-none"
                    value={formData.endDate}
                    onChange={e => setFormData({ ...formData, endDate: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Orçamento aproximado (Opcional)</label>
                <input 
                  type="text"
                  placeholder="R$ 1.000,00"
                  className="w-full p-3 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                  value={formData.budget}
                  onChange={e => setFormData({ ...formData, budget: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Instruções adicionais para a IA</label>
                <textarea 
                  rows={3}
                  placeholder="Ex: Quero destacar agilidade e segurança."
                  className="w-full p-3 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                  value={formData.instructions}
                  onChange={e => setFormData({ ...formData, instructions: e.target.value })}
                />
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  const stepIcons = [Target, Package, Users, Megaphone, Settings];

  return (
    <div className="max-w-4xl mx-auto py-8">
      {/* Progress */}
      <div className="mb-12">
        <div className="flex items-center justify-between relative">
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-slate-100 rounded-full z-0"></div>
          <div 
            className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-indigo-600 rounded-full z-0 transition-all duration-300"
            style={{ width: `${((step - 1) / 4) * 100}%` }}
          ></div>
          
          {[1, 2, 3, 4, 5].map(s => {
            const Icon = stepIcons[s - 1];
            return (
              <div 
                key={s} 
                className={`relative z-10 w-12 h-12 rounded-full flex items-center justify-center border-4 border-slate-50 transition-colors ${
                  s < step ? 'bg-indigo-600 text-white' : s === step ? 'bg-white border-indigo-600 text-indigo-600' : 'bg-white border-slate-200 text-slate-400'
                }`}
              >
                <Icon className="w-5 h-5" />
              </div>
            )
          })}
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-white rounded-2xl border border-slate-200 p-8 md:p-12 shadow-sm min-h-[400px] flex flex-col">
        <div className="flex-1">
          {renderStepContent()}
        </div>
        
        {/* Footer Actions */}
        <div className="mt-12 flex justify-between items-center pt-6 border-t border-slate-100">
          <button
            onClick={() => setStep(step - 1)}
            disabled={step === 1 || loading}
            className={`px-6 py-2.5 rounded-lg font-medium transition-colors ${
              step === 1 ? 'opacity-0 cursor-default' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Voltar
          </button>
          
          {step < 5 ? (
            <button
              onClick={() => setStep(step + 1)}
              disabled={step === 1 && !formData.objective}
              className="bg-indigo-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-indigo-700 transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              Próximo
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleGenerate}
              disabled={loading || !formData.name}
              className="bg-indigo-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-indigo-700 transition-all flex items-center gap-2 shadow-sm disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Gerando campanha com IA...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  Gerar Campanha Completa
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
