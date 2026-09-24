import React, { useState, useRef } from 'react';
import { SpeechStyle, VoiceOption, AudioPromptConfig, AudioToneConfig, SpeakerAssignment } from '../types';
import { GEMINI_VOICES } from '../constants/voicesAndPresets';
import { VoicePickerModal } from './VoicePickerModal';
import { SpeakerConfigModal } from './SpeakerConfigModal';
import { AudioTagsToolbar } from './AudioTagsToolbar';
import { GeminiAdvancedConfigPanel } from './GeminiAdvancedConfigPanel';
import { AIFieldButton } from './AIFieldButton';
import { Wand2, Play, Volume2, Sparkles, ChevronDown, RefreshCw, Sparkle, Settings, Sliders } from 'lucide-react';

interface SingleSpeakerEditorProps {
  text: string;
  setText: (t: string) => void;
  voiceName: string;
  setVoiceName: (v: string) => void;
  style: SpeechStyle;
  setStyle: (s: SpeechStyle) => void;
  promptConfig: AudioPromptConfig;
  setPromptConfig: (c: AudioPromptConfig) => void;
  toneConfig?: AudioToneConfig;
  setToneConfig?: (c: AudioToneConfig) => void;
  onGenerate: () => void;
  isGenerating: boolean;
  onOpenRefinement: () => void;
  getFullContext?: () => any;
}

const STYLE_OPTIONS: { id: SpeechStyle; label: string; desc: string; color: string }[] = [
  { id: 'natural', label: 'Tự nhiên', desc: 'Nhịp điệu cân bằng, tự nhiên', color: 'border-slate-700 bg-slate-950 text-slate-300' },
  { id: 'cheerful', label: 'Hào hứng', desc: 'Vui vẻ, năng lượng cao', color: 'border-amber-500/30 bg-amber-500/10 text-amber-300' },
  { id: 'calm', label: 'Trầm ấm', desc: 'Nhẹ nhàng, thư thái', color: 'border-indigo-500/30 bg-indigo-500/10 text-indigo-300' },
  { id: 'dramatic', label: 'Kịch tính', desc: 'Nhiều cảm xúc, điện ảnh', color: 'border-rose-500/30 bg-rose-500/10 text-rose-300' },
  { id: 'news', label: 'Bản tin báo', desc: 'Phát thanh viên thời sự', color: 'border-blue-500/30 bg-blue-500/10 text-blue-300' },
  { id: 'storytelling', label: 'Sách nói', desc: 'Truyền cảm, giọng kể chuyện', color: 'border-purple-500/30 bg-purple-500/10 text-purple-300' },
  { id: 'authoritative', label: 'Chuyên nghiệp', desc: 'Giảng dạy, dứt khoát', color: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' },
  { id: 'whisper', label: 'Thì thầm', desc: 'Nhẹ dịu như gió thoảng', color: 'border-teal-500/30 bg-teal-500/10 text-teal-300' },
];

export const SingleSpeakerEditor: React.FC<SingleSpeakerEditorProps> = ({
  text,
  setText,
  voiceName,
  setVoiceName,
  style,
  setStyle,
  promptConfig,
  setPromptConfig,
  toneConfig,
  setToneConfig,
  onGenerate,
  isGenerating,
  onOpenRefinement,
  getFullContext,
}) => {
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [isSpeakerConfigOpen, setIsSpeakerConfigOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const currentVoice = GEMINI_VOICES.find((v) => v.id === voiceName) || GEMINI_VOICES[0];

  // Insert Audio Tag at cursor position
  const handleInsertTag = (tag: string) => {
    if (!textareaRef.current) {
      setText(text + (text ? ' ' : '') + tag + ' ');
      return;
    }
    const el = textareaRef.current;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const newText = text.substring(0, start) + tag + ' ' + text.substring(end);
    setText(newText);

    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + tag.length + 1, start + tag.length + 1);
    }, 50);
  };

  return (
    <div className="space-y-4">
      {/* Voice Selection & Style Bar */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          {/* Active Voice Card */}
          <div className="flex items-center space-x-3 flex-wrap gap-y-2">
            <button
              onClick={() => setIsVoiceModalOpen(true)}
              className="flex items-center space-x-3 p-2 bg-slate-950 hover:bg-slate-800 rounded-xl border border-slate-800 transition group text-left"
            >
              <div
                className={`h-10 w-10 rounded-lg bg-gradient-to-tr ${currentVoice.avatarColor} flex items-center justify-center text-white font-bold text-sm shadow-md`}
              >
                {currentVoice.name.substring(0, 2)}
              </div>
              <div>
                <div className="flex items-center space-x-1.5">
                  <span className="text-xs font-bold text-slate-100 group-hover:text-cyan-300">
                    {currentVoice.name}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    ({currentVoice.gender === 'female' ? 'Nữ' : 'Nam'})
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 text-slate-400 group-hover:text-cyan-300" />
                </div>
                <p className="text-[11px] text-slate-400 line-clamp-1">{currentVoice.description}</p>
              </div>
            </button>

            {/* Gear Button for character details & Audio Timbre Controls */}
            <button
              onClick={() => setIsSpeakerConfigOpen(true)}
              title="Cài đặt nhân vật & Tùy chỉnh âm sắc (Audio Timbre Controls)"
              className="px-3 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-200 hover:text-cyan-300 border border-slate-800 hover:border-cyan-500/50 text-xs font-bold transition flex items-center space-x-1.5 shadow-sm"
            >
              <Settings className="h-4 w-4 text-cyan-400" />
              <span>Cài Đặt Âm Sắc</span>
              {toneConfig && (toneConfig.speed !== 1 || toneConfig.pitch !== 0 || toneConfig.bass !== 0 || toneConfig.treble !== 0) && (
                <span className="text-[10px] font-extrabold text-cyan-300 bg-cyan-950 px-1.5 py-0.5 rounded border border-cyan-800/60">
                  {toneConfig.speed}x
                </span>
              )}
            </button>
          </div>

          {/* Quick AI Refinement Trigger */}
          <button
            onClick={onOpenRefinement}
            className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-indigo-900/60 to-purple-900/60 hover:from-indigo-800 hover:to-purple-800 text-cyan-300 border border-indigo-500/30 text-xs font-bold transition flex items-center justify-center space-x-1.5 shadow-sm"
          >
            <Wand2 className="h-4 w-4 text-cyan-400" />
            <span>Tinh chỉnh văn bản bằng AI (DeepSeek / Gemini)</span>
          </button>
        </div>

        {/* Style Selection */}
        <div>
          <label className="text-xs font-semibold text-slate-400 block mb-2">
            Phong cách & Cảm xúc phát âm (Speech Style):
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
            {STYLE_OPTIONS.map((opt) => {
              const isSelected = style === opt.id;
              return (
                <button
                  key={opt.id}
                  onClick={() => setStyle(opt.id)}
                  className={`p-2 rounded-xl border text-left transition flex flex-col justify-between ${
                    isSelected
                      ? 'border-cyan-500 bg-cyan-950/40 text-cyan-300 ring-1 ring-cyan-500/50'
                      : opt.color
                  }`}
                >
                  <span className="text-xs font-bold">{opt.label}</span>
                  <span className="text-[10px] opacity-75 line-clamp-1 mt-0.5">{opt.desc}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Gemini Advanced Config (Audio Profile, Scene, Director's Notes) */}
        <GeminiAdvancedConfigPanel
          promptConfig={promptConfig}
          onChangePromptConfig={setPromptConfig}
          getFullContext={getFullContext}
        />

        {/* Text Input Area */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Volume2 className="h-4 w-4 text-cyan-400" />
                <span>Nội dung văn bản cần chuyển giọng nói:</span>
              </label>
              <AIFieldButton
                compact
                targetField="singleText"
                currentValue={text}
                onApplyResult={(val) => setText(val)}
                getFullContext={getFullContext}
              />
            </div>
            <span className="text-[11px] text-slate-500">{text.length} ký tự</span>
          </div>

          {/* Audio Tags Quick Insertion Toolbar */}
          <AudioTagsToolbar onInsertTag={handleInsertTag} />

          <div className="relative">
            <textarea
              ref={textareaRef}
              rows={6}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Nhập hoặc dán đoạn văn bản tiếng Việt của bạn tại đây... Thẻ âm thanh như [whispering], [sighs], [excited] có thể được chèn tự do để giả lập diễn xuất chân thực."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500 leading-relaxed font-sans"
            />

            {text && (
              <button
                onClick={() => setText('')}
                className="absolute top-3 right-3 text-[11px] text-slate-500 hover:text-slate-300 bg-slate-900 px-2 py-0.5 rounded-md border border-slate-800"
              >
                Xóa
              </button>
            )}
          </div>
        </div>

        {/* Generate Button */}
        <div className="pt-2 flex justify-end">
          <button
            onClick={onGenerate}
            disabled={isGenerating || !text.trim()}
            className="w-full sm:w-auto px-8 py-3 bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-bold text-sm rounded-xl transition-all shadow-lg shadow-cyan-500/25 flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGenerating ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>Đang khởi tạo giọng nói Gemini TTS...</span>
              </>
            ) : (
              <>
                <Play className="h-4 w-4 fill-current" />
                <span>Tạo Giọng Nói Ngay (Generate TTS)</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Voice Picker Modal */}
      <VoicePickerModal
        isOpen={isVoiceModalOpen}
        onClose={() => setIsVoiceModalOpen(false)}
        selectedVoiceId={voiceName}
        onSelectVoice={(v: VoiceOption) => setVoiceName(v.id)}
      />

      {/* Speaker Config Modal for Single Speaker */}
      {isSpeakerConfigOpen && (
        <SpeakerConfigModal
          isOpen={isSpeakerConfigOpen}
          onClose={() => setIsSpeakerConfigOpen(false)}
          speaker={{
            id: 'single-speaker',
            name: currentVoice.name,
            voiceName,
            style,
            audioProfile: promptConfig.audioProfile,
            directorsNotes: promptConfig.directorsNotes,
            toneConfig: toneConfig || { speed: 1.0, pitch: 0, bass: 0, treble: 0, reverb: 0 },
          }}
          onSaveSpeaker={(updated: SpeakerAssignment) => {
            setVoiceName(updated.voiceName);
            setStyle(updated.style);
            setPromptConfig({
              ...promptConfig,
              audioProfile: updated.audioProfile,
              directorsNotes: updated.directorsNotes,
            });
            if (setToneConfig && updated.toneConfig) {
              setToneConfig(updated.toneConfig);
            }
          }}
          getFullContext={getFullContext}
        />
      )}
    </div>
  );
};

