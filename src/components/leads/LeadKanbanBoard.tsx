import React, { useState } from 'react';
import { Lead, LeadStatus } from '../../types/lead';
import { Building, DollarSign, Calendar, AlertCircle, Clock, CheckCircle2, XCircle } from 'lucide-react';

interface Props {
  leads: Lead[];
  onMoveStatus: (leadId: string, newStatus: LeadStatus) => Promise<void>;
  onSelectLead: (lead: Lead) => void;
  showLostColumn?: boolean;
}

const COLUMNS: { id: LeadStatus; title: string; color: string; badge: string }[] = [
  { id: 'new', title: 'Novo', color: 'border-t-blue-500', badge: 'bg-blue-50 text-blue-700 border-blue-200' },
  { id: 'contacted', title: 'Contatado', color: 'border-t-amber-500', badge: 'bg-amber-50 text-amber-700 border-amber-200' },
  { id: 'interested', title: 'Interessado', color: 'border-t-purple-500', badge: 'bg-purple-50 text-purple-700 border-purple-200' },
  { id: 'proposal', title: 'Proposta', color: 'border-t-indigo-500', badge: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  { id: 'customer', title: 'Cliente', color: 'border-t-emerald-500', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
];

export function LeadKanbanBoard({ leads, onMoveStatus, onSelectLead, showLostColumn = false }: Props) {
  const [draggedLeadId, setDraggedLeadId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<LeadStatus | null>(null);
  const [movingLeadId, setMovingLeadId] = useState<string | null>(null);

  const activeColumns = showLostColumn
    ? [...COLUMNS, { id: 'lost' as LeadStatus, title: 'Perdido', color: 'border-t-rose-500', badge: 'bg-rose-50 text-rose-700 border-rose-200' }]
    : COLUMNS;

  const formatValue = (val?: number | null) => {
    if (!val) return null;
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      maximumFractionDigits: 0,
    }).format(val);
  };

  const formatDaysAgo = (dateStr?: string | null) => {
    if (!dateStr) return 'Sem contato';
    const date = new Date(dateStr);
    const now = new Date();
    const diffHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));

    if (diffHours < 24) return 'Hoje';
    const days = Math.floor(diffHours / 24);
    if (days === 1) return 'Há 1 dia';
    return `Há ${days} dias`;
  };

  const handleDragStart = (e: React.DragEvent, leadId: string) => {
    e.dataTransfer.setData('text/plain', leadId);
    setDraggedLeadId(leadId);
  };

  const handleDragOver = (e: React.DragEvent, colId: LeadStatus) => {
    e.preventDefault();
    setDragOverColumn(colId);
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDrop = async (e: React.DragEvent, targetStatus: LeadStatus) => {
    e.preventDefault();
    setDragOverColumn(null);
    const leadId = e.dataTransfer.getData('text/plain') || draggedLeadId;
    if (!leadId) return;

    const lead = leads.find((l) => l.id === leadId);
    if (!lead || lead.status === targetStatus) return;

    try {
      setMovingLeadId(leadId);
      await onMoveStatus(leadId, targetStatus);
    } catch (err) {
      console.error("Failed to move lead:", err);
    } finally {
      setMovingLeadId(null);
      setDraggedLeadId(null);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-5 gap-4 overflow-x-auto pb-6 pt-2 items-start">
      {activeColumns.map((col) => {
        const columnLeads = leads.filter((l) => l.status === col.id);
        const colValueSum = columnLeads.reduce((acc, l) => acc + (l.potentialValue || 0), 0);
        const isTarget = dragOverColumn === col.id;

        return (
          <div
            key={col.id}
            onDragOver={(e) => handleDragOver(e, col.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, col.id)}
            className={`bg-slate-100/80 rounded-2xl p-3 border-t-4 ${col.color} border-x border-b border-slate-200/80 min-h-[500px] flex flex-col transition-all ${
              isTarget ? 'bg-indigo-50/70 border-indigo-400 ring-2 ring-indigo-300 ring-offset-1' : ''
            }`}
          >
            {/* Column Header */}
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200/60 px-1">
              <div className="flex items-center gap-2">
                <h4 className="font-bold text-sm text-slate-800">{col.title}</h4>
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold border ${col.badge}`}>
                  {columnLeads.length}
                </span>
              </div>
              {colValueSum > 0 && (
                <span className="text-xs font-semibold text-slate-500">
                  {formatValue(colValueSum)}
                </span>
              )}
            </div>

            {/* Cards List */}
            <div className="space-y-3 flex-1">
              {columnLeads.length === 0 ? (
                <div className="h-32 flex flex-col items-center justify-center text-center text-slate-400 border-2 border-dashed border-slate-200 rounded-xl p-4">
                  <p className="text-xs font-medium">Nenhum lead nesta etapa</p>
                </div>
              ) : (
                columnLeads.map((lead) => {
                  const isMoving = movingLeadId === lead.id;
                  const valueDisplay = formatValue(lead.potentialValue);
                  const isOverdue = lead.nextActionAt && new Date(lead.nextActionAt) < new Date();

                  return (
                    <div
                      key={lead.id}
                      draggable={!isMoving}
                      onDragStart={(e) => handleDragStart(e, lead.id)}
                      onClick={() => onSelectLead(lead)}
                      className={`bg-white rounded-xl p-4 border border-slate-200 shadow-sm hover:shadow-md transition-all cursor-grab active:cursor-grabbing relative group ${
                        isMoving ? 'opacity-50 pointer-events-none' : ''
                      }`}
                    >
                      {/* Name & Company */}
                      <div className="flex items-start justify-between gap-2">
                        <h5 className="font-bold text-sm text-slate-900 group-hover:text-indigo-600 transition-colors line-clamp-1">
                          {lead.name}
                        </h5>
                        <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md flex-shrink-0">
                          {lead.source}
                        </span>
                      </div>

                      {lead.companyName && (
                        <p className="text-xs text-slate-500 flex items-center gap-1 mt-1 truncate">
                          <Building className="w-3 h-3 flex-shrink-0 text-slate-400" />
                          <span className="truncate">{lead.companyName}</span>
                        </p>
                      )}

                      {/* Value & Days since last contact */}
                      <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-800">
                          {valueDisplay || <span className="text-slate-400 font-normal">Sem valor</span>}
                        </span>
                        <span className="text-slate-400 text-[11px] flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDaysAgo(lead.lastContactAt)}
                        </span>
                      </div>

                      {/* Next Action Badge */}
                      {lead.nextAction && (
                        <div
                          className={`mt-2 p-1.5 rounded-lg text-[11px] flex items-center gap-1.5 font-medium ${
                            isOverdue
                              ? 'bg-red-50 text-red-700 border border-red-200'
                              : 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                          }`}
                        >
                          <AlertCircle className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">{lead.nextAction}</span>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
