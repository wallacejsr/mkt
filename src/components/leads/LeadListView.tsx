import React from 'react';
import { Lead, LeadStatus } from '../../types/lead';
import { Phone, Mail, Building, Clock, AlertCircle, Eye } from 'lucide-react';

interface Props {
  leads: Lead[];
  onSelectLead: (lead: Lead) => void;
}

const STATUS_LABELS: Record<LeadStatus, { label: string; badge: string }> = {
  new: { label: 'Novo', badge: 'bg-blue-50 text-blue-700 border-blue-200' },
  contacted: { label: 'Contatado', badge: 'bg-amber-50 text-amber-700 border-amber-200' },
  interested: { label: 'Interessado', badge: 'bg-purple-50 text-purple-700 border-purple-200' },
  proposal: { label: 'Proposta', badge: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  customer: { label: 'Cliente', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  lost: { label: 'Perdido', badge: 'bg-rose-50 text-rose-700 border-rose-200' },
};

export function LeadListView({ leads, onSelectLead }: Props) {
  const formatCurrency = (val?: number | null) => {
    if (!val) return '-';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      maximumFractionDigits: 0,
    }).format(val);
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('pt-BR');
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              <th className="py-3.5 px-4">Lead / Empresa</th>
              <th className="py-3.5 px-4">Contato</th>
              <th className="py-3.5 px-4">Origem / Campanha</th>
              <th className="py-3.5 px-4">Status</th>
              <th className="py-3.5 px-4">Valor Potencial</th>
              <th className="py-3.5 px-4">Último Contato</th>
              <th className="py-3.5 px-4">Próxima Ação</th>
              <th className="py-3.5 px-4 text-right">Ação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm">
            {leads.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-slate-400 text-sm">
                  Nenhum lead encontrado com os filtros selecionados.
                </td>
              </tr>
            ) : (
              leads.map((lead) => {
                const statusInfo = STATUS_LABELS[lead.status] || { label: lead.status, badge: 'bg-slate-100 text-slate-700 border-slate-200' };
                const isOverdue = lead.nextActionAt && new Date(lead.nextActionAt) < new Date();

                return (
                  <tr
                    key={lead.id}
                    onClick={() => onSelectLead(lead)}
                    className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                  >
                    {/* Name & Company */}
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                        {lead.name}
                      </div>
                      {lead.companyName && (
                        <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                          <Building className="w-3 h-3 text-slate-400" />
                          <span>{lead.companyName}</span>
                        </div>
                      )}
                    </td>

                    {/* Contact info */}
                    <td className="py-3.5 px-4">
                      {lead.phone && (
                        <div className="text-xs text-slate-700 flex items-center gap-1">
                          <Phone className="w-3 h-3 text-slate-400" />
                          <span>{lead.phone}</span>
                        </div>
                      )}
                      {lead.email && (
                        <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                          <Mail className="w-3 h-3 text-slate-400" />
                          <span className="truncate max-w-[160px]">{lead.email}</span>
                        </div>
                      )}
                      {!lead.phone && !lead.email && <span className="text-xs text-slate-400">-</span>}
                    </td>

                    {/* Source & Campaign */}
                    <td className="py-3.5 px-4">
                      <span className="inline-block text-xs font-semibold px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md border border-slate-200">
                        {lead.source}
                      </span>
                      {lead.campaign?.name && (
                        <div className="text-xs text-indigo-600 font-medium mt-1 truncate max-w-[150px]">
                          📣 {lead.campaign.name}
                        </div>
                      )}
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4">
                      <span className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full border ${statusInfo.badge}`}>
                        {statusInfo.label}
                      </span>
                    </td>

                    {/* Value */}
                    <td className="py-3.5 px-4 font-semibold text-slate-800">
                      {formatCurrency(lead.potentialValue)}
                    </td>

                    {/* Last contact */}
                    <td className="py-3.5 px-4 text-xs text-slate-600">
                      {formatDate(lead.lastContactAt)}
                    </td>

                    {/* Next action */}
                    <td className="py-3.5 px-4">
                      {lead.nextAction ? (
                        <div
                          className={`text-xs p-1.5 rounded-lg flex items-center gap-1.5 font-medium ${
                            isOverdue
                              ? 'bg-red-50 text-red-700 border border-red-200'
                              : 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                          }`}
                        >
                          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                          <div className="truncate max-w-[160px]">
                            <span>{lead.nextAction}</span>
                            {lead.nextActionAt && (
                              <span className="block text-[10px] opacity-80">
                                {formatDate(lead.nextActionAt)}
                              </span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">-</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectLead(lead);
                        }}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        title="Ver detalhes"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
