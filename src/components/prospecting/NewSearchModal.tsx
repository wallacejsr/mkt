import React, { useState } from 'react';
import { X, Search, Sparkles, MapPin, Building2, Sliders } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    segment: string;
    city: string;
    state: string;
    country: string;
    radiusKm?: number;
    keywords?: string;
    requestedLimit: number;
  }) => Promise<void>;
}

export function NewSearchModal({ isOpen, onClose, onSubmit }: Props) {
  const [segment, setSegment] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [country, setCountry] = useState('Brasil');
  const [radiusKm, setRadiusKm] = useState<number | undefined>(undefined);
  const [keywords, setKeywords] = useState('');
  const [requestedLimit, setRequestedLimit] = useState(25);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!segment.trim()) {
      setError('Por favor, informe o segmento desejado.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await onSubmit({
        segment: segment.trim(),
        city: city.trim(),
        state: state.trim(),
        country: country.trim() || 'Brasil',
        radiusKm,
        keywords: keywords.trim(),
        requestedLimit,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Erro ao iniciar busca.');
    } finally {
      setLoading(false);
    }
  };

  const sampleSegments = [
    'Clínicas odontológicas',
    'Escritórios de contabilidade',
    'Imobiliárias',
    'Empresas de energia solar',
    'Revendas agrícolas',
    'Academias',
    'Restaurantes',
    'Indústrias'
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
              <Search className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Nova Busca de Prospects</h2>
              <p className="text-xs text-slate-500">Encontre contatos comerciais públicos de empresas do seu segmento</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="p-3 bg-red-50 text-red-700 text-xs rounded-lg border border-red-200">
              {error}
            </div>
          )}

          {/* Segmento */}
          <div>
            <label className="block text-xs font-semibold uppercase text-slate-600 tracking-wider mb-1">
              Segmento de Atuação <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Building2 className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                value={segment}
                onChange={(e) => setSegment(e.target.value)}
                placeholder="Ex: Clínicas odontológicas, Imobiliárias..."
                className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                required
              />
            </div>

            {/* Quick Segment Suggestions */}
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="text-[11px] text-slate-400 self-center mr-1">Sugestões:</span>
              {sampleSegments.slice(0, 4).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSegment(s)}
                  className="px-2 py-0.5 text-xs bg-slate-100 text-slate-600 rounded-full hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Localização */}
          <div>
            <label className="block text-xs font-semibold uppercase text-slate-600 tracking-wider mb-1">
              Localização
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="relative">
                <MapPin className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Cidade (ex: Goiânia)"
                  className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              <div>
                <input
                  type="text"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  placeholder="Estado (ex: GO)"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              <div>
                <input
                  type="text"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  placeholder="País (ex: Brasil)"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Quantidade de Empresas */}
          <div>
            <label className="block text-xs font-semibold uppercase text-slate-600 tracking-wider mb-1">
              Quantas empresas deseja encontrar?
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[25, 50, 100, 250].map((qty) => (
                <button
                  key={qty}
                  type="button"
                  onClick={() => setRequestedLimit(qty)}
                  className={`py-2 text-xs font-medium rounded-lg border transition-all ${
                    requestedLimit === qty
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                      : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {qty} empresas
                </button>
              ))}
            </div>
          </div>

          {/* Filtros Opcionais & Palavras-chave */}
          <div>
            <label className="block text-xs font-semibold uppercase text-slate-600 tracking-wider mb-1">
              Palavras-chave Opcionais
            </label>
            <div className="relative">
              <Sliders className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                placeholder="Ex: alto padrão, suporte corporativo..."
                className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Guardrail compliance notice */}
          <div className="p-3 bg-amber-50/60 rounded-lg border border-amber-200/80 text-[11px] text-amber-800 flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <span>
              <strong>Compliance & Privacidade:</strong> Coletamos exclusivamente contatos comerciais públicos e e-mails institucionais disponibilizados pelas próprias empresas em seus sites oficiais.
            </span>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg shadow-sm transition-colors flex items-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Iniciando Busca...
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  Buscar Empresas
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
