import React, { useState } from 'react';
import { PresetScene, SpeakerAssignment, DialogueLine } from '../types';
import { FolderHeart, Play, Trash2, Plus, Sparkles, Clock, Users } from 'lucide-react';
import { getDialogueCharacterSceneName } from '../utils/presetUtils';

interface PresetManagerProps {
  presets: PresetScene[];
  speakers?: SpeakerAssignment[];
  dialogueLines?: DialogueLine[];
  onLoadPreset: (preset: PresetScene) => void;
  onSaveCurrentAsPreset: (title: string, description: string) => void;
  onDeletePreset: (id: string) => void;
}

export const PresetManager: React.FC<PresetManagerProps> = ({
  presets,
  speakers = [],
  dialogueLines = [],
  onLoadPreset,
  onSaveCurrentAsPreset,
  onDeletePreset,
}) => {
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');

  const suggestedTitle = getDialogueCharacterSceneName(speakers, dialogueLines);

  const handleOpenSaveModal = () => {
    setNewTitle(suggestedTitle);
    setShowSaveModal(true);
  };

  const handleSave = () => {
    if (!newTitle.trim()) return;
    onSaveCurrentAsPreset(newTitle.trim(), newDesc.trim());
    setNewTitle('');
    setNewDesc('');
    setShowSaveModal(false);
  };

  return (
    <div className="space-y-4">
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div>
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <FolderHeart className="h-4 w-4 text-cyan-400" />
              <span>Quản Lý Cảnh Kịch Bản & Giọng Đọc Đã Lưu (Workflow Presets)</span>
            </h3>
            <p className="text-xs text-slate-400">
              Lưu giữ các thiết lập giọng đọc, tốc độ và kịch bản để tối ưu hóa quy trình cá nhân
            </p>
          </div>

          <button
            onClick={handleOpenSaveModal}
            className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs rounded-xl transition shadow-lg shadow-cyan-500/20 flex items-center space-x-1.5"
          >
            <Plus className="h-4 w-4" />
            <span>Lưu Cấu Hình Hiện Tại Thành Cảnh</span>
          </button>
        </div>

        {/* Preset List Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {presets.map((preset) => (
            <div
              key={preset.id}
              className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-slate-700 transition flex flex-col justify-between space-y-3 group"
            >
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                    {preset.category}
                  </span>
                  <span className="text-[10px] text-slate-500 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {new Date(preset.createdAt).toLocaleDateString('vi-VN')}
                  </span>
                </div>

                <h4 className="font-bold text-sm text-slate-100 group-hover:text-cyan-300 transition-colors">
                  {preset.title}
                </h4>
                <p className="text-xs text-slate-400 mt-1 line-clamp-2">{preset.description}</p>

                <div className="mt-3 p-2.5 rounded-lg bg-slate-900/60 border border-slate-800/80 text-[11px] space-y-1 text-slate-300 font-mono">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Chế độ:</span>
                    <span className="font-semibold text-cyan-400">
                      {preset.mode === 'multi' ? 'Đa thoại (Multi-Speaker)' : 'Đơn giọng'}
                    </span>
                  </div>
                  {preset.voiceName && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Giọng chính:</span>
                      <span className="font-semibold">{preset.voiceName}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-slate-500">Tốc độ & Cao độ:</span>
                    <span>
                      {preset.speed}x | {preset.pitch > 0 ? `+${preset.pitch}` : preset.pitch} ST
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                <button
                  onClick={() => onDeletePreset(preset.id)}
                  className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition"
                  title="Xóa cảnh lưu"
                >
                  <Trash2 className="h-4 w-4" />
                </button>

                <button
                  onClick={() => onLoadPreset(preset)}
                  className="px-3.5 py-1.5 bg-cyan-600/20 hover:bg-cyan-600/40 text-cyan-300 border border-cyan-500/30 font-bold text-xs rounded-lg transition flex items-center space-x-1"
                >
                  <Play className="h-3.5 w-3.5 fill-current" />
                  <span>Tải Cảnh Này</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Save Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <h4 className="font-bold text-sm text-slate-100 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-cyan-400" />
              <span>Lưu Cảnh & Giọng Đọc Vào Thư Viện</span>
            </h4>

            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-300 block">
                    Tên Cảnh / Preset:
                  </label>
                  {suggestedTitle && (
                    <button
                      type="button"
                      onClick={() => setNewTitle(suggestedTitle)}
                      className="text-[10px] text-cyan-400 hover:text-cyan-300 font-semibold bg-cyan-950/80 hover:bg-cyan-900 px-2 py-0.5 rounded border border-cyan-800/80 transition flex items-center gap-1"
                      title="Đặt tên theo danh sách nhân vật có trong kịch bản"
                    >
                      <Users className="h-3 w-3" />
                      <span>Tự động theo nhân vật</span>
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  placeholder="Ví dụ: Cảnh thoại: Bác sĩ & Bệnh nhân"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Mô tả ngắn:
                </label>
                <input
                  type="text"
                  placeholder="Mô tả phong cách đọc, bối cảnh sử dụng..."
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end space-x-2">
              <button
                onClick={() => setShowSaveModal(false)}
                className="px-4 py-2 bg-slate-800 text-slate-300 text-xs font-semibold rounded-xl"
              >
                Hủy
              </button>
              <button
                onClick={handleSave}
                disabled={!newTitle.trim()}
                className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs rounded-xl transition shadow-lg disabled:opacity-50"
              >
                Lưu Ngay
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
