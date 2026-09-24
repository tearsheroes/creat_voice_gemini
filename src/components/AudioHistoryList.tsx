import React from 'react';
import { AudioTrack } from '../types';
import { History, Play, Download, Trash2, Clock, Music } from 'lucide-react';

interface AudioHistoryListProps {
  history: AudioTrack[];
  onSelectTrack: (track: AudioTrack) => void;
  onDeleteTrack: (id: string) => void;
  onClearHistory: () => void;
}

export const AudioHistoryList: React.FC<AudioHistoryListProps> = ({
  history,
  onSelectTrack,
  onDeleteTrack,
  onClearHistory,
}) => {
  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center space-x-2">
          <History className="h-4 w-4 text-cyan-400" />
          <h3 className="text-sm font-bold text-slate-100">
            Lịch Sử Các Tệp Âm Thanh Đã Tạo ({history.length})
          </h3>
        </div>

        {history.length > 0 && (
          <button
            onClick={onClearHistory}
            className="text-xs text-rose-400 hover:text-rose-300 font-medium transition"
          >
            Xóa lịch sử
          </button>
        )}
      </div>

      {history.length === 0 ? (
        <div className="p-8 text-center text-xs text-slate-500 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
          <Music className="h-8 w-8 text-slate-700 mx-auto animate-bounce" />
          <p>Chưa có tệp âm thanh nào được lưu trong lịch sử.</p>
        </div>
      ) : (
        <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
          {history.map((track) => (
            <div
              key={track.id}
              className="p-3.5 bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-xl flex items-center justify-between space-x-3 transition group"
            >
              <div className="flex items-center space-x-3 overflow-hidden">
                <button
                  onClick={() => onSelectTrack(track)}
                  className="h-10 w-10 rounded-xl bg-cyan-600/20 hover:bg-cyan-600/40 text-cyan-400 flex items-center justify-center transition border border-cyan-500/30 shrink-0"
                >
                  <Play className="h-4 w-4 fill-current ml-0.5" />
                </button>

                <div className="overflow-hidden">
                  <h4 className="text-xs font-bold text-slate-100 truncate group-hover:text-cyan-300">
                    {track.title}
                  </h4>
                  <p className="text-[11px] text-slate-400 truncate mt-0.5">
                    "{track.textSnippet}"
                  </p>
                  <div className="flex items-center space-x-2 text-[10px] text-slate-500 mt-1">
                    <span className="uppercase font-mono text-cyan-400">{track.audioFormat}</span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(track.createdAt).toLocaleTimeString('vi-VN', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-1 shrink-0">
                <button
                  onClick={() => onSelectTrack(track)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition"
                >
                  Phát
                </button>

                <button
                  onClick={() => onDeleteTrack(track.id)}
                  className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition"
                  title="Xóa khỏi lịch sử"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
