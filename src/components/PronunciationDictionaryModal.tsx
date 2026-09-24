import React, { useState } from 'react';
import { PronunciationRule } from '../types';
import { X, Plus, Trash2, BookOpen, Search, CheckCircle2 } from 'lucide-react';

interface PronunciationDictionaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  dictionary: PronunciationRule[];
  onUpdateDictionary: (newDict: PronunciationRule[]) => void;
  onApplyToScript: () => void;
}

export const PronunciationDictionaryModal: React.FC<PronunciationDictionaryModalProps> = ({
  isOpen,
  onClose,
  dictionary,
  onUpdateDictionary,
  onApplyToScript,
}) => {
  const [newOriginal, setNewOriginal] = useState('');
  const [newReplacement, setNewReplacement] = useState('');

  if (!isOpen) return null;

  const handleAddRule = () => {
    if (!newOriginal.trim() || !newReplacement.trim()) return;
    
    // Check if original already exists
    if (dictionary.some(rule => rule.original.toLowerCase() === newOriginal.trim().toLowerCase())) {
      alert('Từ gốc này đã tồn tại trong từ điển.');
      return;
    }

    const newRule: PronunciationRule = {
      id: Math.random().toString(36).substr(2, 9),
      original: newOriginal.trim(),
      replacement: newReplacement.trim(),
    };

    onUpdateDictionary([...dictionary, newRule]);
    setNewOriginal('');
    setNewReplacement('');
  };

  const handleRemoveRule = (id: string) => {
    onUpdateDictionary(dictionary.filter(rule => rule.id !== id));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddRule();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-cyan-950/50 border border-cyan-800/50 flex items-center justify-center text-cyan-400">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100 leading-tight">Từ Điển Phát Âm</h2>
              <p className="text-xs text-slate-400 mt-0.5">Sửa lỗi AI đọc sai tên riêng, từ viết tắt</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-6">
          
          <div className="bg-slate-950/50 border border-slate-800/80 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
              <Plus className="h-4 w-4 text-emerald-400" /> Thêm quy tắc mới
            </h3>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                placeholder="Từ gốc (VD: AI)"
                value={newOriginal}
                onChange={(e) => setNewOriginal(e.target.value)}
                onKeyDown={handleKeyDown}
                className="flex-1 bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/80 transition"
              />
              <div className="hidden sm:flex items-center text-slate-600">→</div>
              <input
                type="text"
                placeholder="Phát âm thành (VD: Ây Ai)"
                value={newReplacement}
                onChange={(e) => setNewReplacement(e.target.value)}
                onKeyDown={handleKeyDown}
                className="flex-1 bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/80 transition"
              />
              <button
                onClick={handleAddRule}
                disabled={!newOriginal.trim() || !newReplacement.trim()}
                className="bg-emerald-600/90 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-semibold transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                Thêm
              </button>
            </div>
            <p className="text-[11px] text-slate-500 mt-2">
              Ví dụ: "CEO" → "Xi Y Âu", "MKT" → "Ma Két Tinh". Hệ thống sẽ thay thế tự động trong kịch bản.
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-300">Danh sách quy tắc ({dictionary.length})</h3>
              {dictionary.length > 0 && (
                <button
                  onClick={onApplyToScript}
                  className="bg-cyan-600 hover:bg-cyan-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" /> Áp dụng vào kịch bản
                </button>
              )}
            </div>
            
            {dictionary.length === 0 ? (
              <div className="text-center py-8 bg-slate-900/50 rounded-xl border border-slate-800 border-dashed">
                <BookOpen className="h-8 w-8 text-slate-700 mx-auto mb-3" />
                <p className="text-sm text-slate-400">Từ điển đang trống</p>
                <p className="text-xs text-slate-500 mt-1">Thêm các quy tắc phát âm ở phía trên</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {dictionary.map((rule) => (
                  <div key={rule.id} className="flex items-center justify-between p-3 bg-slate-800/40 border border-slate-700/50 rounded-xl hover:border-slate-600/50 transition group">
                    <div className="flex items-center gap-3 overflow-hidden flex-1 mr-4">
                      <span className="font-semibold text-slate-200 text-sm truncate">{rule.original}</span>
                      <span className="text-slate-500 text-xs shrink-0">→</span>
                      <span className="text-emerald-400 text-sm truncate">{rule.replacement}</span>
                    </div>
                    <button
                      onClick={() => handleRemoveRule(rule.id)}
                      className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-950/50 rounded-lg transition opacity-0 group-hover:opacity-100 focus:opacity-100"
                      title="Xóa quy tắc"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-800/80 bg-slate-900/50 flex justify-end rounded-b-2xl">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl text-slate-300 font-medium hover:bg-slate-800 transition text-sm"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
