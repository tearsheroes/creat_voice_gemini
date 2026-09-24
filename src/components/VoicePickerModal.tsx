import React, { useState } from 'react';
import { GEMINI_VOICES } from '../constants/voicesAndPresets';
import { VoiceOption } from '../types';
import { Check, X, User, UserCheck, Sparkles, Volume2 } from 'lucide-react';

interface VoicePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedVoiceId: string;
  onSelectVoice: (voice: VoiceOption) => void;
  title?: string;
}

export const VoicePickerModal: React.FC<VoicePickerModalProps> = ({
  isOpen,
  onClose,
  selectedVoiceId,
  onSelectVoice,
  title = 'Chọn Giọng Đọc Gemini TTS',
}) => {
  const [genderFilter, setGenderFilter] = useState<'all' | 'male' | 'female'>('all');

  if (!isOpen) return null;

  const filteredVoices = GEMINI_VOICES.filter((voice) => {
    if (genderFilter === 'male') return voice.gender === 'male';
    if (genderFilter === 'female') return voice.gender === 'female';
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
              <Volume2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100">{title}</h3>
              <p className="text-xs text-slate-400">
                Tích hợp {GEMINI_VOICES.length} chất giọng Gemini TTS chuẩn cao cấp
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

        {/* Filter Toolbar */}
        <div className="px-5 py-3 border-b border-slate-800/80 bg-slate-950/20 flex items-center justify-between">
          <span className="text-xs text-slate-400 font-medium">Lọc theo giới tính:</span>
          <div className="flex items-center space-x-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
            <button
              onClick={() => setGenderFilter('all')}
              className={`px-3 py-1 rounded-md transition ${
                genderFilter === 'all'
                  ? 'bg-cyan-600 text-white font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Tất cả ({GEMINI_VOICES.length})
            </button>
            <button
              onClick={() => setGenderFilter('female')}
              className={`px-3 py-1 rounded-md transition ${
                genderFilter === 'female'
                  ? 'bg-cyan-600 text-white font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Giọng Nữ ({GEMINI_VOICES.filter((v) => v.gender === 'female').length})
            </button>
            <button
              onClick={() => setGenderFilter('male')}
              className={`px-3 py-1 rounded-md transition ${
                genderFilter === 'male'
                  ? 'bg-cyan-600 text-white font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Giọng Nam ({GEMINI_VOICES.filter((v) => v.gender === 'male').length})
            </button>
          </div>
        </div>

        {/* Voice Grid */}
        <div className="p-5 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filteredVoices.map((voice) => {
            const isSelected = selectedVoiceId === voice.id;
            return (
              <div
                key={voice.id}
                onClick={() => {
                  onSelectVoice(voice);
                  onClose();
                }}
                className={`cursor-pointer p-4 rounded-xl border transition-all duration-200 relative group flex flex-col justify-between ${
                  isSelected
                    ? 'bg-cyan-950/40 border-cyan-500 shadow-md ring-1 ring-cyan-500/50'
                    : 'bg-slate-950/50 border-slate-800 hover:border-slate-700 hover:bg-slate-800/50'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-3">
                      <div
                        className={`h-10 w-10 rounded-xl bg-gradient-to-tr ${voice.avatarColor} flex items-center justify-center text-white font-bold text-sm shadow-md`}
                      >
                        {voice.name.substring(0, 2)}
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <h4 className="font-bold text-sm text-slate-100 group-hover:text-cyan-300">
                            {voice.name}
                          </h4>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                              voice.gender === 'female'
                                ? 'bg-pink-500/10 text-pink-400 border border-pink-500/30'
                                : 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
                            }`}
                          >
                            {voice.gender === 'female' ? 'Nữ' : 'Nam'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 font-medium">
                          {voice.description}
                        </p>
                      </div>
                    </div>
                    {isSelected && (
                      <div className="p-1 rounded-full bg-cyan-500 text-slate-950 font-bold">
                        <Check className="h-4 w-4" />
                      </div>
                    )}
                  </div>

                  <div className="mt-2 text-[11px] bg-slate-900/80 p-2.5 rounded-lg border border-slate-800 text-slate-300 italic">
                    "{voice.sampleText}"
                  </div>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                  <span className="text-slate-400 flex items-center gap-1">
                    <Sparkles className="h-3 w-3 text-amber-400" /> Phù hợp: {voice.bestFor}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
