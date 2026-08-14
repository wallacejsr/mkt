import React, { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth-context';
import { Link } from 'react-router-dom';
import { Plus, Megaphone, Calendar, BarChart2, MoreHorizontal, Users } from 'lucide-react';

export function CampaignsPage() {
  const { business, token } = useAuth();
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (business && token) {
      loadCampaigns();
    }
  }, [business, token]);

  const loadCampaigns = async () => {
    try {
      const res = await fetch(`/api/campaigns?businessId=${business?.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setCampaigns(data);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusLabel = (status: string) => {
    const map: Record<string, { label: string, color: string }> = {
      draft: { label: 'Rascunho', color: 'bg-slate-100 text-slate-700' },
      ready: { label: 'Pronta', color: 'bg-blue-100 text-blue-700' },
      active: { label: 'Ativa', color: 'bg-green-100 text-green-700' },
      paused: { label: 'Pausada', color: 'bg-amber-100 text-amber-700' },
      completed: { label: 'Concluída', color: 'bg-indigo-100 text-indigo-700' },
      archived: { label: 'Arquivada', color: 'bg-slate-200 text-slate-500' }
    };
    const mapped = map[status] || map.draft;
    return <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${mapped.color}`}>{mapped.label}</span>;
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Carregando campanhas...</div>;
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Campanhas</h1>
          <p className="text-slate-500 mt-1">Transforme seus objetivos em ações de marketing estruturadas.</p>
        </div>
        <Link 
          to="/campaigns/new"
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 transition-colors flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Nova campanha
        </Link>
      </div>

      {campaigns.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center flex flex-col items-center">
          <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mb-4">
            <Megaphone className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-semibold text-slate-900">Nenhuma campanha criada ainda.</h2>
          <p className="text-slate-500 max-w-sm mt-2 mb-6">
            Transforme um objetivo em uma campanha completa com planejamento, peças e métricas.
          </p>
          <Link 
            to="/campaigns/new"
            className="bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded-lg font-medium hover:bg-slate-50 transition-colors"
          >
            Criar primeira campanha
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {campaigns.map(camp => (
            <Link key={camp.id} to={`/campaigns/${camp.id}`} className="bg-white border border-slate-200 rounded-xl p-6 hover:shadow-md transition-shadow flex flex-col">
              <div className="flex justify-between items-start mb-4">
                {getStatusLabel(camp.status)}
                <button className="text-slate-400 hover:text-slate-600">
                  <MoreHorizontal className="w-5 h-5" />
                </button>
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-1">{camp.name}</h3>
              <p className="text-sm text-slate-500 line-clamp-2 mb-4">{camp.objective}</p>
              
              <div className="mt-auto space-y-3 pt-4 border-t border-slate-100">
                <div className="flex items-center text-sm text-slate-600">
                  <Calendar className="w-4 h-4 mr-2 text-slate-400" />
                  {camp.startDate ? new Date(camp.startDate).toLocaleDateString('pt-BR') : 'Sem data'} 
                  {camp.endDate ? ` → ${new Date(camp.endDate).toLocaleDateString('pt-BR')}` : ''}
                </div>
                <div className="flex items-center text-sm text-slate-600">
                  <Megaphone className="w-4 h-4 mr-2 text-slate-400" />
                  {camp.channels?.length ? camp.channels.map((c: any) => c.channel).join(', ') : 'Nenhum canal'}
                </div>
                <div className="flex items-center text-sm text-slate-600">
                  <BarChart2 className="w-4 h-4 mr-2 text-slate-400" />
                  {camp.primaryMetric || 'Métrica não definida'}
                </div>
                <div className="pt-2 flex justify-end">
                  <span
                    onClick={(e) => {
                      e.preventDefault();
                      window.location.href = `/leads?campaignId=${camp.id}`;
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg text-xs font-semibold transition-colors"
                  >
                    <Users className="w-3.5 h-3.5" />
                    Ver Leads no CRM
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
