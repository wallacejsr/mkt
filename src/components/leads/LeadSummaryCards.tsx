import React from 'react';
import { LeadSummary } from '../../types/lead';
import { Users, UserPlus, TrendingUp, CheckCircle, DollarSign } from 'lucide-react';

interface Props {
  summary: LeadSummary;
}

export function LeadSummaryCards({ summary }: Props) {
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      maximumFractionDigits: 0,
    }).format(val || 0);
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 sm:gap-4 mb-6">
      {/* Total Leads */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total de Leads</p>
          <p className="text-xl sm:text-2xl font-bold text-slate-900 mt-1">{summary.total}</p>
        </div>
        <div className="p-2.5 bg-slate-100 text-slate-600 rounded-lg">
          <Users className="w-5 h-5" />
        </div>
      </div>

      {/* Novos */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Novos</p>
          <p className="text-xl sm:text-2xl font-bold text-blue-600 mt-1">{summary.newCount}</p>
        </div>
        <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg">
          <UserPlus className="w-5 h-5" />
        </div>
      </div>

      {/* Em Negociação */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Em Negociação</p>
          <p className="text-xl sm:text-2xl font-bold text-amber-600 mt-1">{summary.inNegotiationCount}</p>
        </div>
        <div className="p-2.5 bg-amber-50 text-amber-600 rounded-lg">
          <TrendingUp className="w-5 h-5" />
        </div>
      </div>

      {/* Clientes */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Clientes</p>
          <p className="text-xl sm:text-2xl font-bold text-emerald-600 mt-1">{summary.customerCount}</p>
        </div>
        <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-lg">
          <CheckCircle className="w-5 h-5" />
        </div>
      </div>

      {/* Valor Potencial */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between col-span-2 md:col-span-1">
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Valor Potencial</p>
          <p className="text-xl sm:text-2xl font-bold text-indigo-600 mt-1 truncate">
            {formatCurrency(summary.totalPotentialValue)}
          </p>
        </div>
        <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-lg flex-shrink-0">
          <DollarSign className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}
