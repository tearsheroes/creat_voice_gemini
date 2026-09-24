import React from 'react';
import { Volume2, Sparkles, FolderHeart, History, Cpu, Key, FolderArchive, BookOpen, Scissors } from 'lucide-react';

interface NavbarProps {
  activeTab: 'create' | 'presets' | 'history' | 'splitter';
  setActiveTab: (tab: 'create' | 'presets' | 'history' | 'splitter') => void;
  presetCount: number;
  historyCount: number;
  onOpenApiSettings?: () => void;
  onOpenZipModal?: () => void;
  onOpenPronunciation?: () => void;
  activeProvider?: string;
  activeTtsModel?: '3.1' | '2.5';
  onChangeTtsModel?: (model: '3.1' | '2.5') => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  presetCount,
  historyCount,
  onOpenApiSettings,
  onOpenZipModal,
  onOpenPronunciation,
  activeProvider = 'gemini',
  activeTtsModel = '3.1',
  onChangeTtsModel,
}) => {
  return (
    <header className="sticky top-0 z-40 h-14 bg-slate-900 border-b border-slate-800 text-slate-100 px-4 sm:px-6 flex items-center justify-between shrink-0">
      {/* Brand & Logo */}
      <div className="flex items-center space-x-3">
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-md shadow-blue-600/30">
          <Volume2 className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-base sm:text-lg font-bold tracking-tight text-white flex items-center gap-2">
            Gemini <span className="text-blue-500 underline underline-offset-4 decoration-2">Vox AI</span>
          </h1>
        </div>
      </div>

      {/* Navigation & Active Status */}
      <div className="flex items-center space-x-2 sm:space-x-3">
        {/* Pronunciation Dictionary Button */}
        {onOpenPronunciation && (
          <button
            onClick={onOpenPronunciation}
            title="Từ điển phát âm (sửa lỗi AI đọc sai tên riêng)"
            className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-950/80 hover:bg-emerald-900/80 border border-emerald-800/80 text-emerald-300 text-xs font-semibold transition shadow-sm"
          >
            <BookOpen className="h-3.5 w-3.5 text-emerald-400" />
            <span className="hidden xl:inline">Từ điển phát âm</span>
          </button>
        )}

        {/* Zip Project Backup / Restore Button */}
        {onOpenZipModal && (
          <button
            onClick={onOpenZipModal}
            title="Lưu và Khôi phục toàn bộ dự án qua file ZIP"
            className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg bg-indigo-950/80 hover:bg-indigo-900/80 border border-indigo-800/80 text-indigo-300 text-xs font-semibold transition shadow-sm"
          >
            <FolderArchive className="h-3.5 w-3.5 text-indigo-400" />
            <span className="hidden lg:inline">Lưu / Nạp ZIP</span>
            <span className="lg:hidden text-[10px] font-mono font-bold uppercase">ZIP</span>
          </button>
        )}

        {/* API Settings Button */}
        {onOpenApiSettings && (
          <button
            onClick={onOpenApiSettings}
            title="Cấu hình Mã API & Provider sử dụng cho toàn bộ phần mềm"
            className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-cyan-300 text-xs font-semibold transition shadow-sm"
          >
            <Key className="h-3.5 w-3.5 text-cyan-400" />
            <span className="hidden sm:inline">API & Provider</span>
            <span className="uppercase text-[10px] bg-cyan-950 text-cyan-300 px-1.5 py-0.5 rounded border border-cyan-800 font-mono">
              {activeProvider}
            </span>
          </button>
        )}

        {/* Quick TTS Model Toggle */}
        {onChangeTtsModel && (
          <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5 text-xs font-semibold">
            <span className="text-[10px] text-slate-400 px-1.5 hidden md:inline">TTS:</span>
            <button
              onClick={() => onChangeTtsModel('3.1')}
              className={`px-2 py-0.5 rounded text-[11px] font-mono transition ${
                activeTtsModel === '3.1'
                  ? 'bg-cyan-600 text-white font-bold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Sử dụng mô hình Gemini 3.1 Flash TTS"
            >
              v3.1
            </button>
            <button
              onClick={() => onChangeTtsModel('2.5')}
              className={`px-2 py-0.5 rounded text-[11px] font-mono transition ${
                activeTtsModel === '2.5'
                  ? 'bg-blue-600 text-white font-bold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Sử dụng mô hình Gemini 2.5 Flash TTS"
            >
              v2.5
            </button>
          </div>
        )}

        {/* Tab Controls */}
        <div className="flex items-center space-x-1 bg-slate-950/80 p-1 rounded-lg border border-slate-800">
          <button
            onClick={() => setActiveTab('create')}
            className={`flex items-center space-x-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
              activeTab === 'create'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Cpu className="h-3.5 w-3.5" />
            <span>Tạo Giọng Nói</span>
          </button>

          <button
            onClick={() => setActiveTab('splitter')}
            className={`flex items-center space-x-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
              activeTab === 'splitter'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Scissors className="h-3.5 w-3.5 text-amber-400" />
            <span>Cắt & Chia Audio</span>
          </button>

          <button
            onClick={() => setActiveTab('presets')}
            className={`flex items-center space-x-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
              activeTab === 'presets'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <FolderHeart className="h-3.5 w-3.5" />
            <span>Cảnh Lưu</span>
            {presetCount > 0 && (
              <span className="ml-1 px-1.5 py-0.2 text-[10px] rounded bg-slate-800 text-blue-400 font-mono">
                {presetCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center space-x-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
              activeTab === 'history'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <History className="h-3.5 w-3.5" />
            <span>Lịch Sử</span>
            {historyCount > 0 && (
              <span className="ml-1 px-1.5 py-0.2 text-[10px] rounded bg-slate-800 text-blue-400 font-mono">
                {historyCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};

