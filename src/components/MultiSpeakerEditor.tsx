import React, { useState, useRef } from 'react';
import { DialogueLine, SpeakerAssignment, AudioPromptConfig } from '../types';
import { GEMINI_VOICES } from '../constants/voicesAndPresets';
import { VoicePickerModal } from './VoicePickerModal';
import { SpeakerConfigModal } from './SpeakerConfigModal';
import { ExcelImportModal } from './ExcelImportModal';
import { AudioTagsToolbar } from './AudioTagsToolbar';
import { GeminiAdvancedConfigPanel } from './GeminiAdvancedConfigPanel';
import { AIFieldButton } from './AIFieldButton';
import { LineNumberInput } from './LineNumberInput';
import { getStoredApiSettings } from '../utils/apiSettingsStorage';
import { getDialogueCharacterSceneName } from '../utils/presetUtils';
import {
  Users,
  Plus,
  Trash2,
  Wand2,
  Play,
  RefreshCw,
  MessageSquare,
  Volume2,
  User,
  Sparkles,
  Clapperboard,
  SlidersHorizontal,
  PlusCircle,
  FileText,
  GripVertical,
  ChevronUp,
  ChevronDown,
  Settings,
  Sliders,
  Eye,
  EyeOff,
  FileSpreadsheet,
  UserCheck,
  BookmarkPlus,
  Check,
  Type,
  CaseLower,
  ListOrdered,
} from 'lucide-react';

interface MultiSpeakerEditorProps {
  speakers: SpeakerAssignment[];
  setSpeakers: React.Dispatch<React.SetStateAction<SpeakerAssignment[]>>;
  dialogueLines: DialogueLine[];
  setDialogueLines: React.Dispatch<React.SetStateAction<DialogueLine[]>>;
  promptConfig: AudioPromptConfig;
  setPromptConfig: (c: AudioPromptConfig) => void;
  onGenerate: () => void;
  isGenerating: boolean;
  onOpenRefinement: () => void;
  onSaveCurrentAsPreset?: (title: string, description: string) => void;
  getFullContext?: () => any;
}

export const MultiSpeakerEditor: React.FC<MultiSpeakerEditorProps> = ({
  speakers,
  setSpeakers,
  dialogueLines,
  setDialogueLines,
  promptConfig,
  setPromptConfig,
  onGenerate,
  isGenerating,
  onOpenRefinement,
  onSaveCurrentAsPreset,
  getFullContext,
}) => {
  const [activePickingSpeakerId, setActivePickingSpeakerId] = useState<string | null>(null);
  const [activeConfigSpeakerId, setActiveConfigSpeakerId] = useState<string | null>(null);
  const [rawScriptText, setRawScriptText] = useState('');
  const [showRawParser, setShowRawParser] = useState(false);
  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);
  const [activeLineTagTargetId, setActiveLineTagTargetId] = useState<string | null>(null);
  const [activeLineNotesId, setActiveLineNotesId] = useState<string | null>(null);

  // Collapsible Speakers section state
  const [isSpeakersExpanded, setIsSpeakersExpanded] = useState<boolean>(true);

  // Save Scene Modal state
  const [showSaveSceneModal, setShowSaveSceneModal] = useState<boolean>(false);
  const [saveSceneTitle, setSaveSceneTitle] = useState<string>('');
  const [saveSceneDesc, setSaveSceneDesc] = useState<string>('');
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<boolean>(false);

  // Clear Dialogue Lines Confirmation Modal state
  const [showClearConfirmModal, setShowClearConfirmModal] = useState<boolean>(false);

  const handleClearAllDialogueLines = () => {
    setDialogueLines([]);
    setRawScriptText('');
    setActiveLineTagTargetId(null);
    setActiveLineNotesId(null);
    setShowClearConfirmModal(false);
    textareaRefs.current = {};
    cursorPositions.current = {};
  };

  const handleConvertAllToLowercase = () => {
    setDialogueLines((prev) =>
      prev.map((l) => ({ ...l, text: l.text.toLowerCase() }))
    );
  };

  const handleConvertLineToLowercase = (lineId: string) => {
    setDialogueLines((prev) =>
      prev.map((l) => (l.id === lineId ? { ...l, text: l.text.toLowerCase() } : l))
    );
  };

  // Textarea cursor position tracking for exact tag insertion
  const textareaRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});
  const cursorPositions = useRef<Record<string, { start: number; end: number }>>({});

  // Drag & drop state for dialogue lines reordering
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Handle open save scene modal with suggested character-based title
  const handleOpenSaveSceneModal = () => {
    const suggestedTitle = getDialogueCharacterSceneName(speakers, dialogueLines);
    setSaveSceneTitle(suggestedTitle);
    setShowSaveSceneModal(true);
  };

  const handleSaveSceneSubmit = () => {
    if (!saveSceneTitle.trim()) return;
    if (onSaveCurrentAsPreset) {
      onSaveCurrentAsPreset(saveSceneTitle.trim(), saveSceneDesc.trim());
      setSaveSuccessMsg(true);
      setTimeout(() => setSaveSuccessMsg(false), 3000);
    }
    setShowSaveSceneModal(false);
    setSaveSceneTitle('');
    setSaveSceneDesc('');
  };

  // Batch AI processing state for dialogue lines
  const [isBatchProcessing, setIsBatchProcessing] = useState<boolean>(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(null);

  // Batch AI processing for all dialogue lines at once
  const handleBatchAIProcessDialogueLines = async () => {
    if (dialogueLines.length === 0 || isBatchProcessing) return;
    setIsBatchProcessing(true);
    setBatchProgress({ current: 0, total: dialogueLines.length });

    const context = getFullContext ? getFullContext() : {};
    const apiSettings = getStoredApiSettings();

    const updatedLines = [...dialogueLines];

    for (let i = 0; i < updatedLines.length; i++) {
      const line = updatedLines[i];
      const spk = speakers.find((s) => s.id === line.speakerId) || speakers[0];
      setBatchProgress({ current: i + 1, total: updatedLines.length });

      try {
        const res = await fetch('/api/ai/smart-autofill', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            targetField: `Nội dung câu thoại của nhân vật ${spk?.name || 'Nhân vật'}`,
            currentValue: line.text || '',
            context,
            provider: apiSettings.provider,
            geminiApiKey: apiSettings.geminiApiKey || undefined,
            customApiKey: apiSettings.customApiKey || undefined,
            customEndpoint: apiSettings.customEndpoint || undefined,
          }),
        });

        const data = await res.json();
        if (data.success && data.resultText) {
          updatedLines[i] = { ...updatedLines[i], text: data.resultText };
          setDialogueLines([...updatedLines]);
        }
      } catch (err) {
        console.error(`Lỗi xử lý AI hàng loạt câu ${i + 1}:`, err);
      }
    }

    setIsBatchProcessing(false);
    setBatchProgress(null);
  };

  // Update Speaker properties
  const updateSpeaker = (id: string, field: keyof SpeakerAssignment, value: any) => {
    setSpeakers((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [field]: value } : s))
    );
  };

  // Add new speaker (up to 32)
  const handleAddSpeaker = () => {
    if (speakers.length >= 32) return;
    const nextIndex = speakers.length + 1;
    const unusedVoice =
      GEMINI_VOICES.find((v) => !speakers.some((s) => s.voiceName === v.id)) ||
      GEMINI_VOICES[speakers.length % GEMINI_VOICES.length];

    const newSpeaker: SpeakerAssignment = {
      id: `speaker-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      name: `Nhân vật #${nextIndex}`,
      voiceName: unusedVoice.id,
      style: 'natural',
      audioProfile: '',
      directorsNotes: '',
    };
    setSpeakers((prev) => [...prev, newSpeaker]);
  };

  // Remove speaker (keep minimum 2)
  const handleRemoveSpeaker = (speakerId: string) => {
    if (speakers.length <= 2) {
      alert('Chế độ hội thoại cần giữ tối thiểu 2 nhân vật!');
      return;
    }
    const remaining = speakers.filter((s) => s.id !== speakerId);
    setSpeakers(remaining);

    // Reassign lines belonging to deleted speaker to first remaining speaker
    const fallbackId = remaining[0].id;
    setDialogueLines((prev) =>
      prev.map((l) => (l.speakerId === speakerId ? { ...l, speakerId: fallbackId } : l))
    );
  };

  // Solo a specific speaker (hide all other speakers)
  const handleSoloSpeaker = (targetId: string) => {
    setSpeakers((prev) =>
      prev.map((s) => ({
        ...s,
        isHidden: s.id !== targetId,
      }))
    );
  };

  // Show all speakers (unhide everyone)
  const handleShowAllSpeakers = () => {
    setSpeakers((prev) =>
      prev.map((s) => ({
        ...s,
        isHidden: false,
      }))
    );
  };

  // Add line for specific speaker
  const addLine = (speakerId: string) => {
    const newLineId = `line-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    setDialogueLines((prev) => [
      ...prev,
      {
        id: newLineId,
        speakerId,
        text: '',
        directorsNotes: '',
      },
    ]);
  };

  // Move dialogue line up or down
  const moveLine = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex || toIndex < 0 || toIndex >= dialogueLines.length) return;
    setDialogueLines((prev) => {
      const updated = [...prev];
      const [moved] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, moved);
      return updated;
    });
  };

  // Drag handlers for dialogue lines
  const handleDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.setData('text/plain', index.toString());
    e.dataTransfer.effectAllowed = 'move';
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    const fromIndexStr = e.dataTransfer.getData('text/plain');
    const fromIndex = fromIndexStr ? parseInt(fromIndexStr, 10) : draggedIndex;

    if (fromIndex !== null && !isNaN(fromIndex) && fromIndex !== dropIndex) {
      moveLine(fromIndex, dropIndex);
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  // Update line text
  const updateLineText = (lineId: string, text: string) => {
    setDialogueLines((prev) =>
      prev.map((l) => (l.id === lineId ? { ...l, text } : l))
    );
  };

  // Update line director notes
  const updateLineDirectorsNotes = (lineId: string, directorsNotes: string) => {
    setDialogueLines((prev) =>
      prev.map((l) => (l.id === lineId ? { ...l, directorsNotes } : l))
    );
  };

  // Remove line
  const removeLine = (lineId: string) => {
    setDialogueLines((prev) => prev.filter((l) => l.id !== lineId));
  };

  // Track textarea caret selection
  const handleTextareaSelection = (lineId: string, el: HTMLTextAreaElement) => {
    cursorPositions.current[lineId] = {
      start: el.selectionStart,
      end: el.selectionEnd,
    };
  };

  // Insert tag into specific dialogue line at EXACT cursor position
  const handleInsertTagToLine = (lineId: string, tag: string) => {
    const targetLine = dialogueLines.find((l) => l.id === lineId);
    if (!targetLine) return;

    const el = textareaRefs.current[lineId];
    let start = targetLine.text.length;
    let end = targetLine.text.length;

    if (el) {
      start = el.selectionStart ?? cursorPositions.current[lineId]?.start ?? targetLine.text.length;
      end = el.selectionEnd ?? cursorPositions.current[lineId]?.end ?? targetLine.text.length;
    } else if (cursorPositions.current[lineId]) {
      start = cursorPositions.current[lineId].start;
      end = cursorPositions.current[lineId].end;
    }

    const before = targetLine.text.substring(0, start);
    const after = targetLine.text.substring(end);

    const needsSpaceBefore = before.length > 0 && !before.endsWith(' ');
    const needsSpaceAfter = !after.startsWith(' ');

    const insertedContent = `${needsSpaceBefore ? ' ' : ''}${tag}${needsSpaceAfter ? ' ' : ''}`;
    const newText = `${before}${insertedContent}${after}`;
    const newCursorPos = start + insertedContent.length;

    updateLineText(lineId, newText);

    // Save new cursor position
    cursorPositions.current[lineId] = { start: newCursorPos, end: newCursorPos };

    // Restore focus and selection caret position after state re-render
    setTimeout(() => {
      const activeEl = textareaRefs.current[lineId];
      if (activeEl) {
        activeEl.focus();
        activeEl.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 40);
  };

  // Per-line TTS preview playback
  const handlePlaySingleLine = async (line: DialogueLine) => {
    const spk = speakers.find((s) => s.id === line.speakerId) || speakers[0];
    if (!line.text.trim()) return;

    setDialogueLines((prev) =>
      prev.map((l) => (l.id === line.id ? { ...l, isGenerating: true } : l))
    );

    try {
      const apiSet = getStoredApiSettings();
      const resp = await fetch('/api/tts/generate-line', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          voiceName: spk.voiceName,
          text: line.text,
          directorsNotes: line.directorsNotes,
          geminiApiKey: apiSet.geminiApiKey || undefined,
          ttsModel: apiSet.ttsModel || '3.1',
        }),
      });

      const data = await resp.json();
      if (data.success && data.audioData) {
        const audio = new Audio(data.audioData);
        audio.play().catch((err) => console.warn('Line preview audio play error:', err));
        setDialogueLines((prev) =>
          prev.map((l) =>
            l.id === line.id ? { ...l, audioData: data.audioData, isGenerating: false } : l
          )
        );
      } else {
        alert(data.error || 'Lỗi phát âm thanh câu thoại.');
        setDialogueLines((prev) =>
          prev.map((l) => (l.id === line.id ? { ...l, isGenerating: false } : l))
        );
      }
    } catch (err) {
      console.error(err);
      setDialogueLines((prev) =>
        prev.map((l) => (l.id === line.id ? { ...l, isGenerating: false } : l))
      );
    }
  };

  // Parse raw text formatted like "Nam: Hello\nNữ: Hi"
  const handleParseRawScript = () => {
    if (!rawScriptText.trim()) return;

    const lines = rawScriptText.split('\n').filter((l) => l.trim().length > 0);
    const parsedLines: DialogueLine[] = [];

    lines.forEach((lineStr, index) => {
      const parts = lineStr.split(':');
      if (parts.length >= 2) {
        const speakerNameRaw = parts[0].trim();
        const lineContent = parts.slice(1).join(':').trim();

        let matchedSpeaker = speakers.find(
          (s) => s.name.toLowerCase() === speakerNameRaw.toLowerCase()
        );

        if (!matchedSpeaker) {
          matchedSpeaker = speakers[index % speakers.length];
        }

        parsedLines.push({
          id: `line-parsed-${index}-${Date.now()}`,
          speakerId: matchedSpeaker.id,
          text: lineContent,
        });
      } else {
        const spk = speakers[index % speakers.length];
        parsedLines.push({
          id: `line-parsed-${index}-${Date.now()}`,
          speakerId: spk.id,
          text: lineStr.trim(),
        });
      }
    });

    if (parsedLines.length > 0) {
      setDialogueLines(parsedLines);
      setShowRawParser(false);
      setRawScriptText('');
    }
  };

  return (
    <div className="space-y-4">
      {/* Speaker Configuration Header */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div>
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <Users className="h-4 w-4 text-rose-400" />
              <span>Thiết Lập Kịch Bản Đa Nhân Vật ({speakers.length}/32 Nhân Vật)</span>
            </h3>
            <p className="text-xs text-slate-400">
              Phân bổ giọng đọc, hồ sơ âm thanh & ghi chú đạo diễn riêng cho từng nhân vật (tối đa 32 người)
            </p>
          </div>

          <div className="flex items-center space-x-2 flex-wrap gap-y-2">
            <button
              onClick={() => setIsExcelModalOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-700/60 text-xs font-bold transition flex items-center space-x-1 shadow-sm"
              title="Nhập kịch bản đối đáp từ file Excel (.xlsx / .csv)"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-400" />
              <span>Nhập File Excel</span>
            </button>

            <button
              onClick={() => setShowRawParser(!showRawParser)}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition border border-slate-700 flex items-center space-x-1"
            >
              <MessageSquare className="h-3.5 w-3.5 text-cyan-400" />
              <span>{showRawParser ? 'Ẩn ô dán kịch bản' : 'Dán Kịch Bản Nhanh'}</span>
            </button>

            <button
              onClick={onOpenRefinement}
              className="px-3 py-1.5 rounded-xl bg-indigo-900/60 hover:bg-indigo-800 text-cyan-300 border border-indigo-500/30 text-xs font-semibold transition flex items-center space-x-1"
            >
              <Wand2 className="h-3.5 w-3.5 text-cyan-400" />
              <span>Phân Thoại AI</span>
            </button>

            {onSaveCurrentAsPreset && (
              <button
                onClick={handleOpenSaveSceneModal}
                className="px-3 py-1.5 rounded-xl bg-emerald-900/60 hover:bg-emerald-800 text-emerald-300 border border-emerald-500/30 text-xs font-semibold transition flex items-center space-x-1"
                title="Lưu kịch bản và cấu hình nhân vật thành Cảnh Preset"
              >
                <BookmarkPlus className="h-3.5 w-3.5 text-emerald-400" />
                <span>Lưu Cảnh</span>
              </button>
            )}

            <button
              onClick={handleAddSpeaker}
              disabled={speakers.length >= 32}
              className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white text-xs font-bold transition shadow-md flex items-center space-x-1 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <PlusCircle className="h-3.5 w-3.5 text-white" />
              <span>+ Thêm Nhân Vật</span>
            </button>
          </div>
        </div>

        {/* Gemini Advanced Config (Audio Profile, Scene, Scene Director's Notes) */}
        <GeminiAdvancedConfigPanel
          promptConfig={promptConfig}
          onChangePromptConfig={setPromptConfig}
          getFullContext={getFullContext}
        />

        {/* Raw Parser Box */}
        {showRawParser && (
          <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
            <label className="text-xs font-semibold text-slate-300 block">
              Dán kịch bản đối đáp (Định dạng "Tên nhân vật: Nội dung câu nói"):
            </label>
            <textarea
              rows={4}
              value={rawScriptText}
              onChange={(e) => setRawScriptText(e.target.value)}
              placeholder={`Bác sĩ: [fast] Kết quả xét nghiệm đã có!\nBệnh nhân: [gasping] Liệu có nghiêm trọng không bác sĩ?\nY sĩ: Mọi người hãy bình tĩnh!`}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg p-3 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500 font-mono"
            />
            <div className="flex justify-between items-center">
              <span className="text-[11px] text-slate-500">
                Tự động ghép dòng thoại vào danh sách nhân vật hiện có.
              </span>
              <button
                onClick={handleParseRawScript}
                className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold rounded-lg transition"
              >
                Tự Động Phân Dòng
              </button>
            </div>
          </div>
        )}

        {/* Success Banner when scene saved */}
        {saveSuccessMsg && (
          <div className="p-3 bg-emerald-950/80 border border-emerald-700/80 rounded-xl text-xs text-emerald-200 flex items-center gap-2 animate-fade-in shadow-md">
            <Check className="h-4 w-4 text-emerald-400 shrink-0" />
            <span>Đã lưu thành công cấu hình cảnh và kịch bản vào danh sách Presets!</span>
          </div>
        )}

        {/* Speakers Cards Header & Active Status Banner (Collapsible) */}
        <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800 space-y-2">
          <div
            onClick={() => setIsSpeakersExpanded((prev) => !prev)}
            className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 cursor-pointer select-none"
          >
            <div className="flex items-center space-x-2 text-xs font-bold text-slate-200">
              <Users className="h-4 w-4 text-cyan-400" />
              <span>Danh Sách Nhân Vật Trong Cảnh ({speakers.length})</span>
              <span className="text-[11px] font-normal text-slate-400 hidden sm:inline">
                ({speakers.filter((s) => !s.isHidden).length} tham gia cảnh, {speakers.filter((s) => s.isHidden).length} bỏ qua)
              </span>
            </div>

            <div className="flex items-center space-x-2" onClick={(e) => e.stopPropagation()}>
              {speakers.some((s) => s.isHidden) && (
                <button
                  type="button"
                  onClick={handleShowAllSpeakers}
                  className="text-[10px] font-bold text-amber-300 bg-amber-950/80 hover:bg-amber-900 border border-amber-800/80 px-2.5 py-1 rounded-lg transition flex items-center gap-1 shadow-sm"
                  title="Bật lại tất cả nhân vật trong cảnh"
                >
                  <Eye className="h-3 w-3 text-amber-400" />
                  <span>Bật Tất Cả</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setIsSpeakersExpanded((prev) => !prev)}
                className="text-xs font-bold text-cyan-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3 py-1 rounded-lg transition flex items-center gap-1.5 shadow-sm"
              >
                {isSpeakersExpanded ? (
                  <>
                    <ChevronUp className="h-3.5 w-3.5 text-cyan-400" />
                    <span>Thu Gọn</span>
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-3.5 w-3.5 text-cyan-400" />
                    <span>Mở Rộng</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Compact Chip List when collapsed */}
          {!isSpeakersExpanded && (
            <div className="flex items-center gap-2 overflow-x-auto pt-2 border-t border-slate-800/80 scrollbar-thin">
              <span className="text-[11px] text-slate-500 font-semibold shrink-0">Nhân vật:</span>
              {speakers.map((spk, idx) => {
                const voiceObj = GEMINI_VOICES.find((v) => v.id === spk.voiceName);
                return (
                  <button
                    key={`collapsed-chip-${spk.id}`}
                    type="button"
                    onClick={() => setIsSpeakersExpanded(true)}
                    className={`text-[11px] font-bold px-2.5 py-0.5 rounded-lg border shrink-0 transition flex items-center gap-1 ${
                      spk.isHidden
                        ? 'bg-rose-950/40 text-rose-400 border-rose-900/50 line-through'
                        : 'bg-cyan-950/60 hover:bg-cyan-900/60 text-cyan-300 border-cyan-800/60'
                    }`}
                  >
                    <span>#{idx + 1} {spk.name}</span>
                    <span className="text-[9px] text-slate-400">({voiceObj?.name || spk.voiceName})</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Responsive Grid Speakers List (Mobile 1 column, PC max 4 columns) */}
        {isSpeakersExpanded && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 animate-fade-in">
            {speakers.map((spk, idx) => {
              const voiceObj =
                GEMINI_VOICES.find((v) => v.id === spk.voiceName) ||
                GEMINI_VOICES[idx % GEMINI_VOICES.length];

              const isSoloActive =
                !spk.isHidden && speakers.filter((s) => !s.isHidden).length === 1;

              return (
                <div
                  key={spk.id}
                  className={`p-3 rounded-xl border flex flex-col justify-between gap-2.5 transition shadow-sm ${
                    spk.isHidden
                      ? 'bg-slate-950/50 border-rose-950/80 opacity-60'
                      : 'bg-slate-950/90 border-slate-800 hover:border-slate-700'
                  }`}
              >
                {/* ID Badge + Name Input */}
                <div className="flex items-center space-x-2 min-w-0 w-full">
                  <span
                    className="px-2 py-0.5 rounded-md text-[11px] font-black text-cyan-300 bg-cyan-950 border border-cyan-800 shrink-0"
                    title={`Mã ID nhân vật: #${idx + 1}`}
                  >
                    ID: #{idx + 1}
                  </span>

                  <div className="flex items-center space-x-1 min-w-0 flex-1">
                    <input
                      type="text"
                      value={spk.name}
                      onChange={(e) => updateSpeaker(spk.id, 'name', e.target.value)}
                      placeholder={`Nhân vật #${idx + 1}`}
                      className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-100 focus:outline-none focus:border-cyan-500 w-full truncate"
                    />
                    <AIFieldButton
                      compact
                      iconOnly
                      targetField="speakerName"
                      currentValue={spk.name}
                      onApplyResult={(val) => updateSpeaker(spk.id, 'name', val)}
                      getFullContext={getFullContext}
                    />
                  </div>
                </div>

                {/* Voice Badge / Picker Trigger */}
                <button
                  type="button"
                  onClick={() => setActivePickingSpeakerId(spk.id)}
                  className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold bg-cyan-950/60 hover:bg-cyan-900/60 px-2.5 py-1.5 rounded-lg border border-cyan-800/60 flex items-center justify-between gap-1.5 w-full transition"
                  title="Bấm để chọn giọng đọc Gemini"
                >
                  <div className="flex items-center gap-1.5 min-w-0 truncate">
                    <Volume2 className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
                    <span className="truncate">Giọng: {voiceObj.name}</span>
                  </div>
                  <span className="text-[10px] text-cyan-500 font-bold bg-cyan-950 px-1.5 py-0.5 rounded border border-cyan-800/80 shrink-0">
                    {voiceObj.gender === 'female' ? 'Nữ' : 'Nam'}
                  </span>
                </button>

                {/* Actions Bar */}
                <div className="flex items-center justify-between gap-1 pt-1 border-t border-slate-800/60 shrink-0">
                  <div className="flex items-center space-x-1">
                    {/* Solo Button ("Chỉ hiện nhân vật này") */}
                    <button
                      type="button"
                      onClick={() => handleSoloSpeaker(spk.id)}
                      title="Chỉ hiện nhân vật này trong cảnh (Tự động ẩn tất cả nhân vật khác)"
                      className={`px-2 py-1 rounded-lg border text-[11px] font-bold transition flex items-center space-x-1 ${
                        isSoloActive
                          ? 'bg-amber-950 border-amber-600 text-amber-300 shadow-sm'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-amber-300 hover:bg-slate-800'
                      }`}
                    >
                      <UserCheck className="h-3 w-3 text-amber-400" />
                      <span>Solo</span>
                    </button>

                    {/* Hide / Show Toggle Button */}
                    <button
                      type="button"
                      onClick={() => updateSpeaker(spk.id, 'isHidden', !spk.isHidden)}
                      title={
                        spk.isHidden
                          ? 'Bật lại nhân vật này tham gia cảnh'
                          : 'Ẩn nhân vật này khỏi cảnh'
                      }
                      className={`p-1.5 rounded-lg border text-xs font-semibold transition flex items-center ${
                        spk.isHidden
                          ? 'bg-rose-950/90 border-rose-800 text-rose-300 hover:bg-rose-900'
                          : 'bg-slate-900 border-slate-800 text-emerald-400 hover:bg-slate-800'
                      }`}
                    >
                      {spk.isHidden ? (
                        <EyeOff className="h-3.5 w-3.5 text-rose-400" />
                      ) : (
                        <Eye className="h-3.5 w-3.5 text-emerald-400" />
                      )}
                    </button>
                  </div>

                  <div className="flex items-center space-x-1">
                    {/* Gear Button for full character & Timbre configuration */}
                    <button
                      type="button"
                      onClick={() => setActiveConfigSpeakerId(spk.id)}
                      title="Cài đặt chi tiết (Style, Hồ sơ âm thanh, Âm sắc, Pitch, Speed, Ghi chú đạo diễn...)"
                      className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 hover:text-cyan-300 hover:border-cyan-500/50 transition flex items-center gap-1 text-[11px] font-semibold shadow-sm"
                    >
                      <Settings className="h-3.5 w-3.5 text-cyan-400" />
                      <span>Cài Đặt</span>
                    </button>

                    {/* Remove Speaker Button */}
                    {speakers.length > 2 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveSpeaker(spk.id)}
                        title="Xóa nhân vật này"
                        className="p-1 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        )}

        {/* Dialogue Lines Builder */}
        <div className="space-y-3 pt-2">
          <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="text-xs font-semibold text-slate-300 flex items-center gap-2 mr-2">
                <span>Kịch bản lượt thoại ({dialogueLines.length} câu):</span>
              </h4>
              
              {dialogueLines.length > 0 && (
                <>
                  <button
                    type="button"
                    onClick={handleBatchAIProcessDialogueLines}
                    disabled={isBatchProcessing}
                    className="px-3 py-1.5 rounded-xl bg-cyan-950/90 hover:bg-cyan-900 border border-cyan-600/80 text-cyan-200 text-xs font-bold transition flex items-center space-x-1.5 shadow-md disabled:opacity-50"
                    title="AI tự động xử lý, chèn thẻ âm thanh biểu cảm cho TOÀN BỘ các câu thoại trong kịch bản"
                  >
                    {isBatchProcessing ? (
                      <>
                        <RefreshCw className="h-3.5 w-3.5 animate-spin text-cyan-400" />
                        <span className="hidden sm:inline">AI Đang Xử Lý ({batchProgress?.current}/{batchProgress?.total})...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
                        <span className="hidden sm:inline">AI Xử Lý Hàng Loạt</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleConvertAllToLowercase}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700/80 text-slate-300 text-xs font-bold transition flex items-center space-x-1.5 shadow-sm"
                    title="Chuyển toàn bộ kịch bản thành chữ thường"
                  >
                    <CaseLower className="h-3.5 w-3.5 text-slate-400" />
                    <span className="hidden sm:inline">Văn bản thường</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowClearConfirmModal(true)}
                    className="px-3 py-1.5 rounded-xl bg-rose-950/80 hover:bg-rose-900 border border-rose-800/80 text-rose-300 text-xs font-bold transition flex items-center space-x-1.5 shadow-sm"
                    title="Xóa sạch tất cả các câu thoại trong cảnh"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-rose-400" />
                    <span className="hidden sm:inline">Dọn Dẹp</span>
                  </button>
                </>
              )}
            </div>

            <div className="flex flex-wrap items-start justify-end">
              {/* Quick Add Buttons for All Speakers */}
              <div className="grid grid-cols-4 gap-1.5">
                {speakers.map((spk, spkIdx) => (
                  <button
                    key={spk.id}
                    onClick={() => addLine(spk.id)}
                    className={`px-2 py-1 rounded-lg text-[11px] font-semibold flex items-center justify-center space-x-1 shrink-0 border transition ${
                      spk.isHidden
                        ? 'bg-rose-950/40 border-rose-900/50 text-rose-300/80 hover:bg-rose-950/70'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                    }`}
                  >
                    {spk.isHidden ? <EyeOff className="h-3 w-3 text-rose-400" /> : <Plus className="h-3 w-3 text-cyan-400" />}
                    <span className="truncate max-w-[80px]">[{spkIdx + 1}] {spk.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-3 pr-1">
            {dialogueLines.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500 bg-slate-950 rounded-xl border border-slate-800">
                Chưa có dòng thoại nào. Nhấn các nút "+ Nhân vật" ở trên hoặc dùng "Dán Kịch Bản Nhanh".
              </div>
            ) : (
              dialogueLines.map((line, index) => {
                const currentSpk = speakers.find((s) => s.id === line.speakerId) || speakers[0];
                const isNotesOpen = activeLineNotesId === line.id;
                const isBeingDragged = draggedIndex === index;
                const isDragTarget = dragOverIndex === index && draggedIndex !== index;
                const isSpkHidden = !!currentSpk?.isHidden;

                return (
                  <div
                    key={line.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDrop={(e) => handleDrop(e, index)}
                    onDragEnd={handleDragEnd}
                    className={`p-3.5 bg-slate-950 border rounded-xl space-y-2.5 transition-all duration-150 relative ${
                      isBeingDragged
                        ? 'opacity-40 border-cyan-500 border-dashed bg-slate-900'
                        : isDragTarget
                        ? 'border-cyan-400 bg-cyan-950/30 ring-2 ring-cyan-500/40 scale-[1.01]'
                        : isSpkHidden
                        ? 'border-rose-950/80 bg-slate-950/60 opacity-80'
                        : 'border-slate-800/90 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                        {/* Drag Handle & Up/Down Movement Controls */}
                        <div className="flex items-center space-x-1 bg-slate-900 border border-slate-800 rounded-lg p-0.5">
                          <div
                            className="cursor-grab active:cursor-grabbing p-1 text-slate-500 hover:text-cyan-400 transition"
                            title="Nắm và kéo thả để di chuyển câu thoại"
                          >
                            <GripVertical className="h-4 w-4" />
                          </div>
                          <button
                            type="button"
                            onClick={() => moveLine(index, index - 1)}
                            disabled={index === 0}
                            title="Di chuyển câu thoại lên trước"
                            className="p-1 text-slate-400 hover:text-cyan-300 disabled:opacity-25 disabled:hover:text-slate-400 rounded transition"
                          >
                            <ChevronUp className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveLine(index, index + 1)}
                            disabled={index === dialogueLines.length - 1}
                            title="Di chuyển câu thoại xuống sau"
                            className="p-1 text-slate-400 hover:text-cyan-300 disabled:opacity-25 disabled:hover:text-slate-400 rounded transition"
                          >
                            <ChevronDown className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        <LineNumberInput
                          currentIndex={index}
                          totalLines={dialogueLines.length}
                          onMove={(newIndex) => moveLine(index, newIndex)}
                        />

                        {/* Speaker Selector */}
                        <select
                          value={line.speakerId}
                          onChange={(e) => {
                            const targetId = e.target.value;
                            setDialogueLines((prev) =>
                              prev.map((l) => (l.id === line.id ? { ...l, speakerId: targetId } : l))
                            );
                          }}
                          className={`bg-slate-900 border text-xs font-bold rounded-lg px-2.5 py-1 focus:outline-none focus:border-cyan-500 ${
                            isSpkHidden
                              ? 'border-rose-800/80 text-rose-300'
                              : 'border-slate-800 text-cyan-300'
                          }`}
                        >
                          {speakers.map((s, sIdx) => (
                            <option key={s.id} value={s.id}>
                              [#{sIdx + 1}] {s.name} ({s.voiceName}){s.isHidden ? ' 🚫 [Bỏ qua khỏi cảnh]' : ''}
                            </option>
                          ))}
                        </select>

                        {isSpkHidden && (
                          <span className="text-[10px] font-bold text-rose-300 bg-rose-950/80 border border-rose-800/60 px-2 py-0.5 rounded flex items-center gap-1">
                            <EyeOff className="h-3 w-3 text-rose-400" />
                            <span>Bỏ qua khi phát (Nhân vật đang ẩn)</span>
                          </span>
                        )}

                        <button
                          type="button"
                          onClick={() => handleConvertLineToLowercase(line.id)}
                          className="text-[11px] text-slate-300 bg-slate-800 hover:bg-slate-700 px-2 py-1.5 rounded border border-slate-700 flex items-center gap-1 transition"
                          title="Chuyển câu thoại này thành chữ thường"
                        >
                          <CaseLower className="h-3.5 w-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            setActiveLineTagTargetId(
                              activeLineTagTargetId === line.id ? null : line.id
                            )
                          }
                          className="text-[11px] text-cyan-400 bg-cyan-950/40 hover:bg-cyan-900/50 px-2 py-1.5 rounded border border-cyan-800/40 flex items-center gap-1 transition"
                          title="Thẻ Âm Thanh"
                        >
                          <Sparkles className="h-3.5 w-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => setActiveLineNotesId(isNotesOpen ? null : line.id)}
                          className={`text-[11px] px-2 py-1.5 rounded border flex items-center gap-1 transition ${
                            line.directorsNotes
                              ? 'bg-amber-950/60 text-amber-300 border-amber-800/60'
                              : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                          }`}
                          title={line.directorsNotes ? 'Sửa chỉ đạo' : 'Thêm chỉ đạo thoại'}
                        >
                          <Clapperboard className="h-3.5 w-3.5" />
                        </button>

                        <AIFieldButton
                          compact
                          iconOnly
                          targetField="dialogueLine"
                          currentValue={line.text}
                          onApplyResult={(val) => updateLineText(line.id, val)}
                          getFullContext={getFullContext}
                        />
                      </div>

                      <div className="flex items-center space-x-1.5">
                        {/* Play Single Line TTS */}
                        <button
                          type="button"
                          onClick={() => handlePlaySingleLine(line)}
                          disabled={line.isGenerating || !line.text.trim()}
                          className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-xs text-cyan-300 font-medium transition flex items-center space-x-1 disabled:opacity-40"
                          title="Nghe thử câu thoại"
                        >
                          {line.isGenerating ? (
                            <RefreshCw className="h-4 w-4 animate-spin text-cyan-400" />
                          ) : (
                            <Volume2 className="h-4 w-4 text-cyan-400" />
                          )}
                        </button>

                        {/* Remove Line */}
                        <button
                          onClick={() => removeLine(line.id)}
                          className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition"
                          title="Xóa câu nói"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {/* Audio Tags Quick Bar for Line */}
                    {activeLineTagTargetId === line.id && (
                      <AudioTagsToolbar
                        onInsertTag={(tag) => handleInsertTagToLine(line.id, tag)}
                      />
                    )}

                    {/* Per-line Director's Notes Input */}
                    {isNotesOpen && (
                      <div className="p-2.5 bg-slate-900/90 rounded-lg border border-slate-800 space-y-1">
                        <div className="flex items-center justify-between">
                          <label className="text-[11px] font-semibold text-amber-300 flex items-center gap-1">
                            <Clapperboard className="h-3 w-3 text-amber-400" />
                            <span>Ghi chú Đạo diễn riêng cho câu thoại này:</span>
                          </label>
                          <AIFieldButton
                            compact
                            targetField="lineDirectorsNotes"
                            currentValue={line.directorsNotes || ''}
                            onApplyResult={(val) => updateLineDirectorsNotes(line.id, val)}
                            getFullContext={getFullContext}
                          />
                        </div>
                        <textarea
                          rows={2}
                          value={line.directorsNotes || ''}
                          onChange={(e) => updateLineDirectorsNotes(line.id, e.target.value)}
                          placeholder="Ví dụ: Thì thầm ngập ngừng, thở dài giữa câu, dâng trào cảm xúc..."
                          className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500 placeholder-slate-600 resize-y font-sans"
                        />
                      </div>
                    )}

                    {/* Text Area (at least 2 lines) */}
                    <textarea
                      ref={(el) => {
                        textareaRefs.current[line.id] = el;
                      }}
                      rows={2}
                      value={line.text}
                      onChange={(e) => updateLineText(line.id, e.target.value)}
                      onSelect={(e) => handleTextareaSelection(line.id, e.currentTarget)}
                      onClick={(e) => handleTextareaSelection(line.id, e.currentTarget)}
                      onKeyUp={(e) => handleTextareaSelection(line.id, e.currentTarget)}
                      onBlur={(e) => handleTextareaSelection(line.id, e.currentTarget)}
                      placeholder={`Nội dung câu nói của ${currentSpk.name}...`}
                      className="w-full bg-slate-900 border border-slate-800/80 rounded-lg p-2.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500 font-sans resize-y"
                    />
                  </div>
                );
              })
            )}
          </div>

          {/* Bottom Quick-Add Buttons for Speakers */}
          <div className="p-3 bg-slate-950/90 rounded-xl border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 shadow-sm">
            <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5 shrink-0">
              <PlusCircle className="h-4 w-4 text-cyan-400" />
              <span>Thêm câu thoại ở cuối kịch bản:</span>
            </span>

            <div className="flex items-center space-x-2 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 scrollbar-thin">
              {speakers.map((spk) => (
                <button
                  key={`bottom-add-${spk.id}`}
                  type="button"
                  onClick={() => addLine(spk.id)}
                  className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-100 text-xs font-bold flex items-center space-x-1.5 shrink-0 border border-slate-800 hover:border-cyan-500/50 hover:text-cyan-300 transition shadow-sm"
                >
                  <Plus className="h-3.5 w-3.5 text-cyan-400" />
                  <span>+ {spk.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Generate Button */}
        <div className="pt-2 flex justify-end">
          <button
            onClick={onGenerate}
            disabled={isGenerating || dialogueLines.length === 0}
            className="w-full sm:w-auto px-8 py-3 bg-gradient-to-r from-rose-600 via-purple-600 to-indigo-600 hover:from-rose-500 hover:to-indigo-500 text-white font-bold text-sm rounded-xl transition-all shadow-lg shadow-purple-500/25 flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGenerating ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>Đang xử lý hội thoại đa nhân vật Gemini TTS ({speakers.length} Giọng)...</span>
              </>
            ) : (
              <>
                <Play className="h-4 w-4 fill-current" />
                <span>Tạo Giọng Đa Nhân Vật ({speakers.length} Giọng Độc Lập)</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Save Scene Modal */}
      {showSaveSceneModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <h4 className="font-bold text-sm text-slate-100 flex items-center gap-2">
              <BookmarkPlus className="h-4 w-4 text-emerald-400" />
              <span>Lưu Cấu Hình Hiện Tại Thành Cảnh</span>
            </h4>

            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-300 block">
                    Tên Cảnh / Preset:
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setSaveSceneTitle(getDialogueCharacterSceneName(speakers, dialogueLines))
                    }
                    className="text-[10px] text-cyan-400 hover:text-cyan-300 font-semibold bg-cyan-950/80 hover:bg-cyan-900 px-2 py-0.5 rounded border border-cyan-800/80 transition flex items-center gap-1"
                    title="Đặt tên theo danh sách nhân vật có trong kịch bản"
                  >
                    <Users className="h-3 w-3" />
                    <span>Tự động theo nhân vật</span>
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="Ví dụ: Cảnh thoại: Bác sĩ & Bệnh nhân"
                  value={saveSceneTitle}
                  onChange={(e) => setSaveSceneTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500 font-medium"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Mô tả ngắn (Tùy chọn):
                </label>
                <input
                  type="text"
                  placeholder="Mô tả bối cảnh, cảm xúc hoặc phong cách đọc..."
                  value={saveSceneDesc}
                  onChange={(e) => setSaveSceneDesc(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setShowSaveSceneModal(false)}
                className="px-4 py-2 bg-slate-800 text-slate-300 text-xs font-semibold rounded-xl hover:bg-slate-700 transition"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSaveSceneSubmit}
                disabled={!saveSceneTitle.trim()}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition shadow-lg disabled:opacity-50"
              >
                Lưu Ngay
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Voice Picker Modal for Specific Speaker */}
      {activePickingSpeakerId && (
        <VoicePickerModal
          isOpen={!!activePickingSpeakerId}
          onClose={() => setActivePickingSpeakerId(null)}
          selectedVoiceId={
            speakers.find((s) => s.id === activePickingSpeakerId)?.voiceName || 'Kore'
          }
          onSelectVoice={(v) => {
            updateSpeaker(activePickingSpeakerId, 'voiceName', v.id);
          }}
          title={`Chọn Giọng cho ${
            speakers.find((s) => s.id === activePickingSpeakerId)?.name || 'Nhân vật'
          }`}
        />
      )}

      {/* Detailed Speaker & Timbre Config Modal */}
      {activeConfigSpeakerId && speakers.some((s) => s.id === activeConfigSpeakerId) && (
        <SpeakerConfigModal
          isOpen={!!activeConfigSpeakerId}
          onClose={() => setActiveConfigSpeakerId(null)}
          speaker={
            speakers.find((s) => s.id === activeConfigSpeakerId)!
          }
          speakerIndex={speakers.findIndex((s) => s.id === activeConfigSpeakerId)}
          onSaveSpeaker={(updated) => {
            setSpeakers((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
          }}
          getFullContext={getFullContext}
        />
      )}

      {/* Excel Script Import Modal */}
      <ExcelImportModal
        isOpen={isExcelModalOpen}
        onClose={() => setIsExcelModalOpen(false)}
        speakers={speakers}
        currentDialogueLinesCount={dialogueLines.length}
        onImport={(updatedSpeakers, importedLines, appendMode) => {
          setSpeakers(updatedSpeakers);
          if (appendMode) {
            setDialogueLines((prev) => [...prev, ...importedLines]);
          } else {
            setDialogueLines(importedLines);
          }
        }}
      />

      {/* Clear All Dialogue Lines Confirmation Modal */}
      {showClearConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm p-5 shadow-2xl space-y-4 text-center">
            <div className="h-12 w-12 rounded-full bg-rose-950/80 border border-rose-800/80 text-rose-400 flex items-center justify-center mx-auto shadow-inner">
              <Trash2 className="h-6 w-6" />
            </div>

            <div>
              <h4 className="font-bold text-sm text-slate-100">
                Xác Nhận Dọn Dẹp Kịch Bản?
              </h4>
              <p className="text-xs text-slate-400 mt-1">
                Thao tác này sẽ xóa toàn bộ <span className="font-bold text-rose-400">{dialogueLines.length}</span> lượt lời thoại trong cảnh hiện tại và dọn sạch dữ liệu ô dán kịch bản.
              </p>
            </div>

            <div className="flex items-center justify-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowClearConfirmModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleClearAllDialogueLines}
                className="px-5 py-2 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-bold text-xs rounded-xl transition shadow-lg shadow-rose-500/20"
              >
                Xóa Tất Cả
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
