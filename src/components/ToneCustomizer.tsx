import React from 'react';
import { AudioToneConfig } from '../types';
import { Sliders, Gauge, Music, RotateCcw, Sparkles } from 'lucide-react';

interface ToneCustomizerProps {
  toneConfig: AudioToneConfig;
  onChangeToneConfig: (config: AudioToneConfig) => void;
}

export const TONE_PRESETS = [
  {
    name: 'Mặc định (Standard)',
    config: { speed: 1.0, pitch: 0, bass: 0, treble: 0, reverb: 0 },
  },
  {
    name: 'Ấm Áp Radio (Warm FM)',
    config: { speed: 1.0, pitch: -1, bass: 5, treble: -1, reverb: 0.1 },
  },
  {
    name: 'Trong Trẻo (Clarity Boost)',
    config: { speed: 1.0, pitch: 1, bass: -2, treble: 6, reverb: 0 },
  },
  {
    name: 'Rạp Phim (Cinematic Movie)',
    config: { speed: 0.95, pitch: -2, bass: 7, treble: 2, reverb: 0.2 },
  },
  {
    name: 'Studio Chuyên Nghiệp',
    config: { speed: 1.05, pitch: 0, bass: 2, treble: 3, reverb: 0 },
  },
];

export const ToneCustomizer: React.FC<ToneCustomizerProps> = ({
  toneConfig,
  onChangeToneConfig,
}) => {
  const handleReset = () => {
    onChangeToneConfig({ speed: 1.0, pitch: 0, bass: 0, treble: 0, reverb: 0 });
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center space-x-2">
          <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
            <Sliders className="h-4 w-4" />
          </div>
          <h3 className="text-xs sm:text-sm font-bold text-slate-100">
            Tùy Chỉnh Âm Sắc & Tốc Độ Phát (Audio Timbre Controls)
          </h3>
        </div>
        <button
          onClick={handleReset}
          className="text-[11px] text-slate-400 hover:text-cyan-300 transition flex items-center space-x-1"
        >
          <RotateCcw className="h-3 w-3" />
          <span>Đặt lại</span>
        </button>
      </div>

      {/* Preset Timbre Buttons */}
      <div>
        <label className="text-[11px] font-semibold text-slate-400 block mb-2">
          Bộ cân bằng âm sắc có sẵn (Timbre Presets):
        </label>
        <div className="flex flex-wrap gap-2">
          {TONE_PRESETS.map((preset) => {
            const isActive =
              toneConfig.bass === preset.config.bass &&
              toneConfig.treble === preset.config.treble &&
              toneConfig.pitch === preset.config.pitch;
            return (
              <button
                key={preset.name}
                onClick={() => onChangeToneConfig({ ...toneConfig, ...preset.config })}
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
        {/* Speed Slider */}
        <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 space-y-1.5">
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
              onChangeToneConfig({ ...toneConfig, speed: parseFloat(e.target.value) })
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
        <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 space-y-1.5">
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
              onChangeToneConfig({ ...toneConfig, pitch: parseInt(e.target.value, 10) })
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
        <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 space-y-1.5">
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
              onChangeToneConfig({ ...toneConfig, bass: parseInt(e.target.value, 10) })
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
        <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 space-y-1.5">
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
              onChangeToneConfig({ ...toneConfig, treble: parseInt(e.target.value, 10) })
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
  );
};
