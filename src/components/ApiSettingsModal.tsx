import React, { useState, useEffect } from 'react';
import { ApiSettings } from '../types';
import { getStoredApiSettings, saveApiSettings } from '../utils/apiSettingsStorage';
import { Key, X, Sparkles, Server, Check, Info, ShieldCheck } from 'lucide-react';

interface ApiSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSettingsSaved?: (newSettings: ApiSettings) => void;
}

export const ApiSettingsModal: React.FC<ApiSettingsModalProps> = ({
  isOpen,
  onClose,
  onSettingsSaved,
}) => {
  const [provider, setProvider] = useState<'gemini' | 'deepseek' | 'openrouter'>('gemini');
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [customApiKey, setCustomApiKey] = useState('');
  const [customEndpoint, setCustomEndpoint] = useState('');
  const [ttsModel, setTtsModel] = useState<'3.1' | '2.5'>('3.1');
  const [isSavedToast, setIsSavedToast] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const stored = getStoredApiSettings();
      setProvider(stored.provider || 'gemini');
      setGeminiApiKey(stored.geminiApiKey || '');
      setCustomApiKey(stored.customApiKey || '');
      setCustomEndpoint(stored.customEndpoint || '');
      setTtsModel(stored.ttsModel || '3.1');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleProviderSelect = (newProvider: 'gemini' | 'deepseek' | 'openrouter') => {
    setProvider(newProvider);
    if (newProvider === 'deepseek' && !customEndpoint) {
      setCustomEndpoint('https://api.deepseek.com/chat/completions');
    } else if (newProvider === 'openrouter' && !customEndpoint) {
      setCustomEndpoint('https://openrouter.ai/api/v1/chat/completions');
    }
  };

  const handleSave = () => {
    const updated: ApiSettings = {
      provider,
      geminiApiKey: geminiApiKey.trim(),
      customApiKey: customApiKey.trim(),
      customEndpoint: customEndpoint.trim(),
      ttsModel,
    };
    saveApiSettings(updated);
    if (onSettingsSaved) {
      onSettingsSaved(updated);
    }
    setIsSavedToast(true);
    setTimeout(() => {
      setIsSavedToast(false);
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-lg">
              <Key className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                Quản Lý Mã API & Provider Toàn Ứng Dụng
              </h3>
              <p className="text-xs text-slate-400">
                Nhập 1 lần - Áp dụng ngay lập tức cho toàn bộ ô nhập liệu, AI Autofill & Tinh chỉnh kịch bản
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

        {/* Content Body */}
        <div className="p-5 space-y-4">
          {/* Provider Selection */}
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-2">
              Chọn Nhà Cung Cấp & Mô Hình Mặc Định:
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleProviderSelect('gemini')}
                className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                  provider === 'gemini'
                    ? 'bg-cyan-950/80 border-cyan-500 text-cyan-200 shadow-sm'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <Sparkles className="h-4 w-4 text-cyan-400" />
                  {provider === 'gemini' && <Check className="h-3.5 w-3.5 text-cyan-400" />}
                </div>
                <div className="mt-2">
                  <div className="text-xs font-bold text-slate-100">Gemini 3.6 Flash</div>
                  <div className="text-[10px] text-slate-400">Tối ưu TTS Google</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleProviderSelect('deepseek')}
                className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                  provider === 'deepseek'
                    ? 'bg-blue-950/80 border-blue-500 text-blue-200 shadow-sm'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <Server className="h-4 w-4 text-blue-400" />
                  {provider === 'deepseek' && <Check className="h-3.5 w-3.5 text-blue-400" />}
                </div>
                <div className="mt-2">
                  <div className="text-xs font-bold text-slate-100">DeepSeek API</div>
                  <div className="text-[10px] text-slate-400">Model deepseek-chat</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleProviderSelect('openrouter')}
                className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                  provider === 'openrouter'
                    ? 'bg-purple-950/80 border-purple-500 text-purple-200 shadow-sm'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <Key className="h-4 w-4 text-purple-400" />
                  {provider === 'openrouter' && <Check className="h-3.5 w-3.5 text-purple-400" />}
                </div>
                <div className="mt-2">
                  <div className="text-xs font-bold text-slate-100">OpenRouter</div>
                  <div className="text-[10px] text-slate-400">Multi-Model Proxy</div>
                </div>
              </button>
            </div>
          </div>

          {/* TTS Model Selection */}
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-2">
              Mô Hình Tạo Giọng Nói TTS (Chọn giữa Gemini 3.1 và 2.5):
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setTtsModel('3.1')}
                className={`p-3 rounded-xl border text-left transition flex items-center justify-between ${
                  ttsModel === '3.1'
                    ? 'bg-gradient-to-r from-cyan-950 to-blue-950 border-cyan-500 text-cyan-200 shadow-sm'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div>
                  <div className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                    <span>Gemini 3.1 Flash TTS</span>
                    <span className="text-[9px] bg-cyan-500/20 text-cyan-300 px-1.5 py-0.5 rounded font-mono">Mới</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    Giọng nói đa sắc thái, hội thoại chuẩn cao cấp
                  </div>
                </div>
                {ttsModel === '3.1' && <Check className="h-4 w-4 text-cyan-400 shrink-0 ml-1.5" />}
              </button>

              <button
                type="button"
                onClick={() => setTtsModel('2.5')}
                className={`p-3 rounded-xl border text-left transition flex items-center justify-between ${
                  ttsModel === '2.5'
                    ? 'bg-gradient-to-r from-blue-950 to-indigo-950 border-blue-500 text-blue-200 shadow-sm'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div>
                  <div className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                    <span>Gemini 2.5 Flash TTS</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    Tốc độ phản hồi cực nhanh, ổn định
                  </div>
                </div>
                {ttsModel === '2.5' && <Check className="h-4 w-4 text-blue-400 shrink-0 ml-1.5" />}
              </button>
            </div>
          </div>

          {/* Key fields */}
          <div className="space-y-3 bg-slate-950/70 p-4 rounded-xl border border-slate-800">
            {/* Gemini Custom Key */}
            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1">
                Google Gemini API Key tùy chỉnh (Không bắt buộc):
              </label>
              <input
                type="password"
                placeholder="AIzaSy..."
                value={geminiApiKey}
                onChange={(e) => setGeminiApiKey(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 text-slate-100 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-cyan-500"
              />
              <p className="text-[10px] text-slate-500 mt-1">
                Nếu để trống, ứng dụng sẽ sử dụng API Key Gemini cấu hình sẵn của hệ thống.
              </p>
            </div>

            {/* Custom API Key for DeepSeek / OpenRouter */}
            {(provider === 'deepseek' || provider === 'openrouter') && (
              <>
                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">
                    API Key cho {provider === 'deepseek' ? 'DeepSeek' : 'OpenRouter'}:
                  </label>
                  <input
                    type="password"
                    placeholder="sk-..."
                    value={customApiKey}
                    onChange={(e) => setCustomApiKey(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 text-slate-100 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">
                    Endpoint URL:
                  </label>
                  <input
                    type="text"
                    placeholder={
                      provider === 'deepseek'
                        ? 'https://api.deepseek.com/chat/completions'
                        : 'https://openrouter.ai/api/v1/chat/completions'
                    }
                    value={customEndpoint}
                    onChange={(e) => setCustomEndpoint(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 text-slate-100 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </>
            )}
          </div>

          {/* Info Banner */}
          <div className="p-3 bg-cyan-950/40 border border-cyan-800/40 rounded-xl flex items-start space-x-2 text-xs text-cyan-300">
            <ShieldCheck className="h-4 w-4 text-cyan-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold block text-cyan-200">Đồng Bộ & Lưu Trữ An Toàn:</span>
              Mã API sau khi lưu sẽ tự động kích hoạt cho tất cả các ô nhập liệu, AI Autofill, Tinh chỉnh kịch bản & Tạo phát âm giọng nói.
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition"
          >
            Đóng
          </button>

          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold rounded-xl transition shadow-lg shadow-cyan-500/20 flex items-center space-x-1.5"
          >
            {isSavedToast ? (
              <>
                <Check className="h-4 w-4 text-emerald-300 animate-bounce" />
                <span>Đã Lưu & Kích Hoạt!</span>
              </>
            ) : (
              <>
                <Key className="h-4 w-4" />
                <span>Lưu & Áp Dụng Toàn Hệ Thống</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
