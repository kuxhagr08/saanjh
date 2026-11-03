import React, { useState, useEffect, useRef } from 'react';
import { db, type LocalAIConversation } from '../db';
import {
  Sparkles,
  Send,
  Bot,
  User as UserIcon,
  Key,
  X,
  Plus,
  Lock,
  Trash2,
  Loader2,
  ChevronLeft,
  AlertCircle,
} from 'lucide-react';

interface AIPersona {
  id: string;
  name: string;
  icon: string;
  systemPrompt: string;
  description: string;
  color: string;
  bg: string;
}

const personas: AIPersona[] = [
  {
    id: 'coach',
    name: 'Life Coach',
    icon: '🌟',
    description: 'Mindful reflection & growth',
    systemPrompt: 'You are a calm, wise life coach. Help the user reflect, set intentions, and grow.',
    color: 'text-amber-600',
    bg: 'bg-amber-50 border-amber-200',
  },
  {
    id: 'coder',
    name: 'Dev Partner',
    icon: '💻',
    description: 'Code review & architecture',
    systemPrompt: 'You are an expert software engineer. Help with code, architecture, and debugging.',
    color: 'text-blue-600',
    bg: 'bg-blue-50 border-blue-200',
  },
  {
    id: 'teacher',
    name: 'Tutor',
    icon: '📚',
    description: 'Learn anything, simply',
    systemPrompt: 'You are a patient, brilliant teacher. Break down complex topics into simple explanations.',
    color: 'text-green-600',
    bg: 'bg-green-50 border-green-200',
  },
  {
    id: 'writer',
    name: 'Writing Partner',
    icon: '✍️',
    description: 'Essays, stories, emails',
    systemPrompt: 'You are a talented editor and writing partner. Help draft and refine writing.',
    color: 'text-purple-600',
    bg: 'bg-purple-50 border-purple-200',
  },
];

type Provider = 'gemini' | 'openai';

export const AIPage: React.FC = () => {
  const [conversations, setConversations] = useState<LocalAIConversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<number | null>(null);
  const [activeConv, setActiveConv] = useState<LocalAIConversation | null>(null);
  const [selectedPersona, setSelectedPersona] = useState<AIPersona>(personas[0]);
  const [inputVal, setInputVal] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const [provider, setProvider] = useState<Provider>('gemini');
  const [apiKey, setApiKey] = useState('');
  const [isKeyConfigured, setIsKeyConfigured] = useState(false);
  const [configuredProvider, setConfiguredProvider] = useState<Provider>('gemini');
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadConversations();
    checkSavedKey();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeConv?.messages, streamingText]);

  const loadConversations = async () => {
    const convs = await db.aiConversations.orderBy('updatedAt').reverse().toArray();
    setConversations(convs);
    if (convs.length > 0 && !activeConvId) {
      setActiveConvId(convs[0].id!);
      setActiveConv(convs[0]);
    }
  };

  const checkSavedKey = async () => {
    const gemKey = await db.settings.get('ai_gemini_key');
    const oaiKey = await db.settings.get('ai_openai_key');
    const prov = await db.settings.get('ai_provider');
    if (gemKey?.value || oaiKey?.value) {
      setIsKeyConfigured(true);
      setConfiguredProvider((prov?.value as Provider) || 'gemini');
    }
  };

  const handleSaveKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim()) return;
    await db.settings.put({ key: `ai_${provider}_key`, value: apiKey.trim() });
    await db.settings.put({ key: 'ai_provider', value: provider });
    setIsKeyConfigured(true);
    setConfiguredProvider(provider);
    setShowKeyModal(false);
    setApiKey('');
  };

  const handleNewConversation = async () => {
    const newConv: LocalAIConversation = {
      title: `Chat with ${selectedPersona.name}`,
      persona: selectedPersona.id,
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const id = await db.aiConversations.add(newConv);
    newConv.id = id as number;
    setConversations((prev) => [newConv, ...prev]);
    setActiveConvId(id as number);
    setActiveConv(newConv);
    setShowSidebar(false);
  };

  const callGemini = async (messages: any[], apiKeyValue: string): Promise<string> => {
    const history = messages.slice(0, -1).map((m) => ({
      role: m.role === 'assistant' ? 'model' : m.role,
      parts: [{ text: m.content }],
    }));
    const lastMsg = messages[messages.length - 1];

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKeyValue}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: selectedPersona.systemPrompt }] },
          contents: [...history, { role: 'user', parts: [{ text: lastMsg.content }] }],
          generationConfig: { maxOutputTokens: 2048, temperature: 0.85 },
        }),
      }
    );
    if (!res.ok) throw new Error(`Gemini API error: ${res.status}`);
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response';
  };

  const callOpenAI = async (messages: any[], apiKeyValue: string): Promise<string> => {
    const formattedMessages = [
      { role: 'system', content: selectedPersona.systemPrompt },
      ...messages.map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content })),
    ];
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKeyValue}`,
      },
      body: JSON.stringify({ model: 'gpt-4o-mini', messages: formattedMessages, max_tokens: 2048 }),
    });
    if (!res.ok) throw new Error(`OpenAI error: ${res.status}`);
    const data = await res.json();
    return data.choices?.[0]?.message?.content || 'No response';
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputVal.trim() || isStreaming) return;

    if (!isKeyConfigured) {
      setShowKeyModal(true);
      return;
    }

    let conv = activeConv;
    if (!conv) {
      const newConv: LocalAIConversation = {
        title: inputVal.slice(0, 40),
        persona: selectedPersona.id,
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      const id = await db.aiConversations.add(newConv);
      newConv.id = id as number;
      conv = newConv;
      setActiveConvId(id as number);
    }

    const userMsg = { role: 'user' as const, content: inputVal.trim(), timestamp: Date.now() };
    const updatedMessages = [...(conv.messages || []), userMsg];
    await db.aiConversations.update(conv.id!, { messages: updatedMessages, updatedAt: Date.now() });
    setActiveConv({ ...conv, messages: updatedMessages });
    setInputVal('');
    setIsStreaming(true);
    setStreamingText('');

    try {
      const provKey = await db.settings.get(`ai_${configuredProvider}_key`);
      if (!provKey?.value) throw new Error('API key not found');

      let response: string;
      if (configuredProvider === 'gemini') {
        response = await callGemini(updatedMessages, provKey.value);
      } else {
        response = await callOpenAI(updatedMessages, provKey.value);
      }

      // Simulate streaming
      const words = response.split(' ');
      let built = '';
      for (const word of words) {
        built += (built ? ' ' : '') + word;
        setStreamingText(built);
        await new Promise((r) => setTimeout(r, 18));
      }

      const assistantMsg = { role: 'assistant' as const, content: response, timestamp: Date.now() };
      const finalMessages = [...updatedMessages, assistantMsg];
      await db.aiConversations.update(conv.id!, {
        messages: finalMessages,
        updatedAt: Date.now(),
        ...(conv.messages.length === 0 ? { title: inputVal.slice(0, 45) } : {}),
      });
      setActiveConv({ ...conv, messages: finalMessages });
    } catch (err: any) {
      const errMsg = { role: 'assistant' as const, content: `❌ Error: ${err.message}. Please check your API key.`, timestamp: Date.now() };
      const finalMessages = [...updatedMessages, errMsg];
      setActiveConv({ ...conv!, messages: finalMessages });
    } finally {
      setIsStreaming(false);
      setStreamingText('');
      await loadConversations();
    }
  };

  const handleDeleteConv = async (id: number) => {
    await db.aiConversations.delete(id);
    if (activeConvId === id) {
      setActiveConvId(null);
      setActiveConv(null);
    }
    await loadConversations();
  };

  return (
    <div className="animate-fade-in -mx-4 -mt-5 h-[calc(100vh-3.5rem)] flex flex-col md:flex-row overflow-hidden">
      {/* Sidebar */}
      <div className={`w-full md:w-64 flex-shrink-0 border-r border-apna-border flex flex-col bg-white ${!showSidebar ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-4 border-b border-apna-border flex items-center justify-between">
          <h2 className="font-semibold text-apna-text text-sm flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-apna-accent" />
            AI Sanctuary
          </h2>
          <button
            onClick={handleNewConversation}
            className="w-7 h-7 rounded-lg bg-apna-accent-soft text-apna-accent flex items-center justify-center hover:bg-apna-accent hover:text-white transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Persona selector */}
        <div className="p-3 border-b border-apna-border">
          <p className="text-[10px] font-semibold text-apna-muted uppercase tracking-widest mb-2">Persona</p>
          <div className="grid grid-cols-2 gap-1.5">
            {personas.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedPersona(p)}
                className={`p-2 rounded-xl text-left transition-all border ${
                  selectedPersona.id === p.id ? `${p.bg} border-opacity-50` : 'border-transparent hover:bg-apna-surface-2'
                }`}
              >
                <span className="text-base">{p.icon}</span>
                <p className={`text-[10px] font-semibold mt-0.5 ${selectedPersona.id === p.id ? p.color : 'text-apna-muted'}`}>
                  {p.name}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Conversations */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {conversations.length === 0 ? (
            <p className="text-xs text-apna-faint text-center py-6">No conversations yet</p>
          ) : (
            conversations.map((conv) => (
              <div key={conv.id} className="group relative">
                <button
                  onClick={() => { setActiveConvId(conv.id!); setActiveConv(conv); setShowSidebar(false); }}
                  className={`w-full px-3 py-2.5 rounded-xl text-left transition-colors ${
                    activeConvId === conv.id
                      ? 'bg-apna-accent-soft text-apna-accent'
                      : 'hover:bg-apna-surface-2 text-apna-muted'
                  }`}
                >
                  <p className="text-xs font-medium truncate">{conv.title}</p>
                  <p className="text-[10px] text-apna-faint mt-0.5">
                    {new Date(conv.updatedAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                  </p>
                </button>
                <button
                  onClick={() => handleDeleteConv(conv.id!)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-50 text-apna-faint hover:text-apna-danger transition-all"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))
          )}
        </div>

        {/* BYOK status */}
        <div className="p-3 border-t border-apna-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Lock className="w-3 h-3 text-apna-success" />
              <span className="text-[11px] text-apna-muted">BYOK · Zero server logs</span>
            </div>
            <button
              onClick={() => setShowKeyModal(true)}
              className="text-[11px] text-apna-accent font-medium flex items-center gap-1 hover:underline"
            >
              <Key className="w-3 h-3" />
              {isKeyConfigured ? 'Change' : 'Set Key'}
            </button>
          </div>
        </div>
      </div>

      {/* Chat area */}
      <div className={`flex-1 flex flex-col bg-apna-bg ${showSidebar ? 'hidden md:flex' : 'flex'}`}>
        {/* Header */}
        <div className="bg-white border-b border-apna-border px-4 py-3 flex items-center gap-3">
          <button onClick={() => setShowSidebar(true)} className="md:hidden p-1.5 rounded-lg hover:bg-apna-surface-2 text-apna-muted">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-lg">{selectedPersona.icon}</span>
          <div className="flex-1">
            <p className="text-sm font-semibold text-apna-text">{selectedPersona.name}</p>
            <p className="text-[10px] text-apna-faint">{selectedPersona.description}</p>
          </div>
          {!isKeyConfigured && (
            <button
              onClick={() => setShowKeyModal(true)}
              className="flex items-center gap-1.5 text-xs text-amber-600 font-medium bg-amber-50 border border-amber-200 px-2.5 py-1.5 rounded-lg hover:bg-amber-100 transition-colors"
            >
              <Key className="w-3 h-3" />
              Add API Key
            </button>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {(!activeConv || activeConv.messages.length === 0) ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-apna-accent-soft flex items-center justify-center text-3xl">
                {selectedPersona.icon}
              </div>
              <div>
                <h3 className="font-semibold text-apna-text">Chat with your {selectedPersona.name}</h3>
                <p className="text-sm text-apna-muted mt-1 max-w-xs">
                  {selectedPersona.description}. Your conversations stay on-device.
                </p>
              </div>
              {!isKeyConfigured && (
                <button onClick={() => setShowKeyModal(true)} className="btn-primary text-sm">
                  <Key className="w-4 h-4" />
                  Set API Key to Start
                </button>
              )}
            </div>
          ) : (
            activeConv.messages.map((m, idx) => (
              <div key={idx} className={`flex gap-3 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {m.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-xl bg-apna-accent-soft flex items-center justify-center shrink-0 self-start text-base">
                    {selectedPersona.icon}
                  </div>
                )}
                <div
                  className={`max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    m.role === 'user'
                      ? 'bg-apna-accent text-white rounded-br-md'
                      : 'bg-white border border-apna-border text-apna-text rounded-bl-md shadow-sm'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{m.content}</p>
                </div>
                {m.role === 'user' && (
                  <div className="w-8 h-8 rounded-xl bg-apna-success/10 flex items-center justify-center shrink-0 self-start">
                    <UserIcon className="w-4 h-4 text-apna-success" />
                  </div>
                )}
              </div>
            ))
          )}

          {/* Streaming text */}
          {isStreaming && streamingText && (
            <div className="flex gap-3 justify-start">
              <div className="w-8 h-8 rounded-xl bg-apna-accent-soft flex items-center justify-center shrink-0 self-start text-base">
                {selectedPersona.icon}
              </div>
              <div className="max-w-[78%] bg-white border border-apna-border rounded-2xl rounded-bl-md px-4 py-3 text-sm leading-relaxed text-apna-text shadow-sm">
                <p className="whitespace-pre-wrap">{streamingText}</p>
                <span className="inline-block w-1.5 h-4 bg-apna-accent rounded-full animate-pulse ml-0.5 -mb-0.5" />
              </div>
            </div>
          )}

          {isStreaming && !streamingText && (
            <div className="flex gap-3 justify-start">
              <div className="w-8 h-8 rounded-xl bg-apna-accent-soft flex items-center justify-center shrink-0">
                {selectedPersona.icon}
              </div>
              <div className="bg-white border border-apna-border rounded-2xl rounded-bl-md px-4 py-3">
                <Loader2 className="w-4 h-4 text-apna-accent animate-spin" />
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Input */}
        <form onSubmit={handleSendMessage} className="bg-white border-t border-apna-border p-3">
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder={isKeyConfigured ? `Ask your ${selectedPersona.name}...` : 'Set your API key to chat...'}
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              disabled={isStreaming}
              className="flex-1 bg-apna-surface-2 border border-apna-border rounded-xl px-4 py-2.5 text-sm text-apna-text placeholder:text-apna-faint focus:outline-none focus:border-apna-accent transition-colors"
            />
            <button
              type="submit"
              disabled={isStreaming || !inputVal.trim()}
              className="w-10 h-10 rounded-xl bg-apna-accent text-white flex items-center justify-center disabled:opacity-40 hover:bg-apna-accent-ink transition-colors shadow-sm shrink-0"
            >
              {isStreaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        </form>
      </div>

      {/* BYOK Modal */}
      {showKeyModal && (
        <div className="modal-overlay" onClick={() => setShowKeyModal(false)}>
          <div className="modal-content max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-apna-text flex items-center gap-2">
                <Key className="w-4 h-4 text-amber-500" />
                Bring Your Own Key (BYOK)
              </h3>
              <button onClick={() => setShowKeyModal(false)} className="text-apna-faint">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex gap-2 items-start mb-4">
              <Lock className="w-3.5 h-3.5 text-apna-success shrink-0 mt-0.5" />
              <p className="text-xs text-emerald-700">
                Your API key is stored only in your browser's IndexedDB. It never touches Saanjh servers. Calls go directly from your browser to the AI provider.
              </p>
            </div>

            <form onSubmit={handleSaveKey} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-apna-muted uppercase tracking-wide mb-2 block">
                  Provider
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'gemini' as Provider, label: 'Google Gemini', emoji: '🔮' },
                    { id: 'openai' as Provider, label: 'OpenAI / Compatible', emoji: '🧠' },
                  ].map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setProvider(p.id)}
                      className={`py-2.5 px-3 rounded-xl text-xs font-medium border transition-all ${
                        provider === p.id
                          ? 'border-apna-accent bg-apna-accent-soft text-apna-accent'
                          : 'border-apna-border bg-apna-surface-2 text-apna-muted hover:text-apna-text'
                      }`}
                    >
                      {p.emoji} {p.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-apna-muted uppercase tracking-wide mb-1.5 block">
                  {provider === 'gemini' ? 'Google AI Studio API Key' : 'OpenAI API Key'}
                </label>
                <input
                  type="password"
                  required
                  placeholder="sk-... or AIzaSy..."
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="apna-input font-mono text-sm"
                />
              </div>
              <button type="submit" className="btn-primary w-full">
                Save Key Locally
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
