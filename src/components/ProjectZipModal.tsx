import React, { useState, useRef } from 'react';
import {
  FolderArchive,
  DownloadCloud,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  FileCheck,
  Package,
} from 'lucide-react';
import {
  FullProjectBackupData,
  exportProjectToZip,
  importProjectFromZip,
  triggerFileDownload,
} from '../utils/zipStorage';

interface ProjectZipModalProps {
  isOpen: boolean;
  onClose: () => void;
  getCurrentProjectData: () => FullProjectBackupData;
  onRestoreProject: (importedData: FullProjectBackupData) => void;
  presetCount: number;
  historyCount: number;
}

export const ProjectZipModal: React.FC<ProjectZipModalProps> = ({
  isOpen,
  onClose,
  getCurrentProjectData,
  onRestoreProject,
  presetCount,
  historyCount,
}) => {
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleExport = async () => {
    try {
      setIsExporting(true);
      setStatusMessage(null);
      const data = getCurrentProjectData();
      const zipBlob = await exportProjectToZip(data);

      const dateStr = new Date().toISOString().slice(0, 10);
      const filename = `gemini-vox-project-${dateStr}.zip`;
      triggerFileDownload(zipBlob, filename);

      setStatusMessage({
        type: 'success',
        text: `Đã đóng gói và tải về tệp "${filename}" thành công!`,
      });
    } catch (err: any) {
      console.error('ZIP Export error:', err);
      setStatusMessage({
        type: 'error',
        text: err.message || 'Lỗi khi đóng gói tệp ZIP dự án.',
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processZipFile(file);
    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const processZipFile = async (file: File) => {
    try {
      setIsImporting(true);
      setStatusMessage(null);

      if (!file.name.toLowerCase().endsWith('.zip')) {
        throw new Error('Vui lòng chọn tệp định dạng .ZIP!');
      }

      const importedData = await importProjectFromZip(file);
      onRestoreProject(importedData);

      setStatusMessage({
        type: 'success',
        text: 'Khôi phục toàn bộ dữ liệu dự án từ tệp ZIP thành công!',
      });
    } catch (err: any) {
      console.error('ZIP Import error:', err);
      setStatusMessage({
        type: 'error',
        text: err.message || 'Không thể khôi phục dữ liệu từ tệp ZIP đã chọn.',
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      await processZipFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-md">
              <FolderArchive className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100">Sao Lưu & Khôi Phục Dự Án (.ZIP)</h3>
              <p className="text-xs text-slate-400">Đóng gói toàn bộ kịch bản, âm thanh, cảnh và cài đặt</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-5">
          {/* Status notification */}
          {statusMessage && (
            <div
              className={`p-3.5 rounded-xl border text-xs flex items-start space-x-2.5 ${
                statusMessage.type === 'success'
                  ? 'bg-emerald-950/60 border-emerald-800/80 text-emerald-200'
                  : 'bg-rose-950/60 border-rose-800/80 text-rose-200'
              }`}
            >
              {statusMessage.type === 'success' ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
              )}
              <span className="leading-relaxed font-medium">{statusMessage.text}</span>
            </div>
          )}

          {/* Export Action Card */}
          <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800/80 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Package className="h-4 w-4 text-blue-400" />
                <h4 className="text-xs font-bold text-slate-200">Tải Về Gói ZIP Dự Án</h4>
              </div>
              <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded font-mono">
                Full Package
              </span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Xuất toàn bộ kịch bản đơn/nhiều nhân vật, cấu hình AI, {presetCount} cảnh lưu,{' '}
              {historyCount} bản thu âm lịch sử và chìa khóa API thành 1 file .zip duy nhất.
            </p>

            <button
              onClick={handleExport}
              disabled={isExporting}
              className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-xs rounded-xl shadow-lg shadow-blue-600/20 transition disabled:opacity-50"
            >
              {isExporting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-white" />
                  <span>Đang nén dữ liệu & tạo ZIP...</span>
                </>
              ) : (
                <>
                  <DownloadCloud className="h-4 w-4" />
                  <span>Tải Xuống File ZIP Tất Cả Dữ Liệu</span>
                </>
              )}
            </button>
          </div>

          {/* Import / Restore Drag & Drop Zone */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-300 flex items-center space-x-1.5">
              <UploadCloud className="h-4 w-4 text-cyan-400" />
              <span>Khôi Phục Dự Án Từ File ZIP</span>
            </h4>

            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-700 hover:border-cyan-500/80 bg-slate-950/50 hover:bg-slate-950/80 p-5 rounded-xl text-center cursor-pointer transition flex flex-col items-center justify-center space-y-2 group"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".zip"
                onChange={handleFileChange}
                className="hidden"
              />

              {isImporting ? (
                <div className="flex flex-col items-center space-y-2 py-2">
                  <Loader2 className="h-8 w-8 text-cyan-400 animate-spin" />
                  <p className="text-xs font-medium text-cyan-300">Đang giải nén & khôi phục dự án...</p>
                </div>
              ) : (
                <>
                  <div className="p-3 bg-slate-800 group-hover:bg-cyan-950/60 group-hover:text-cyan-400 text-slate-300 rounded-full transition">
                    <FileCheck className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-200 group-hover:text-cyan-300 transition">
                      Kéo thả file ZIP vào đây hoặc nhấp để tải lên
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Đã từng sao lưu trước đây? Chỉ cần tải file ZIP lên để tiếp tục làm việc ngay lập tức.
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
          <span>Tệp .zip chứa project.json và âm thanh tự nén.</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold transition"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
