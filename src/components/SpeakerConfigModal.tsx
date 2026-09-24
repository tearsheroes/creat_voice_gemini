import React, { useState } from 'react';
import { SpeakerAssignment, SpeechStyle, AudioToneConfig } from '../types';
import { GEMINI_VOICES } from '../constants/voicesAndPresets';
import { VoicePickerModal } from './VoicePickerModal';
import { TONE_PRESETS } from './ToneCustomizer';
import { AIFieldButton } from './AIFieldButton';
import {
  Settings,
  X,
  User,
  Volume2,
  Sliders,
  Clapperboard,
  Gauge,
  Music,
  RotateCcw,
  Sparkles,
  Check,
  Eye,
  EyeOff,
} from 'lucide-react';

interface SpeakerConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  speaker: SpeakerAssignment;
  onSaveSpeaker: (updatedSpeaker: SpeakerAssignment) => void;
  getFullContext?: () => any;
  speakerIndex?: number;
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

export const SpeakerConfigModal: React.FC<SpeakerConfigModalProps> = ({
  isOpen,
  onClose,
  speaker,
  onSaveSpeaker,
  getFullContext,
  speakerIndex = 0,
}) => {
  const [activeTab, setActiveTab] = useState<'voice' | 'profile' | 'timbre'>('voice');
  const [isVoicePickerOpen, setIsVoicePickerOpen] = useState(false);

  // Local draft state
  const [name, setName] = useState(speaker.name || '');
  const [voiceName, setVoiceName] = useState(speaker.voiceName || 'Kore');
  const [style, setStyle] = useState<SpeechStyle>(speaker.style || 'natural');
  const [audioProfile, setAudioProfile] = useState(speaker.audioProfile || '');
  const [directorsNotes, setDirectorsNotes] = useState(speaker.directorsNotes || '');
  const [isHidden, setIsHidden] = useState<boolean>(!!speaker.isHidden);
  const [toneConfig, setToneConfig] = useState<AudioToneConfig>(
    speaker.toneConfig || { speed: 1.0, pitch: 0, bass: 0, treble: 0, reverb: 0 }
  );

  if (!isOpen) return null;

  const currentVoice = GEMINI_VOICES.find((v) => v.id === voiceName) || GEMINI_VOICES[0];

  const handleSave = () => {
    onSaveSpeaker({
      ...speaker,
      name,
      voiceName,
      style,
      audioProfile,
      directorsNotes,
      isHidden,
      toneConfig,
    });
    onClose();
  };

  const handleResetTimbre = () => {
    setToneConfig({ speed: 1.0, pitch: 0, bass: 0, treble: 0, reverb: 0 });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
              <Settings className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md bg-cyan-950 text-cyan-300 border border-cyan-800 text-xs font-black">
                  ID: #{speakerIndex + 1}
                </span>
                <span>Cài Đặt & Âm Sắc Cho:</span>
                <span className="text-cyan-400 font-extrabold">{name || `Nhân vật #${speakerIndex + 1}`}</span>
              </h2>
              <p className="text-xs text-slate-400">
                Tùy chỉnh giọng đọc, chỉ đạo nghệ thuật & bộ cân bằng âm sắc (Timbre Controls) riêng
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Navigation Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-950 px-4 pt-2 space-x-2">
          <button
            onClick={() => setActiveTab('voice')}
            className={`px-4 py-2.5 text-xs font-bold rounded-t-xl border-t border-x transition flex items-center space-x-1.5 ${
              activeTab === 'voice'
                ? 'bg-slate-900 border-slate-800 text-cyan-400 border-b-transparent'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <User className="h-3.5 w-3.5" />
            <span>Giọng Nói & Phong Cách</span>
          </button>

          <button
            onClick={() => setActiveTab('profile')}
            className={`px-4 py-2.5 text-xs font-bold rounded-t-xl border-t border-x transition flex items-center space-x-1.5 ${
              activeTab === 'profile'
                ? 'bg-slate-900 border-slate-800 text-cyan-400 border-b-transparent'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Clapperboard className="h-3.5 w-3.5 text-amber-400" />
            <span>Chỉ Đạo & Hồ Sơ AI</span>
          </button>

          <button
            onClick={() => setActiveTab('timbre')}
            className={`px-4 py-2.5 text-xs font-bold rounded-t-xl border-t border-x transition flex items-center space-x-1.5 ${
              activeTab === 'timbre'
                ? 'bg-slate-900 border-slate-800 text-cyan-400 border-b-transparent'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sliders className="h-3.5 w-3.5 text-purple-400" />
            <span>Tùy Chỉnh Âm Sắc (Timbre & EQ)</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* TAB 1: Voice & Style */}
          {activeTab === 'voice' && (
            <div className="space-y-4">
              {/* Name Input */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-300">Tên Nhân Vật:</label>
                  <AIFieldButton
                    compact
                    targetField="speakerName"
                    currentValue={name}
                    onApplyResult={(val) => setName(val)}
                    getFullContext={getFullContext}
                  />
                </div>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nhập tên nhân vật (e.g. Bác Sĩ, Người Dẫn...)"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500 font-bold"
                />
              </div>

              {/* Active / Hidden Status Toggle */}
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold text-slate-200">
                      Trạng thái phát kịch bản:
                    </span>
                    <span
                      className={`text-[10px] font-extrabold px-2 py-0.5 rounded ${
                        isHidden
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      }`}
                    >
                      {isHidden ? 'Đang Ẩn (Bỏ Qua Khi Tạo Âm Thanh)' : 'Đang Bật Phát (Tham Gia Kịch Bản)'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {isHidden
                      ? 'Nhân vật này bị ẩn. Các câu thoại của nhân vật sẽ tự động bỏ qua khi tạo audio.'
                      : 'Nhân vật đang hoạt động và sẽ tham gia tạo âm thanh.'}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setIsHidden(!isHidden)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 shrink-0 ${
                    isHidden
                      ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/60 hover:bg-emerald-900/80'
                      : 'bg-rose-950/80 text-rose-300 border border-rose-800/60 hover:bg-rose-900/80'
                  }`}
                >
                  {isHidden ? <Eye className="h-4 w-4 text-emerald-400" /> : <EyeOff className="h-4 w-4 text-rose-400" />}
                  <span>{isHidden ? 'Bật Lại Nhân Vật' : 'Ẩn Nhân Vật Này'}</span>
                </button>
              </div>

              {/* Selected Voice Card */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-300 block">
                  Mẫu Giọng Đọc Gemini AI:
                </label>
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div
                      className={`h-10 w-10 rounded-xl bg-gradient-to-tr ${currentVoice.avatarColor} flex items-center justify-center text-white font-bold text-sm shadow-md`}
                    >
                      {currentVoice.name.substring(0, 2)}
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-bold text-slate-100">
                          {currentVoice.name}
                        </span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                          {currentVoice.gender === 'female' ? 'Nữ' : 'Nam'}
                        </span>
                        <span className="text-[10px] text-cyan-400">
                          Phù hợp: {currentVoice.bestFor}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">
                        {currentVoice.description}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsVoicePickerOpen(true)}
                    className="px-3 py-1.5 rounded-lg bg-cyan-950/60 hover:bg-cyan-900/60 text-cyan-300 text-xs font-semibold border border-cyan-800/60 transition"
                  >
                    Đổi Giọng Đọc
                  </button>
                </div>
              </div>

              {/* Style Selector */}
              <div className="space-y-2 pt-2">
                <label className="text-xs font-semibold text-slate-300 block">
                  Phong cách & Cảm xúc giọng phát:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {STYLE_OPTIONS.map((opt) => {
                    const isSelected = style === opt.id;
                    return (
                      <button
                        key={opt.id}
                        onClick={() => setStyle(opt.id)}
                        className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between ${
                          isSelected
                            ? 'border-cyan-500 bg-cyan-950/40 text-cyan-300 ring-1 ring-cyan-500/50'
                            : opt.color
                        }`}
                      >
                        <span className="text-xs font-bold">{opt.label}</span>
                        <span className="text-[10px] opacity-75 line-clamp-1 mt-0.5">
                          {opt.desc}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Audio Profile & Director's Notes */}
          {activeTab === 'profile' && (
            <div className="space-y-4">
              {/* Speaker Audio Profile */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <User className="h-4 w-4 text-pink-400" />
                    <span>Hồ Sơ Âm Thanh Nhân Vật (Audio Profile):</span>
                  </label>
                  <AIFieldButton
                    compact
                    targetField="speakerAudioProfile"
                    currentValue={audioProfile}
                    onApplyResult={(val) => setAudioProfile(val)}
                    getFullContext={getFullContext}
                  />
                </div>
                <textarea
                  rows={3}
                  value={audioProfile}
                  onChange={(e) => setAudioProfile(e.target.value)}
                  placeholder="Ví dụ: Nam 35 tuổi, chất giọng nói trầm ấm, phong thái đàng hoàng tự tin, có sắc thái hóm hỉnh..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-100 focus:outline-none focus:border-cyan-500 placeholder-slate-600 resize-y font-sans"
                />
              </div>

              {/* Speaker Director Notes */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Clapperboard className="h-4 w-4 text-amber-400" />
                    <span>Ghi Chú Đạo Diễn Riêng Nhân Vật (Director's Notes):</span>
                  </label>
                  <AIFieldButton
                    compact
                    targetField="speakerDirectorsNotes"
                    currentValue={directorsNotes}
                    onApplyResult={(val) => setDirectorsNotes(val)}
                    getFullContext={getFullContext}
                  />
                </div>
                <textarea
                  rows={3}
                  value={directorsNotes}
                  onChange={(e) => setDirectorsNotes(e.target.value)}
                  placeholder="Ví dụ: Giữ nhịp nói thong thả, lấy hơi rõ giữa các vế câu, dâng trào cảm xúc ở các từ nhấn mạnh..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-100 focus:outline-none focus:border-cyan-500 placeholder-slate-600 resize-y font-sans"
                />
              </div>
            </div>
          )}

          {/* TAB 3: Audio Timbre Controls */}
          {activeTab === 'timbre' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div className="flex items-center space-x-2">
                  <Sliders className="h-4 w-4 text-purple-400" />
                  <span className="text-xs font-bold text-slate-200">
                    Bộ Cân Bằng Âm Sắc & Tốc Độ Phát Dành Cho Nhân Vật Này
                  </span>
                </div>
                <button
                  onClick={handleResetTimbre}
                  className="text-[11px] text-slate-400 hover:text-cyan-300 transition flex items-center space-x-1"
                >
                  <RotateCcw className="h-3 w-3" />
                  <span>Đặt lại âm sắc</span>
                </button>
              </div>

              {/* Timbre Presets */}
              <div>
                <label className="text-[11px] font-semibold text-slate-400 block mb-2">
                  Bộ cân bằng âm sắc có sẵn (Timbre Presets):
                </label>
                <div className="flex flex-wrap gap-2">
                  {TONE_PRESETS.map((preset) => {
                    const isActive =
                      toneConfig.bass === preset.config.bass &&
                      toneConfig.treble === preset.config.treble &&
                      toneConfig.pitch === preset.config.pitch &&
                      toneConfig.speed === preset.config.speed;
                    return (
                      <button
                        key={preset.name}
                        onClick={() => setToneConfig({ ...toneConfig, ...preset.config })}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition flex items-center space-x-1 ${
                          isActive
                            ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-sm'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                        }`}
                      >
                        <Sparkles className="h-3 w-3 text-cyan-400" />
                        <span>{preset.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Sliders Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                {/* Speed Slider */}
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-300 font-medium flex items-center gap-1">
                      <Gauge className="h-3.5 w-3.5 text-cyan-400" /> Tốc độ đọc:
                    </span>
                    <span className="font-bold text-cyan-300">{toneConfig.speed.toFixed(2)}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="2.0"
                    step="0.05"
                    value={toneConfig.speed}
                    onChange={(e) =>
                      setToneConfig({ ...toneConfig, speed: parseFloat(e.target.value) })
                    }
                    className="w-full accent-cyan-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500">
                    <span>0.5x (Chậm)</span>
                    <span>1.0x</span>
                    <span>2.0x (Nhanh)</span>
                  </div>
                </div>

                {/* Pitch Slider */}
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-300 font-medium flex items-center gap-1">
                      <Music className="h-3.5 w-3.5 text-purple-400" /> Cao độ (Pitch):
                    </span>
                    <span className="font-bold text-purple-300">
                      {toneConfig.pitch > 0 ? `+${toneConfig.pitch}` : toneConfig.pitch} ST
                    </span>
                  </div>
                  <input
                    type="range"
                    min="-6"
                    max="6"
                    step="1"
                    value={toneConfig.pitch}
                    onChange={(e) =>
                      setToneConfig({ ...toneConfig, pitch: parseInt(e.target.value, 10) })
                    }
                    className="w-full accent-purple-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500">
                    <span>Trầm (-6)</span>
                    <span>Chuẩn</span>
                    <span>Bổng (+6)</span>
                  </div>
                </div>

                {/* Bass EQ */}
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-300 font-medium">Âm Trầm (Bass):</span>
                    <span className="font-bold text-emerald-400">
                      {toneConfig.bass > 0 ? `+${toneConfig.bass}` : toneConfig.bass} dB
                    </span>
                  </div>
                  <input
                    type="range"
                    min="-10"
                    max="10"
                    step="1"
                    value={toneConfig.bass}
                    onChange={(e) =>
                      setToneConfig({ ...toneConfig, bass: parseInt(e.target.value, 10) })
                    }
                    className="w-full accent-emerald-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500">
                    <span>-10dB</span>
                    <span>0dB</span>
                    <span>+10dB</span>
                  </div>
                </div>

                {/* Treble EQ */}
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-300 font-medium">Âm Bổng (Treble):</span>
                    <span className="font-bold text-amber-400">
                      {toneConfig.treble > 0 ? `+${toneConfig.treble}` : toneConfig.treble} dB
                    </span>
                  </div>
                  <input
                    type="range"
                    min="-10"
                    max="10"
                    step="1"
                    value={toneConfig.treble}
                    onChange={(e) =>
                      setToneConfig({ ...toneConfig, treble: parseInt(e.target.value, 10) })
                    }
                    className="w-full accent-amber-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500">
                    <span>-10dB</span>
                    <span>0dB</span>
                    <span>+10dB</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
          >
            Hủy
          </button>
          <button
            onClick={handleSave}
            className="px-6 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold transition flex items-center space-x-1.5 shadow-md"
          >
            <Check className="h-4 w-4" />
            <span>Lưu Cài Đặt Âm Sắc & Nhân Vật</span>
          </button>
        </div>
      </div>

      {/* Nested Voice Picker Modal */}
      {isVoicePickerOpen && (
        <VoicePickerModal
          isOpen={isVoicePickerOpen}
          onClose={() => setIsVoicePickerOpen(false)}
          selectedVoiceId={voiceName}
          onSelectVoice={(v) => {
            setVoiceName(v.id);
            setIsVoicePickerOpen(false);
          }}
          title={`Chọn Giọng Gemini cho ${name || 'Nhân vật'}`}
        />
      )}
    </div>
  );
};
