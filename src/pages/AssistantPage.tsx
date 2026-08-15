import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Bot, Loader2, MessageSquareText, Send, Sparkles, Trash2, User } from 'lucide-react';
import { useAuth } from '../lib/auth-context';

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

const suggestions = [
  'O que merece minha atenção hoje?',
  'Sugira três ideias de conteúdo para esta semana.',
  'Como posso melhorar meu funil de vendas?',
  'Crie uma ação rápida para gerar mais leads.',
];

export function AssistantPage() {
  const { business, authFetch } = useAuth();
  const storageKey = useMemo(() => `marketing-os-assistant:${business?.id || 'unknown'}`, [business?.id]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      setMessages(saved ? JSON.parse(saved) : []);
    } catch {
      setMessages([]);
    }
  }, [storageKey]);

  useEffect(() => {
    if (messages.length) localStorage.setItem(storageKey, JSON.stringify(messages.slice(-30)));
    else localStorage.removeItem(storageKey);
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, storageKey]);

  const sendMessage = async (text = input) => {
    const content = text.trim();
    if (!content || !business || sending) return;

    const userMessage: ChatMessage = { role: 'user', content };
    const conversation = [...messages, userMessage];
    setMessages(conversation);
    setInput('');
    setError('');
    setSending(true);

    try {
      const response = await authFetch(`/api/assistant/chat?businessId=${business.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: content,
          history: messages.slice(-8),
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || 'Não foi possível consultar o assistente.');
      setMessages(current => [...current, { role: 'assistant', content: data.answer }]);
    } catch (requestError: any) {
      setError(requestError.message || 'Erro ao consultar o assistente.');
    } finally {
      setSending(false);
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    sendMessage();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="max-w-5xl mx-auto h-[calc(100vh-3rem)] flex flex-col pb-4">
      <header className="flex items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-sm">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Assistente de Marketing</h1>
            <p className="text-sm text-slate-500">Respostas baseadas nos dados de {business?.name || 'sua empresa'}.</p>
          </div>
        </div>
        {messages.length > 0 && (
          <button
            onClick={() => setMessages([])}
            className="inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-xl"
          >
            <Trash2 className="w-4 h-4" /> Limpar conversa
          </button>
        )}
      </header>

      <div className="flex-1 overflow-y-auto py-6 space-y-5">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-4">
            <div className="w-16 h-16 rounded-3xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4">
              <MessageSquareText className="w-8 h-8" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">Como posso ajudar seu negócio hoje?</h2>
            <p className="text-sm text-slate-500 mt-2 max-w-lg">
              Posso analisar seu funil, sugerir campanhas, criar ideias de conteúdo e indicar prioridades usando os dados cadastrados.
            </p>
            <div className="grid sm:grid-cols-2 gap-3 mt-7 w-full max-w-2xl">
              {suggestions.map(suggestion => (
                <button
                  key={suggestion}
                  onClick={() => sendMessage(suggestion)}
                  className="text-left p-4 bg-white border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/40 rounded-2xl text-sm text-slate-700 transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((message, index) => (
            <div key={index} className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {message.role === 'assistant' && (
                <div className="w-8 h-8 shrink-0 rounded-xl bg-indigo-600 text-white flex items-center justify-center">
                  <Bot className="w-4 h-4" />
                </div>
              )}
              <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-6 whitespace-pre-wrap ${
                message.role === 'user'
                  ? 'bg-slate-900 text-white rounded-br-md'
                  : 'bg-white border border-slate-200 text-slate-700 rounded-bl-md shadow-sm'
              }`}>
                {message.content}
              </div>
              {message.role === 'user' && (
                <div className="w-8 h-8 shrink-0 rounded-xl bg-slate-200 text-slate-600 flex items-center justify-center">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          ))
        )}

        {sending && (
          <div className="flex gap-3 items-center text-sm text-slate-500">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center">
              <Bot className="w-4 h-4" />
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-indigo-600" /> Analisando os dados da empresa...
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {error && <p className="text-xs text-rose-600 mb-2 px-1">{error}</p>}
      <form onSubmit={submit} className="bg-white border border-slate-200 rounded-2xl p-2 flex items-end gap-2 shadow-sm focus-within:border-indigo-300">
        <textarea
          value={input}
          onChange={event => setInput(event.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          maxLength={2000}
          placeholder="Pergunte sobre marketing, vendas, conteúdo ou campanhas..."
          className="flex-1 resize-none px-3 py-2.5 text-sm outline-none bg-transparent max-h-32"
        />
        <button
          type="submit"
          disabled={!input.trim() || sending}
          className="w-10 h-10 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-200 disabled:text-slate-400 text-white flex items-center justify-center transition-colors"
          title="Enviar"
        >
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </form>
      <p className="text-[11px] text-center text-slate-400 mt-2">Confira informações importantes antes de tomar decisões.</p>
    </div>
  );
}
