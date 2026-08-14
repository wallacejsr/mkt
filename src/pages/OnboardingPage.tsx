import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth-context';

export function OnboardingPage() {
  const { business, user, token, refreshBusiness } = useAuth();
  const navigate = useNavigate();
  
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("Estamos conhecendo seu negócio...");

  // State
  const [company, setCompany] = useState({
    segment: '', description: '', city: '', state: '', 
    website: '', instagram: '', whatsapp: '', serviceArea: '', serviceType: 'local'
  });

  const [productsList, setProductsList] = useState([{
    name: '', type: 'produto', description: '', price: '', ticketValue: '', 
    mainBenefit: '', differentiators: '', idealCustomer: ''
  }]);

  const [audience, setAudience] = useState({
    description: '', ageRange: '', location: '', profile: '',
    pains: '', desires: '', objections: '', decisionFactors: ''
  });

  const [marketing, setMarketing] = useState({
    channels: [] as string[], postFrequency: '', monthlyInvestment: '', 
    monthlyLeads: '', monthlySales: '', mainDifficulty: ''
  });

  const [objective, setObjective] = useState({
    goalType: '', targetMetric: '', timeframe: ''
  });

  const handleNext = () => setStep(s => Math.min(s + 1, 6));
  const handlePrev = () => setStep(s => Math.max(s - 1, 1));

  const addProduct = () => {
    setProductsList([...productsList, {
      name: '', type: 'produto', description: '', price: '', ticketValue: '', 
      mainBenefit: '', differentiators: '', idealCustomer: ''
    }]);
  };

  const removeProduct = (index: number) => {
    setProductsList(productsList.filter((_, i) => i !== index));
  };

  const toggleChannel = (channel: string) => {
    setMarketing(prev => ({
      ...prev,
      channels: prev.channels.includes(channel)
        ? prev.channels.filter(c => c !== channel)
        : [...prev.channels, channel]
    }));
  };

  const parseStringToArray = (str: string) => {
    return str.split(/[\n,;]+/).map(s => s.trim()).filter(Boolean);
  };

  const handleSubmit = async () => {
    if (!token || !business || !user) return;
    
    setIsSubmitting(true);
    
    const loadingMessages = [
      "Entendendo seu público...",
      "Analisando seus produtos...",
      "Identificando oportunidades...",
      "Criando seu plano inicial..."
    ];
    
    let messageIndex = 0;
    const interval = setInterval(() => {
      if (messageIndex < loadingMessages.length) {
        setLoadingMessage(loadingMessages[messageIndex]);
        messageIndex++;
      }
    }, 2500);

    try {
      const payload = {
        businessId: business.id,
        // Firebase users token usually have tenant info, but we map user to org in backend, 
        // to simplify, backend verifies ownership. But let's pass orgId if we had it, backend can figure out by user.uid though.
        // Wait, onboarding router expects orgId. Let's send a placeholder or let backend infer it.
        // Wait! In `getOrCreateUserAndBusiness` backend, I can get orgId from business. Let's fix backend to not need orgId from client if possible.
        // For now, I'll let backend fetch orgId from business.
        orgId: "FETCH_IN_BACKEND", 
        company,
        productsList,
        audience: {
          ...audience,
          pains: parseStringToArray(audience.pains),
          desires: parseStringToArray(audience.desires),
          objections: parseStringToArray(audience.objections)
        },
        marketing,
        objective
      };

      const res = await fetch('/api/onboarding/complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        await refreshBusiness();
        navigate('/dashboard');
      } else {
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const err = await res.json();
          alert('Erro ao gerar estratégia: ' + err.error);
        } else {
          alert('Erro ao gerar estratégia (Problema de conexão ou servidor)');
        }
        setIsSubmitting(false);
      }
    } catch (e) {
      console.error(e);
      alert('Erro inesperado ao gerar estratégia.');
      setIsSubmitting(false);
    } finally {
      clearInterval(interval);
    }
  };

  if (isSubmitting) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center font-sans">
        <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-8"></div>
        <h2 className="text-xl font-bold text-slate-800">{loadingMessage}</h2>
        <p className="text-slate-500 mt-2">Isso pode levar até um minuto. Não feche a página.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 flex flex-col items-center py-10 px-4">
      <div className="w-full max-w-3xl bg-white shadow-sm rounded-xl border border-slate-200 overflow-hidden">
        
        {/* Header & Progress */}
        <div className="px-8 py-6 border-b border-slate-200 bg-slate-50/50">
          <h1 className="text-2xl font-bold">Vamos conhecer melhor sua empresa</h1>
          <p className="text-slate-500 text-sm mt-1">Isso leva poucos minutos e permitirá que o Marketing OS crie estratégias específicas para o seu negócio.</p>
          
          <div className="mt-6 flex items-center justify-between text-xs font-semibold text-slate-400 uppercase tracking-widest relative">
            <div className="absolute top-1/2 left-0 w-full h-0.5 bg-slate-200 -z-10 -translate-y-1/2"></div>
            {[1,2,3,4,5,6].map(i => (
              <div key={i} className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors ${step >= i ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-400'} z-10`}>
                {i}
              </div>
            ))}
          </div>
          <div className="flex justify-between text-[10px] uppercase font-bold text-slate-400 mt-2">
            <span>Empresa</span>
            <span>Produtos</span>
            <span>Público</span>
            <span>Marketing</span>
            <span>Objetivos</span>
            <span>Análise</span>
          </div>
        </div>

        {/* Content */}
        <div className="p-8">
          {step === 1 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
              <h2 className="text-xl font-bold mb-4">Conte um pouco sobre sua empresa</h2>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-1">Segmento</label>
                  <input type="text" value={company.segment} onChange={e => setCompany({...company, segment: e.target.value})} className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none" placeholder="Ex: Energia Solar" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">Tipo de Atendimento</label>
                  <select value={company.serviceType} onChange={e => setCompany({...company, serviceType: e.target.value})} className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm outline-none">
                    <option value="local">Local</option>
                    <option value="regional">Regional</option>
                    <option value="nacional">Nacional</option>
                    <option value="online">Online</option>
                    <option value="internacional">Internacional</option>
                  </select>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-semibold mb-1">Explique resumidamente o que sua empresa faz</label>
                <textarea value={company.description} onChange={e => setCompany({...company, description: e.target.value})} className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm min-h-[100px] outline-none" placeholder="Ex.: Somos uma empresa de energia solar que atende residências e empresas..."></textarea>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-1">Site</label>
                  <input type="text" value={company.website} onChange={e => setCompany({...company, website: e.target.value})} className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm outline-none" placeholder="https://" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">Instagram</label>
                  <input type="text" value={company.instagram} onChange={e => setCompany({...company, instagram: e.target.value})} className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm outline-none" placeholder="@" />
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
              <h2 className="text-xl font-bold mb-4">O que você vende?</h2>
              
              {productsList.map((prod, idx) => (
                <div key={idx} className="p-4 border border-slate-200 rounded-lg bg-slate-50 space-y-4 relative">
                  {idx > 0 && <button onClick={() => removeProduct(idx)} className="absolute top-4 right-4 text-xs font-bold text-red-600 uppercase hover:underline">Remover</button>}
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold mb-1">Nome do Produto/Serviço</label>
                      <input type="text" value={prod.name} onChange={e => {
                        const newProds = [...productsList]; newProds[idx].name = e.target.value; setProductsList(newProds);
                      }} className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm outline-none" />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold mb-1">Tipo</label>
                      <select value={prod.type} onChange={e => {
                        const newProds = [...productsList]; newProds[idx].type = e.target.value; setProductsList(newProds);
                      }} className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm outline-none">
                        <option value="produto">Produto</option>
                        <option value="serviço">Serviço</option>
                      </select>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-semibold mb-1">Principal Benefício</label>
                    <input type="text" value={prod.mainBenefit} onChange={e => {
                        const newProds = [...productsList]; newProds[idx].mainBenefit = e.target.value; setProductsList(newProds);
                      }} className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm outline-none" placeholder="Ex: Reduz a conta de luz em 90%" />
                  </div>
                </div>
              ))}
              
              <button onClick={addProduct} className="w-full py-3 border-2 border-dashed border-indigo-200 text-indigo-600 font-bold rounded-lg hover:bg-indigo-50 transition-colors">+ Adicionar produto ou serviço</button>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
              <h2 className="text-xl font-bold mb-4">Quem costuma comprar de você?</h2>
              
              <div>
                <label className="block text-sm font-semibold mb-1">Perfil do Cliente</label>
                <input type="text" value={audience.profile} onChange={e => setAudience({...audience, profile: e.target.value})} className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm outline-none" placeholder="Ex: Proprietários de imóveis, casados, 30-50 anos..." />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">Principais Dores (Separe por vírgula ou linha)</label>
                <textarea value={audience.pains} onChange={e => setAudience({...audience, pains: e.target.value})} className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm min-h-[80px] outline-none" placeholder="Ex: Conta de luz muito alta, medo de falta de energia..."></textarea>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">Principais Desejos (Separe por vírgula ou linha)</label>
                <textarea value={audience.desires} onChange={e => setAudience({...audience, desires: e.target.value})} className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm min-h-[80px] outline-none" placeholder="Ex: Economizar dinheiro, ajudar o meio ambiente..."></textarea>
              </div>

              <div className="flex items-center gap-2 mt-4">
                <input type="checkbox" id="dont-know" onChange={e => {
                  if(e.target.checked) setAudience({...audience, profile: 'Não sei responder', pains: 'Não sei responder', desires: 'Não sei responder'});
                }} />
                <label htmlFor="dont-know" className="text-sm font-medium text-slate-600">Não sei responder (A IA fará hipóteses)</label>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
              <h2 className="text-xl font-bold mb-4">Como sua empresa faz marketing hoje?</h2>
              
              <div>
                <label className="block text-sm font-semibold mb-2">Canais utilizados</label>
                <div className="grid grid-cols-3 gap-2">
                  {['Instagram', 'Facebook', 'TikTok', 'Google', 'Meta Ads', 'YouTube', 'LinkedIn', 'WhatsApp', 'E-mail', 'SEO'].map(ch => (
                    <div key={ch} 
                         onClick={() => toggleChannel(ch)}
                         className={`cursor-pointer border p-2 rounded text-center text-sm font-medium transition-colors ${marketing.channels.includes(ch) ? 'bg-indigo-50 border-indigo-500 text-indigo-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                      {ch}
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mt-6">
                <div>
                  <label className="block text-sm font-semibold mb-1">Investimento Mensal</label>
                  <input type="text" value={marketing.monthlyInvestment} onChange={e => setMarketing({...marketing, monthlyInvestment: e.target.value})} className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm outline-none" placeholder="R$" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">Média de Vendas/Mês</label>
                  <input type="text" value={marketing.monthlySales} onChange={e => setMarketing({...marketing, monthlySales: e.target.value})} className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm outline-none" placeholder="Qtd" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">Maior Dificuldade Hoje</label>
                <textarea value={marketing.mainDifficulty} onChange={e => setMarketing({...marketing, mainDifficulty: e.target.value})} className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm min-h-[80px] outline-none" placeholder="Ex: Não sei o que publicar, poucos leads..."></textarea>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
              <h2 className="text-xl font-bold mb-4">O que você quer melhorar primeiro?</h2>
              
              <div>
                <label className="block text-sm font-semibold mb-2">Objetivo Principal</label>
                <select value={objective.goalType} onChange={e => setObjective({...objective, goalType: e.target.value})} className="w-full border border-slate-200 rounded-md px-3 py-3 text-sm outline-none">
                  <option value="">Selecione...</option>
                  <option value="gerar_leads">Gerar mais leads</option>
                  <option value="aumentar_vendas">Aumentar vendas</option>
                  <option value="divulgar_marca">Divulgar a marca</option>
                  <option value="aumentar_seguidores">Aumentar seguidores</option>
                  <option value="trazer_loja_fisica">Trazer clientes para loja física</option>
                  <option value="vender_produto_especifico">Vender um produto específico</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">Qual resultado você gostaria de atingir? (Opcional)</label>
                <input type="text" value={objective.targetMetric} onChange={e => setObjective({...objective, targetMetric: e.target.value})} className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm outline-none" placeholder="Ex: Quero gerar 50 leads por mês" />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2">Em quanto tempo?</label>
                <select value={objective.timeframe} onChange={e => setObjective({...objective, timeframe: e.target.value})} className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm outline-none">
                  <option value="">Selecione...</option>
                  <option value="30 dias">30 dias</option>
                  <option value="60 dias">60 dias</option>
                  <option value="90 dias">90 dias</option>
                  <option value="6 meses">6 meses</option>
                </select>
              </div>
            </div>
          )}

          {step === 6 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
              <h2 className="text-xl font-bold mb-4">Revisão</h2>
              
              <div className="space-y-4 text-sm bg-slate-50 p-6 rounded-lg border border-slate-200">
                <div className="grid grid-cols-3 gap-2">
                  <div className="font-semibold text-slate-500 uppercase text-xs">Segmento</div>
                  <div className="col-span-2 font-medium">{company.segment || 'Não informado'}</div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="font-semibold text-slate-500 uppercase text-xs">Descrição</div>
                  <div className="col-span-2 font-medium">{company.description || 'Não informado'}</div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="font-semibold text-slate-500 uppercase text-xs">Produtos</div>
                  <div className="col-span-2 font-medium">{productsList.length} cadastrados</div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="font-semibold text-slate-500 uppercase text-xs">Objetivo</div>
                  <div className="col-span-2 font-medium">{objective.goalType?.replace('_', ' ') || 'Não informado'}</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-slate-200 bg-slate-50 flex justify-between">
          <button 
            onClick={handlePrev}
            disabled={step === 1}
            className="px-6 py-2.5 text-sm font-bold text-slate-600 border border-slate-200 bg-white rounded-md hover:bg-slate-50 disabled:opacity-50"
          >
            Voltar
          </button>
          
          {step < 6 ? (
            <button 
              onClick={handleNext}
              className="px-6 py-2.5 text-sm font-bold text-white bg-indigo-600 rounded-md hover:bg-indigo-700 shadow-sm"
            >
              Próximo
            </button>
          ) : (
            <button 
              onClick={handleSubmit}
              className="px-6 py-2.5 text-sm font-bold text-white bg-emerald-600 rounded-md hover:bg-emerald-700 shadow-sm flex items-center gap-2"
            >
              Criar minha estratégia
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
