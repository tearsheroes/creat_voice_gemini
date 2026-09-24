import React, { useState, useEffect } from 'react';
import { RefinementSettings } from '../types';
import { getStoredApiSettings, saveApiSettings } from '../utils/apiSettingsStorage';
import { Sparkles, X, ArrowRight, Wand2, RefreshCw, Key, Server, Check } from 'lucide-react';

interface TextRefinementModalProps {
  isOpen: boolean;
  onClose: () => void;
  originalText: string;
  onApplyRefinedText: (refinedText: string, mode?: string) => void;
}

export const TextRefinementModal: React.FC<TextRefinementModalProps> = ({
  isOpen,
  onClose,
  originalText,
  onApplyRefinedText,
}) => {
  const [provider, setProvider] = useState<'gemini' | 'deepseek' | 'openrouter'>('gemini');
  const [mode, setMode] = useState<
    'prosody' | 'speech_smoothing' | 'auto_dialogue' | 'formal_news' | 'story_dramatic' | 'insert_audio_tags'
  >('insert_audio_tags');
  
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [customApiKey, setCustomApiKey] = useState('');
  const [customEndpoint, setCustomEndpoint] = useState('');
  const [showApiSettings, setShowApiSettings] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [refinedOutput, setRefinedOutput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (isOpen) {
      const stored = getStoredApiSettings();
      setProvider(stored.provider || 'gemini');
      setGeminiApiKey(stored.geminiApiKey || '');
      setCustomApiKey(stored.customApiKey || '');
      setCustomEndpoint(stored.customEndpoint || '');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const updateGlobalSettings = (
    newProvider: 'gemini' | 'deepseek' | 'openrouter',
    newCustomKey?: string,
    newEndpoint?: string,
    newGeminiKey?: string
  ) => {
    const p = newProvider;
    const ck = newCustomKey !== undefined ? newCustomKey : customApiKey;
    const ep = newEndpoint !== undefined ? newEndpoint : customEndpoint;
    const gk = newGeminiKey !== undefined ? newGeminiKey : geminiApiKey;
    saveApiSettings({
      provider: p,
      customApiKey: ck,
      customEndpoint: ep,
      geminiApiKey: gk,
    });
  };

  const handleRefine = async () => {
    if (!originalText || !originalText.trim()) {
      setErrorMsg('Vui lòng nhập văn bản trước khi tinh chỉnh.');
      return;
    }

    setIsLoading(true);
    setErrorMsg('');

    try {
      const stored = getStoredApiSettings();
      const res = await fetch('/api/ai/refine-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: originalText,
          mode,
          provider: stored.provider || provider,
          geminiApiKey: stored.geminiApiKey || undefined,
          customApiKey: stored.customApiKey || undefined,
          customEndpoint: stored.customEndpoint || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Lỗi tinh chỉnh văn bản.');
      }

      setRefinedOutput(data.refinedText);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Có lỗi xảy ra khi xử lý AI.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApply = () => {
    if (refinedOutput) {
      onApplyRefinedText(refinedOutput, mode);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-600 text-white shadow-lg">
              <Wand2 className="h-5 w-5 animate-spin-slow" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                Tinh Chỉnh & Tối Ưu Hóa Kịch Bản Đọc AI
              </h3>
              <p className="text-xs text-slate-400">
                Sử dụng Gemini 3.6 Flash / Endpoint DeepSeek / OpenRouter để tăng tính diễn cảm & tự nhiên
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Configuration Bar */}
        <div className="p-5 border-b border-slate-800/80 bg-slate-950/30 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Provider Switcher */}
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                Mô hình & Provider AI:
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => {
                    setProvider('gemini');
                    updateGlobalSettings('gemini');
                  }}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold border transition flex items-center justify-center space-x-1.5 ${
                    provider === 'gemini'
                      ? 'bg-cyan-600/20 text-cyan-300 border-cyan-500/50 shadow-sm'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
                  <span>Gemini 3.6 Flash</span>
                </button>

                <button
                  onClick={() => {
                    setProvider('deepseek');
                    const ep = customEndpoint || 'https://api.deepseek.com/chat/completions';
                    if (!customEndpoint) setCustomEndpoint(ep);
                    updateGlobalSettings('deepseek', undefined, ep);
                  }}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold border transition flex items-center justify-center space-x-1.5 ${
                    provider === 'deepseek'
                      ? 'bg-blue-600/20 text-blue-300 border-blue-500/50 shadow-sm'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Server className="h-3.5 w-3.5 text-blue-400" />
                  <span>DeepSeek API</span>
                </button>

                <button
                  onClick={() => {
                    setProvider('openrouter');
                    const ep = customEndpoint || 'https://openrouter.ai/api/v1/chat/completions';
                    if (!customEndpoint) setCustomEndpoint(ep);
                    updateGlobalSettings('openrouter', undefined, ep);
                  }}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold border transition flex items-center justify-center space-x-1.5 ${
                    provider === 'openrouter'
                      ? 'bg-purple-600/20 text-purple-300 border-purple-500/50 shadow-sm'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Key className="h-3.5 w-3.5 text-purple-400" />
                  <span>OpenRouter API</span>
                </button>
              </div>
            </div>

            {/* Mode Picker */}
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                Chế độ tinh chỉnh kịch bản:
              </label>
              <select
                value={mode}
                onChange={(e: any) => setMode(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-cyan-500 font-medium"
              >
                <option value="insert_audio_tags">Tự động đề xuất & Chèn Thẻ Biểu Cảm Âm Thanh [whispering], [gasping], [sighs], [excited]</option>
                <option value="prosody">Chèn dấu ngắt nghỉ tự nhiên [pause 0.5s], nhấn giọng</option>
                <option value="speech_smoothing">Chuẩn hóa văn viết sang văn nói 100% tự nhiên</option>
                <option value="auto_dialogue">Tự động chuyển câu chuyện thành Kịch Bản Đa Thoại 2 người</option>
                <option value="formal_news">Tối ưu phong cách Bản Tin Thời Sự trang trọng</option>
                <option value="story_dramatic">Tối ưu phong cách Sách Nói kể chuyện kịch tính</option>
              </select>
            </div>
          </div>

          {/* Toggle Custom Endpoint Config */}
          {(provider === 'deepseek' || provider === 'openrouter') && (
            <div className="pt-2 border-t border-slate-800/60">
              <button
                onClick={() => setShowApiSettings(!showApiSettings)}
                className="text-xs text-cyan-400 hover:text-cyan-300 font-medium flex items-center gap-1"
              >
                <Key className="h-3.5 w-3.5" />
                {showApiSettings ? 'Ẩn cấu hình Endpoint API tùy chọn' : 'Thiết lập Endpoint & API Key tùy chỉnh (Không bắt buộc)'}
              </button>

              {showApiSettings && (
                <div className="mt-3 p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2 text-xs">
                  <div>
                    <label className="text-slate-400 block mb-1 font-medium">Endpoint URL:</label>
                    <input
                      type="text"
                      placeholder={
                        provider === 'deepseek'
                          ? 'https://api.deepseek.com/chat/completions'
                          : 'https://openrouter.ai/api/v1/chat/completions'
                      }
                      value={customEndpoint}
                      onChange={(e) => {
                        const val = e.target.value;
                        setCustomEndpoint(val);
                        updateGlobalSettings(provider, undefined, val);
                      }}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-slate-200"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1 font-medium">API Key tùy chỉnh:</label>
                    <input
                      type="password"
                      placeholder="sk-..."
                      value={customApiKey}
                      onChange={(e) => {
                        const val = e.target.value;
                        setCustomApiKey(val);
                        updateGlobalSettings(provider, val);
                      }}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-slate-200"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Content Display Grid */}
        <div className="p-5 flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Original Text */}
          <div className="flex flex-col">
            <label className="text-xs font-semibold text-slate-400 mb-1.5 flex items-center justify-between">
              <span>Văn bản gốc:</span>
              <span className="text-[11px] text-slate-500">{originalText.length} ký tự</span>
            </label>
            <div className="flex-1 min-h-[160px] bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 text-xs text-slate-300 leading-relaxed overflow-y-auto font-mono">
              {originalText || <span className="text-slate-600 italic">Chưa có văn bản gốc.</span>}
            </div>
          </div>

          {/* Refined Result */}
          <div className="flex flex-col">
            <label className="text-xs font-semibold text-cyan-400 mb-1.5 flex items-center justify-between">
              <span>Kết quả tinh chỉnh AI:</span>
              {refinedOutput && (
                <span className="text-[11px] text-emerald-400 font-medium">Đã sẵn sàng</span>
              )}
            </label>
            <div className="flex-1 min-h-[160px] bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-xs text-slate-100 leading-relaxed overflow-y-auto font-mono relative">
              {isLoading ? (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-950/90 text-cyan-400 text-xs font-medium space-x-2">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Đang xử lý tối ưu hóa văn bản với {provider.toUpperCase()}...</span>
                </div>
              ) : refinedOutput ? (
                <div className="whitespace-pre-wrap">{refinedOutput}</div>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-600 italic text-center px-4">
                  Bấm nút "Bắt đầu tinh chỉnh văn bản" để AI tối ưu hóa kịch bản đọc.
                </div>
              )}
            </div>
          </div>
        </div>

        {errorMsg && (
          <div className="mx-5 mb-3 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs">
            {errorMsg}
          </div>
        )}

        {/* Footer actions */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition"
          >
            Hủy bỏ
          </button>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleRefine}
              disabled={isLoading}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/30 text-xs font-bold rounded-xl transition flex items-center space-x-1.5 disabled:opacity-50"
            >
              <Wand2 className="h-3.5 w-3.5" />
              <span>{isLoading ? 'Đang xử lý...' : 'Bắt đầu tinh chỉnh văn bản'}</span>
            </button>

            {refinedOutput && (
              <button
                onClick={handleApply}
                className="px-5 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold rounded-xl transition shadow-lg shadow-cyan-500/20 flex items-center space-x-1.5"
              >
                <Check className="h-3.5 w-3.5" />
                <span>Áp dụng vào Kịch bản</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
