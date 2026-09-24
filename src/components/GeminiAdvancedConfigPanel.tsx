import React, { useState } from 'react';
import { AudioPromptConfig } from '../types';
import { AIFieldButton } from './AIFieldButton';
import { SlidersHorizontal, UserCheck, Compass, Clapperboard, MessageSquareQuote, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';

interface GeminiAdvancedConfigPanelProps {
  promptConfig: AudioPromptConfig;
  onChangePromptConfig: (config: AudioPromptConfig) => void;
  getFullContext?: () => any;
}

export const GeminiAdvancedConfigPanel: React.FC<GeminiAdvancedConfigPanelProps> = ({
  promptConfig,
  onChangePromptConfig,
  getFullContext,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleChangeField = (field: keyof AudioPromptConfig, value: string) => {
    onChangePromptConfig({
      ...promptConfig,
      [field]: value,
    });
  };

  const activeCount = Object.values(promptConfig).filter(Boolean).length;

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden shadow-lg transition-all">
      {/* Panel Header */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 bg-slate-900 hover:bg-slate-800/80 flex items-center justify-between text-left transition"
      >
        <div className="flex items-center space-x-2.5">
          <Clapperboard className="h-4 w-4 text-cyan-400" />
          <div>
            <span className="text-xs font-bold text-slate-100 flex items-center gap-2">
              Chỉ Dẫn Đạo Diễn & Bối Cảnh Gemini TTS (Audio Profile, Scene & Director's Notes)
              {activeCount > 0 && (
                <span className="px-2 py-0.5 text-[10px] font-mono bg-cyan-500/20 text-cyan-300 rounded-full border border-cyan-500/30">
                  {activeCount} thiết lập
                </span>
              )}
            </span>
            <p className="text-[11px] text-slate-400">
              Định hình nhân vật, bầu không khí cảnh, và lưu ý diễn xuất chuyên sâu chuẩn Google Gemini API
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 text-slate-400">
          <span className="text-xs font-semibold hidden sm:inline">
            {isOpen ? 'Thu gọn' : 'Mở rộng'}
          </span>
          {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </button>

      {/* Expanded Content */}
      {isOpen && (
        <div className="p-4 border-t border-slate-800/80 bg-slate-950/60 space-y-4 animate-fade-in">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 1. Hồ Sơ Âm Thanh (Audio Profile) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                  <UserCheck className="h-3.5 w-3.5 text-pink-400" />
                  <span>Hồ Sơ Âm Thanh (Audio Profile):</span>
                </label>
                <AIFieldButton
                  compact
                  targetField="audioProfile"
                  currentValue={promptConfig.audioProfile || ''}
                  onApplyResult={(val) => handleChangeField('audioProfile', val)}
                  getFullContext={getFullContext}
                />
              </div>
              <textarea
                rows={2}
                value={promptConfig.audioProfile || ''}
                onChange={(e) => handleChangeField('audioProfile', e.target.value)}
                placeholder="Ví dụ: Giọng nam 35 tuổi, chuyên gia tư vấn tài chính, chất giọng trầm tĩnh, tự tin và chín chắn..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100 focus:outline-none focus:border-cyan-500 placeholder-slate-600 resize-none"
              />
            </div>

            {/* 2. Cảnh & Bầu Không Khí (Scene & Atmosphere) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                  <Compass className="h-3.5 w-3.5 text-amber-400" />
                  <span>Cảnh & Bầu Không Khí (Scene & Atmosphere):</span>
                </label>
                <AIFieldButton
                  compact
                  targetField="sceneContext"
                  currentValue={promptConfig.sceneContext || ''}
                  onApplyResult={(val) => handleChangeField('sceneContext', val)}
                  getFullContext={getFullContext}
                />
              </div>
              <textarea
                rows={2}
                value={promptConfig.sceneContext || ''}
                onChange={(e) => handleChangeField('sceneContext', e.target.value)}
                placeholder="Ví dụ: Phòng thu studio cách âm tiêu chuẩn cao, không khí ấm cúng, tĩnh lặng..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100 focus:outline-none focus:border-cyan-500 placeholder-slate-600 resize-none"
              />
            </div>

            {/* 3. Ghi Chú Đạo Diễn Cho Cảnh Kịch Bản (Scene Director's Notes) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                  <Clapperboard className="h-3.5 w-3.5 text-rose-400" />
                  <span>Ghi Chú Đạo Diễn Cho Cảnh Kịch Bản (Scene Director's Notes):</span>
                </label>
                <AIFieldButton
                  compact
                  targetField="sceneDirectorsNotes"
                  currentValue={promptConfig.sceneDirectorsNotes || ''}
                  onApplyResult={(val) => handleChangeField('sceneDirectorsNotes', val)}
                  getFullContext={getFullContext}
                />
              </div>
              <textarea
                rows={2}
                value={promptConfig.sceneDirectorsNotes || ''}
                onChange={(e) => handleChangeField('sceneDirectorsNotes', e.target.value)}
                placeholder="Ví dụ: Tiết tấu dồn dập ở nửa đầu cảnh, đẩy cao trào cảm xúc kịch tính ở phần cao trào..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100 focus:outline-none focus:border-cyan-500 placeholder-slate-600 resize-none"
              />
            </div>

            {/* 4. Ghi Chú Đạo Diễn Tổng Thể (Global Director's Notes) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                  <SlidersHorizontal className="h-3.5 w-3.5 text-cyan-400" />
                  <span>Ghi Chú Đạo Diễn Tổng Thể (Global Notes):</span>
                </label>
                <AIFieldButton
                  compact
                  targetField="directorsNotes"
                  currentValue={promptConfig.directorsNotes || ''}
                  onApplyResult={(val) => handleChangeField('directorsNotes', val)}
                  getFullContext={getFullContext}
                />
              </div>
              <textarea
                rows={2}
                value={promptConfig.directorsNotes || ''}
                onChange={(e) => handleChangeField('directorsNotes', e.target.value)}
                placeholder="Ví dụ: Đọc nhịp điệu vừa phải, hít thở nhẹ giữa các vế câu, nhấn mạnh ở các số liệu quan trọng..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100 focus:outline-none focus:border-cyan-500 placeholder-slate-600 resize-none"
              />
            </div>

            {/* 5. Bối Cảnh Mẫu (Sample Context) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                  <MessageSquareQuote className="h-3.5 w-3.5 text-indigo-400" />
                  <span>Bối Cảnh Mẫu Khởi Đầu (Sample Context):</span>
                </label>
                <AIFieldButton
                  compact
                  targetField="sampleContext"
                  currentValue={promptConfig.sampleContext || ''}
                  onApplyResult={(val) => handleChangeField('sampleContext', val)}
                  getFullContext={getFullContext}
                />
              </div>
              <textarea
                rows={2}
                value={promptConfig.sampleContext || ''}
                onChange={(e) => handleChangeField('sampleContext', e.target.value)}
                placeholder="Ví dụ: [Vừa bước vào phòng thu] 'Vâng, thưa quý khán giả, chúng tôi đã sẵn sàng...'"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100 focus:outline-none focus:border-cyan-500 placeholder-slate-600 resize-none"
              />
            </div>
          </div>

          <div className="text-[11px] text-slate-500 bg-slate-900/50 p-2 rounded-lg border border-slate-800/60 flex items-center justify-between">
            <span className="flex items-center gap-1 text-cyan-400 font-medium">
              <Sparkles className="h-3 w-3" /> Mọi ô nhập liệu đều có nút AI xử lý đồng bộ theo thời gian thực
            </span>
            <button
              type="button"
              onClick={() => onChangePromptConfig({})}
              className="text-rose-400 hover:underline"
            >
              Xóa chỉ dẫn
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

