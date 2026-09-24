import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { DialogueLine, SpeakerAssignment } from '../types';
import { GEMINI_VOICES } from '../constants/voicesAndPresets';
import {
  FileSpreadsheet,
  Upload,
  Download,
  CheckCircle2,
  AlertCircle,
  X,
  FileText,
  Plus,
  RefreshCw,
} from 'lucide-react';

interface ExcelImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  speakers: SpeakerAssignment[];
  currentDialogueLinesCount: number;
  onImport: (updatedSpeakers: SpeakerAssignment[], importedLines: DialogueLine[], appendMode: boolean) => void;
}

interface ParsedPreviewRow {
  rowIndex: number;
  speakerRaw: string;
  speakerResolvedName: string;
  speakerResolvedIndex: number;
  text: string;
  directorsNotes?: string;
  isValid: boolean;
}

export const ExcelImportModal: React.FC<ExcelImportModalProps> = ({
  isOpen,
  onClose,
  speakers,
  currentDialogueLinesCount,
  onImport,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [parsedRows, setParsedRows] = useState<ParsedPreviewRow[]>([]);
  const [createdSpeakerNames, setCreatedSpeakerNames] = useState<string[]>([]);
  const [importMode, setImportMode] = useState<'replace' | 'append'>('replace');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Download Sample Excel Template
  const handleDownloadTemplate = () => {
    try {
      const templateData = [
        ['ID Nhân Vật', 'Lời Thoại', 'Chỉ Đạo Thoại (Ghi Chú)'],
        ['1', '[excited] Chào mừng mọi người đến với buổi thảo luận kịch bản kịch tính này!', 'Giọng hào hứng, truyền cảm'],
        ['2', '[sigh] Liệu kế hoạch này có chuẩn bị kịp tiến độ không anh?', 'Giọng trầm lắng, băn khoăn'],
        ['1', '[reassuring] Anh đã kiểm tra kỹ rồi, mọi thứ đều sẵn sàng!', 'Tốc độ vừa phải, tự tin'],
        ['3', '[clears throat] Thưa hai anh chị, hồ sơ báo cáo chi tiết đã hoàn tất.', 'Giọng tôn trọng, rõ ràng'],
        ['2', '[happy] Tuyệt vời quá! Vậy chúng ta có thể bắt đầu ngay.', 'Tông giọng tươi vui, hào hứng'],
      ];

      const ws = XLSX.utils.aoa_to_sheet(templateData);

      // Set column widths for better readability
      ws['!cols'] = [{ wch: 15 }, { wch: 65 }, { wch: 35 }];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Kịch Bản Mẫu');

      XLSX.writeFile(wb, 'Kich_Ban_Hoi_Thoai_Mau.xlsx');
    } catch (err: any) {
      console.error('Error generating template:', err);
      alert('Không thể tạo file mẫu: ' + (err?.message || 'Lỗi hệ thống'));
    }
  };

  // Process Excel File
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setErrorMsg(null);
    setIsProcessing(true);

    try {
      const buffer = await selectedFile.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });

      if (!wb.SheetNames || wb.SheetNames.length === 0) {
        throw new Error('File Excel không chứa trang tính (sheet) nào.');
      }

      const firstSheet = wb.Sheets[wb.SheetNames[0]];
      const rawMatrix: any[][] = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });

      if (!rawMatrix || rawMatrix.length === 0) {
        throw new Error('Trang tính trống không có dữ liệu.');
      }

      // Check if row 0 is header row
      let startRow = 0;
      const row0Col0 = String(rawMatrix[0]?.[0] || '').toLowerCase();
      const row0Col1 = String(rawMatrix[0]?.[1] || '').toLowerCase();

      if (
        row0Col0.includes('id') ||
        row0Col0.includes('nhân vật') ||
        row0Col0.includes('speaker') ||
        row0Col0.includes('cột') ||
        row0Col1.includes('thoại') ||
        row0Col1.includes('text') ||
        row0Col1.includes('lời')
      ) {
        startRow = 1; // Skip header
      }

      const rows: ParsedPreviewRow[] = [];
      const tempSpeakersList = [...speakers];
      const newlyAddedSpeakerNames: string[] = [];

      for (let i = startRow; i < rawMatrix.length; i++) {
        const row = rawMatrix[i];
        if (!row || row.length === 0) continue;

        const col0Raw = row[0] !== undefined && row[0] !== null ? String(row[0]).trim() : '';
        const col1Raw = row[1] !== undefined && row[1] !== null ? String(row[1]).trim() : '';
        const col2Raw = row[2] !== undefined && row[2] !== null ? String(row[2]).trim() : '';

        // Skip rows without dialogue text
        if (!col1Raw) continue;

        // Parse Speaker ID / Index
        let matchedSpeakerIndex = 0;
        let matchedSpeakerName = '';

        // Extract numeric ID if present e.g. "1", "2", "ID 1", "Nhân vật #3", "#4"
        const numMatch = col0Raw.match(/(?:id|nhân\s*vật|speaker|người|cột)?\s*#?\s*(\d+)/i) || col0Raw.match(/^(\d+)$/);

        if (numMatch && numMatch[1]) {
          const parsedIdNum = parseInt(numMatch[1], 10);
          if (!isNaN(parsedIdNum) && parsedIdNum >= 1) {
            matchedSpeakerIndex = parsedIdNum - 1;

            // Ensure index is within max 32
            if (matchedSpeakerIndex >= 32) {
              matchedSpeakerIndex = 31;
            }

            // Auto-expand tempSpeakersList if parsed index exceeds current count up to 32
            while (tempSpeakersList.length <= matchedSpeakerIndex && tempSpeakersList.length < 32) {
              const nextIdx = tempSpeakersList.length + 1;
              const unusedVoice =
                GEMINI_VOICES.find((v) => !tempSpeakersList.some((s) => s.voiceName === v.id)) ||
                GEMINI_VOICES[tempSpeakersList.length % GEMINI_VOICES.length];

              const newSpkName = `Nhân vật #${nextIdx}`;
              tempSpeakersList.push({
                id: `speaker-${Date.now()}-${Math.random().toString(36).substr(2, 4)}-${nextIdx}`,
                name: newSpkName,
                voiceName: unusedVoice.id,
                style: 'natural',
                audioProfile: '',
                directorsNotes: '',
              });
              newlyAddedSpeakerNames.push(newSpkName);
            }

            matchedSpeakerName = tempSpeakersList[matchedSpeakerIndex]?.name || `Nhân vật #${matchedSpeakerIndex + 1}`;
          }
        } else if (col0Raw) {
          // Search by exact name or ID match
          const foundIdx = tempSpeakersList.findIndex(
            (s) => s.id === col0Raw || s.name.toLowerCase() === col0Raw.toLowerCase()
          );

          if (foundIdx !== -1) {
            matchedSpeakerIndex = foundIdx;
            matchedSpeakerName = tempSpeakersList[foundIdx].name;
          } else if (tempSpeakersList.length < 32) {
            // Create custom named speaker
            const unusedVoice =
              GEMINI_VOICES.find((v) => !tempSpeakersList.some((s) => s.voiceName === v.id)) ||
              GEMINI_VOICES[tempSpeakersList.length % GEMINI_VOICES.length];

            const newSpk: SpeakerAssignment = {
              id: `speaker-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
              name: col0Raw,
              voiceName: unusedVoice.id,
              style: 'natural',
              audioProfile: '',
              directorsNotes: '',
            };
            tempSpeakersList.push(newSpk);
            newlyAddedSpeakerNames.push(col0Raw);

            matchedSpeakerIndex = tempSpeakersList.length - 1;
            matchedSpeakerName = col0Raw;
          } else {
            // Fallback to speaker 0 if at max capacity
            matchedSpeakerIndex = 0;
            matchedSpeakerName = tempSpeakersList[0].name;
          }
        } else {
          // Default to speaker 0 if col0 empty
          matchedSpeakerIndex = 0;
          matchedSpeakerName = tempSpeakersList[0]?.name || 'Nhân vật #1';
        }

        rows.push({
          rowIndex: i + 1,
          speakerRaw: col0Raw || '1',
          speakerResolvedName: matchedSpeakerName,
          speakerResolvedIndex: matchedSpeakerIndex,
          text: col1Raw,
          directorsNotes: col2Raw || undefined,
          isValid: true,
        });
      }

      if (rows.length === 0) {
        throw new Error('Không tìm thấy dòng thoại hợp lệ trong cột 2 của file Excel.');
      }

      setParsedRows(rows);
      setCreatedSpeakerNames(Array.from(new Set(newlyAddedSpeakerNames)));
    } catch (err: any) {
      console.error('Error parsing Excel file:', err);
      setErrorMsg(err?.message || 'Có lỗi khi đọc file Excel.');
      setParsedRows([]);
    } finally {
      setIsProcessing(false);
    }
  };

  // Confirm Import
  const handleConfirmImport = () => {
    if (parsedRows.length === 0) return;

    // Build speakers state with any auto-created speakers
    const updatedSpeakers = [...speakers];

    parsedRows.forEach((row) => {
      const idx = row.speakerResolvedIndex;
      while (updatedSpeakers.length <= idx && updatedSpeakers.length < 32) {
        const nextIdx = updatedSpeakers.length + 1;
        const unusedVoice =
          GEMINI_VOICES.find((v) => !updatedSpeakers.some((s) => s.voiceName === v.id)) ||
          GEMINI_VOICES[updatedSpeakers.length % GEMINI_VOICES.length];

        updatedSpeakers.push({
          id: `speaker-${Date.now()}-${Math.random().toString(36).substr(2, 4)}-${nextIdx}`,
          name: `Nhân vật #${nextIdx}`,
          voiceName: unusedVoice.id,
          style: 'natural',
          audioProfile: '',
          directorsNotes: '',
        });
      }
    });

    // Create DialogueLine list
    const importedDialogueLines: DialogueLine[] = parsedRows.map((row, idx) => {
      const targetSpeaker = updatedSpeakers[row.speakerResolvedIndex] || updatedSpeakers[0];

      return {
        id: `line-excel-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 4)}`,
        speakerId: targetSpeaker.id,
        text: row.text,
        directorsNotes: row.directorsNotes,
      };
    });

    onImport(updatedSpeakers, importedDialogueLines, importMode === 'append');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl space-y-5 my-8">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center space-x-2.5">
            <div className="h-9 w-9 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100">
                Nhập Kịch Bản Từ File Excel (.xlsx / .csv)
              </h3>
              <p className="text-xs text-slate-400">
                Cột 1: ID/Mã nhân vật | Cột 2: Lời thoại | Cột 3: Chỉ đạo thoại
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Download Template Action */}
        <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 flex items-center justify-between gap-3">
          <div className="text-xs text-slate-300 space-y-0.5">
            <span className="font-semibold text-cyan-400 block">💡 Chưa có mẫu file?</span>
            <p className="text-[11px] text-slate-400">
              Tải file mẫu Excel chuẩn để xem định dạng 3 cột chính xác.
            </p>
          </div>
          <button
            type="button"
            onClick={handleDownloadTemplate}
            className="px-3.5 py-1.5 bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-700/60 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 shrink-0 shadow-sm"
          >
            <Download className="h-3.5 w-3.5 text-emerald-400" />
            <span>Tải Mẫu Excel</span>
          </button>
        </div>

        {/* File Input Uploader */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-200 block">
            Chọn file Excel kịch bản của bạn:
          </label>
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-700 hover:border-cyan-500 rounded-xl p-6 text-center cursor-pointer bg-slate-950/60 hover:bg-slate-950 transition space-y-2 group"
          >
            <Upload className="h-8 w-8 text-cyan-400 mx-auto group-hover:scale-110 transition" />
            <div className="text-xs text-slate-300 font-medium">
              {file ? (
                <span className="text-cyan-400 font-bold">{file.name}</span>
              ) : (
                <span>Nhấp để chọn file hoặc kéo thả file Excel (.xlsx, .xls, .csv) vào đây</span>
              )}
            </div>
            <p className="text-[11px] text-slate-500">
              Hệ thống tự động ghép ID nhân vật (1-32) và phân câu thoại theo đúng danh sách.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx, .xls, .csv"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>
        </div>

        {/* Loading Spinner */}
        {isProcessing && (
          <div className="p-4 text-center text-xs text-cyan-400 flex items-center justify-center space-x-2">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span>Đang đọc và phân tích file Excel...</span>
          </div>
        )}

        {/* Error Message */}
        {errorMsg && (
          <div className="p-3 bg-rose-950/60 border border-rose-800/80 rounded-xl text-rose-300 text-xs flex items-center space-x-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Parsed Preview Table */}
        {parsedRows.length > 0 && (
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-200 flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <span>Đã quét được {parsedRows.length} câu thoại từ file:</span>
              </span>

              {createdSpeakerNames.length > 0 && (
                <span className="text-[11px] text-amber-300 font-medium bg-amber-950/80 px-2 py-0.5 rounded border border-amber-800/60">
                  ✨ Khởi tạo thêm {createdSpeakerNames.length} nhân vật mới
                </span>
              )}
            </div>

            {/* Table Container */}
            <div className="max-h-56 overflow-y-auto border border-slate-800 rounded-xl bg-slate-950 text-xs">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-900 border-b border-slate-800 text-slate-400 font-semibold text-[11px]">
                    <th className="py-2 px-3 w-12 text-center">Dòng</th>
                    <th className="py-2 px-3 w-36">ID/Tên Nhân Vật</th>
                    <th className="py-2 px-3">Lời Thoại (Cột 2)</th>
                    <th className="py-2 px-3 w-40">Chỉ Đạo Thoại (Cột 3)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-sans">
                  {parsedRows.map((row) => (
                    <tr key={row.rowIndex} className="hover:bg-slate-900/50">
                      <td className="py-2 px-3 text-center text-slate-500 font-mono text-[11px]">
                        {row.rowIndex}
                      </td>
                      <td className="py-2 px-3 font-semibold text-cyan-300">
                        <span className="px-1.5 py-0.5 rounded bg-cyan-950 border border-cyan-800 text-[10px] mr-1 text-cyan-400 font-mono">
                          ID: #{row.speakerResolvedIndex + 1}
                        </span>
                        <span>{row.speakerResolvedName}</span>
                      </td>
                      <td className="py-2 px-3 text-slate-200 line-clamp-2">
                        {row.text}
                      </td>
                      <td className="py-2 px-3 text-slate-400 italic text-[11px]">
                        {row.directorsNotes || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Import Mode Selection */}
            <div className="pt-2 border-t border-slate-800 space-y-2">
              <label className="text-xs font-semibold text-slate-300 block">
                Chế độ nhập kịch bản:
              </label>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <label
                  className={`p-3 rounded-xl border cursor-pointer flex items-center space-x-2.5 transition ${
                    importMode === 'replace'
                      ? 'bg-cyan-950/60 border-cyan-500 text-cyan-200'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <input
                    type="radio"
                    name="importMode"
                    value="replace"
                    checked={importMode === 'replace'}
                    onChange={() => setImportMode('replace')}
                    className="accent-cyan-500"
                  />
                  <div>
                    <span className="font-bold block text-slate-100">Thay thế kịch bản cũ</span>
                    <span className="text-[11px] text-slate-400 block">
                      Xóa danh sách lượt thoại hiện tại và thay bằng file mới
                    </span>
                  </div>
                </label>

                <label
                  className={`p-3 rounded-xl border cursor-pointer flex items-center space-x-2.5 transition ${
                    importMode === 'append'
                      ? 'bg-cyan-950/60 border-cyan-500 text-cyan-200'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <input
                    type="radio"
                    name="importMode"
                    value="append"
                    checked={importMode === 'append'}
                    onChange={() => setImportMode('append')}
                    className="accent-cyan-500"
                  />
                  <div>
                    <span className="font-bold block text-slate-100">
                      Nối vào cuối kịch bản ({currentDialogueLinesCount} câu cũ)
                    </span>
                    <span className="text-[11px] text-slate-400 block">
                      Giữ nguyên kịch bản hiện tại và thêm các câu mới bên dưới
                    </span>
                  </div>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Modal Actions Footer */}
        <div className="flex items-center justify-end space-x-2.5 pt-3 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
          >
            Hủy
          </button>
          <button
            type="button"
            disabled={parsedRows.length === 0}
            onClick={handleConfirmImport}
            className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold transition shadow-lg flex items-center space-x-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <CheckCircle2 className="h-4 w-4" />
            <span>Xác Nhận Nhập ({parsedRows.length} Câu)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
