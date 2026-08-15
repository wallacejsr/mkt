import React, { useRef, useState } from 'react';
import { FileSpreadsheet, Upload, X, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { useAuth } from '../../lib/auth-context';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onImported: () => void;
}

interface ImportedRow {
  companyName: string;
  taxId?: string;
  address?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  phone?: string;
  email?: string;
  segment?: string;
  notes?: string;
}

const normalizeHeader = (value: unknown) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim()
  .toUpperCase()
  .replace(/\s+/g, ' ');

const valueOf = (row: Record<string, unknown>, ...headers: string[]) => {
  for (const header of headers) {
    const value = row[normalizeHeader(header)];
    if (value !== undefined && value !== null && String(value).trim()) return String(value).trim();
  }
  return '';
};

export function SpreadsheetImportModal({ isOpen, onClose, onImported }: Props) {
  const { authFetch, business } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<ImportedRow[]>([]);
  const [reading, setReading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ imported: number; duplicates: number; invalid: number } | null>(null);

  if (!isOpen) return null;

  const reset = () => {
    setFileName('');
    setRows([]);
    setProgress(0);
    setError('');
    setResult(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const close = () => {
    if (importing) return;
    reset();
    onClose();
  };

  const handleFile = async (file?: File) => {
    if (!file) return;
    setReading(true);
    setError('');
    setResult(null);
    try {
      if (!/\.(xlsx|xls)$/i.test(file.name)) throw new Error('Selecione um arquivo Excel .xlsx ou .xls.');
      const XLSX = await import('xlsx');
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: false });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      if (!firstSheet) throw new Error('A planilha não possui uma aba com dados.');
      const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, { defval: '', raw: false });
      const normalizedRows = rawRows.map(raw => {
        const row = Object.fromEntries(Object.entries(raw).map(([key, value]) => [normalizeHeader(key), value]));
        const ddd = valueOf(row, 'DDD').replace(/\D/g, '');
        const phoneCandidates = [
          valueOf(row, 'CELULAR'), valueOf(row, 'TELEFONE'), valueOf(row, 'TEL 02'),
          valueOf(row, 'TEL 03'), valueOf(row, 'TEL 04'), valueOf(row, 'TEL 05'), valueOf(row, 'TEL 06'),
        ].filter(value => value && value !== '2');
        let phone = phoneCandidates[0] || '';
        if (phone && ddd && phone.replace(/\D/g, '').length <= 9 && !phone.replace(/\D/g, '').startsWith(ddd)) phone = ddd + phone;
        const extraPhones = phoneCandidates.slice(1).join(', ');
        const originalNotes = valueOf(row, 'OBSERVAÇÕES IMPORTANTES', 'OBSERVACOES IMPORTANTES');
        return {
          companyName: valueOf(row, 'NOME/EMPRESA', 'EMPRESA', 'RAZÃO SOCIAL', 'RAZAO SOCIAL', 'NOME'),
          taxId: valueOf(row, 'CNPJ'),
          address: valueOf(row, 'ENDEREÇO', 'ENDERECO'),
          neighborhood: valueOf(row, 'BAIRRO'),
          city: valueOf(row, 'CIDADE'),
          state: valueOf(row, 'UF', 'ESTADO').toUpperCase(),
          postalCode: valueOf(row, 'CEP'),
          phone,
          email: valueOf(row, 'EMAIL', 'E-MAIL').toLowerCase(),
          segment: valueOf(row, 'SEGMENTO', 'TIPO 2', 'TIPO'),
          notes: [originalNotes, extraPhones ? `Outros telefones: ${extraPhones}` : ''].filter(Boolean).join('\n'),
        };
      }).filter(row => row.companyName);
      if (!normalizedRows.length) throw new Error('Nenhuma empresa foi encontrada. Verifique se existe a coluna NOME/EMPRESA.');
      if (normalizedRows.length > 10000) throw new Error('O limite por arquivo é de 10.000 empresas.');
      setFileName(file.name);
      setRows(normalizedRows);
    } catch (err: any) {
      setRows([]);
      setFileName('');
      setError(err.message || 'Não foi possível ler a planilha.');
    } finally {
      setReading(false);
    }
  };

  const importRows = async () => {
    if (!business?.id || !rows.length) return;
    setImporting(true);
    setError('');
    setResult(null);
    const totals = { imported: 0, duplicates: 0, invalid: 0 };
    const batchKey = crypto.randomUUID();
    const chunkSize = 200;
    try {
      for (let start = 0; start < rows.length; start += chunkSize) {
        const chunk = rows.slice(start, start + chunkSize);
        const response = await authFetch(`/api/prospecting/import-spreadsheet?businessId=${business.id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rows: chunk, fileName, batchKey }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || `Falha ao importar o lote ${Math.floor(start / chunkSize) + 1}.`);
        totals.imported += Number(data.imported || 0);
        totals.duplicates += Number(data.duplicates || 0);
        totals.invalid += Number(data.invalid || 0);
        setProgress(Math.min(100, Math.round(((start + chunk.length) / rows.length) * 100)));
      }
      setResult(totals);
      onImported();
    } catch (err: any) {
      setError(err.message || 'Erro ao importar a planilha.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Importar base de empresas</h2>
            <p className="mt-0.5 text-xs text-slate-500">Excel (.xlsx ou .xls), até 10.000 registros</p>
          </div>
          <button onClick={close} disabled={importing} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button>
        </div>

        <div className="space-y-4 p-6">
          {!rows.length && !result && (
            <button
              onClick={() => inputRef.current?.click()}
              disabled={reading}
              className="flex w-full flex-col items-center rounded-xl border-2 border-dashed border-indigo-200 bg-indigo-50/40 px-6 py-10 text-center hover:border-indigo-400"
            >
              {reading ? <Loader2 className="mb-3 h-8 w-8 animate-spin text-indigo-600" /> : <FileSpreadsheet className="mb-3 h-8 w-8 text-indigo-600" />}
              <span className="text-sm font-bold text-slate-800">{reading ? 'Lendo planilha...' : 'Selecionar planilha'}</span>
              <span className="mt-1 text-xs text-slate-500">A primeira aba do arquivo será importada</span>
            </button>
          )}
          <input ref={inputRef} type="file" accept=".xlsx,.xls" hidden onChange={event => handleFile(event.target.files?.[0])} />

          {rows.length > 0 && !result && (
            <div className="rounded-xl border border-slate-200 p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <FileSpreadsheet className="mt-0.5 h-5 w-5 text-emerald-600" />
                  <div>
                    <p className="text-sm font-bold text-slate-900">{fileName}</p>
                    <p className="text-xs text-slate-500">{rows.length.toLocaleString('pt-BR')} empresas prontas para validação</p>
                  </div>
                </div>
                {!importing && <button onClick={reset} className="text-xs font-semibold text-indigo-600">Trocar arquivo</button>}
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded-lg bg-slate-50 p-2"><strong>{rows.filter(r => r.taxId).length}</strong><br /><span className="text-slate-500">com CNPJ</span></div>
                <div className="rounded-lg bg-slate-50 p-2"><strong>{rows.filter(r => r.email).length}</strong><br /><span className="text-slate-500">com e-mail</span></div>
                <div className="rounded-lg bg-slate-50 p-2"><strong>{rows.filter(r => r.phone).length}</strong><br /><span className="text-slate-500">com telefone</span></div>
              </div>
            </div>
          )}

          {importing && (
            <div>
              <div className="mb-1 flex justify-between text-xs font-semibold text-slate-600"><span>Importando e verificando duplicidades...</span><span>{progress}%</span></div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-indigo-600 transition-all" style={{ width: `${progress}%` }} /></div>
            </div>
          )}

          {error && <div className="flex gap-2 rounded-lg bg-red-50 p-3 text-xs text-red-700"><AlertCircle className="h-4 w-4 shrink-0" />{error}</div>}
          {result && (
            <div className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-900">
              <div className="flex items-center gap-2 font-bold"><CheckCircle2 className="h-5 w-5" />Importação concluída</div>
              <p className="mt-2 text-xs">{result.imported} adicionadas · {result.duplicates} duplicadas ignoradas · {result.invalid} inválidas</p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 px-6 py-4">
          <button onClick={close} disabled={importing} className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700">{result ? 'Fechar' : 'Cancelar'}</button>
          {rows.length > 0 && !result && <button onClick={importRows} disabled={importing} className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-60"><Upload className="h-4 w-4" />Importar {rows.length.toLocaleString('pt-BR')}</button>}
        </div>
      </div>
    </div>
  );
}
