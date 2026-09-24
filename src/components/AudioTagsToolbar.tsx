import React from 'react';
import { GEMINI_AUDIO_TAGS } from '../constants/voicesAndPresets';
import { Tag, Sparkles } from 'lucide-react';

interface AudioTagsToolbarProps {
  onInsertTag: (tag: string) => void;
  compact?: boolean;
}

export const AudioTagsToolbar: React.FC<AudioTagsToolbarProps> = ({
  onInsertTag,
  compact = false,
}) => {
  return (
    <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-2.5 space-y-2">
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span className="font-semibold flex items-center gap-1.5 text-slate-300">
          <Tag className="h-3.5 w-3.5 text-cyan-400" />
          <span>Thẻ Âm Thanh Gemini TTS (Audio Tags):</span>
        </span>
        <span className="text-[11px] text-cyan-400 font-mono flex items-center gap-1">
          <Sparkles className="h-3 w-3" /> Chèn trực tiếp vào vị trí thoại
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {GEMINI_AUDIO_TAGS.map((tagOpt) => (
          <button
            key={tagOpt.tag}
            type="button"
            onClick={() => onInsertTag(tagOpt.tag)}
            className="px-2.5 py-1 rounded-lg text-xs font-mono font-medium bg-slate-900 border border-slate-700/80 hover:border-cyan-500 hover:bg-cyan-950/40 text-cyan-300 hover:text-cyan-200 transition shadow-sm group relative"
            title={tagOpt.description}
          >
            {tagOpt.tag}
            <span className="ml-1 text-[10px] text-slate-500 group-hover:text-slate-300">
              ({tagOpt.label})
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};
