/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from './components/Navbar';
import { MultiSpeakerEditor } from './components/MultiSpeakerEditor';
import { ToneCustomizer } from './components/ToneCustomizer';
import { AudioPlayerVisualizer } from './components/AudioPlayerVisualizer';
import { TextRefinementModal } from './components/TextRefinementModal';
import { ApiSettingsModal } from './components/ApiSettingsModal';
import { ProjectZipModal } from './components/ProjectZipModal';
import { PresetManager } from './components/PresetManager';
import { AudioHistoryList } from './components/AudioHistoryList';
import { AudioSplitterTab } from './components/AudioSplitterTab';
import { PronunciationDictionaryModal } from './components/PronunciationDictionaryModal';
import { getStoredApiSettings, saveApiSettings } from './utils/apiSettingsStorage';
import { FullProjectBackupData } from './utils/zipStorage';
import { safeSavePresets, safeSaveHistory, safeSavePronunciation } from './utils/safeLocalStorage';

import {
  PresetScene,
  AudioTrack,
  AudioToneConfig,
  SpeakerAssignment,
  DialogueLine,
  AudioPromptConfig,
  ApiSettings,
  PronunciationRule,
} from './types';
import { DEFAULT_PRESET_SCENES } from './constants/voicesAndPresets';
import { Volume2, Users, Sparkles, Wand2, Info, FolderArchive } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'create' | 'splitter' | 'presets' | 'history'>('create');
  const mode = 'multi';

  const [promptConfig, setPromptConfig] = useState<AudioPromptConfig>({
    sceneContext: 'Phòng thu studio hiện đại, tĩnh lặng và ấm cúng.',
    directorsNotes: 'Đọc nhịp điệu vừa phải, tự nhiên, nhấn nhá mượt mà.',
  });

  // Multi Speaker State
  const [speakers, setSpeakers] = useState<SpeakerAssignment[]>([
    { id: 'spk-1', name: 'Nhân vật 1', voiceName: 'Puck', style: 'natural', audioProfile: 'Nam MC tự tin, dí dỏm' },
    { id: 'spk-2', name: 'Nhân vật 2', voiceName: 'Kore', style: 'natural', audioProfile: 'Nữ chuyên gia sâu sắc, uyên bác' },
  ]);
  const [dialogueLines, setDialogueLines] = useState<DialogueLine[]>([
    {
      id: 'l1',
      speakerId: 'spk-1',
      text: 'Chào mừng bạn đến với hội thoại 2 giọng đọc Gemini TTS!',
    },
    {
      id: 'l2',
      speakerId: 'spk-2',
      text: 'Cảm ơn anh! Giọng nói đọc tự nhiên và phát âm rất rõ ràng.',
    },
  ]);

  // Audio Tone Controls
  const [toneConfig, setToneConfig] = useState<AudioToneConfig>({
    speed: 1.0,
    pitch: 0,
    bass: 0,
    treble: 0,
    reverb: 0,
  });

  // Current Active Audio Result
  const [activeAudio, setActiveAudio] = useState<{
    url: string;
    title: string;
    speakerNames?: string[];
    createdAt?: number;
  } | null>(null);

  const [isGenerating, setIsGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  // AI Refinement, API Settings & ZIP Backup Modals
  const [isRefineModalOpen, setIsRefineModalOpen] = useState(false);
  const [isApiSettingsOpen, setIsApiSettingsOpen] = useState(false);
  const [isZipModalOpen, setIsZipModalOpen] = useState(false);
  const [isPronunciationModalOpen, setIsPronunciationModalOpen] = useState(false);
  const [apiSettings, setApiSettings] = useState(getStoredApiSettings());

  // Pronunciation Dictionary State
  const [pronunciationDictionary, setPronunciationDictionary] = useState<PronunciationRule[]>(() => {
    try {
      const saved = localStorage.getItem('gemini_voice_pronunciation');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return [];
  });

  useEffect(() => {
    safeSavePronunciation(pronunciationDictionary);
  }, [pronunciationDictionary]);

  // Presets State with LocalStorage
  const [presets, setPresets] = useState<PresetScene[]>(() => {
    try {
      const saved = localStorage.getItem('gemini_voice_presets');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return DEFAULT_PRESET_SCENES;
  });

  useEffect(() => {
    safeSavePresets(presets);
  }, [presets]);

  // Audio History State with LocalStorage
  const [history, setHistory] = useState<AudioTrack[]>(() => {
    try {
      const saved = localStorage.getItem('gemini_voice_history');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return [];
  });

  useEffect(() => {
    safeSaveHistory(history);
  }, [history]);

  const getCurrentProjectData = useCallback((): FullProjectBackupData => {
    return {
      version: '1.0',
      exportDate: new Date().toISOString(),
      apiSettings,
      presets,
      history,
      mode,
      multiSpeakerState: {
        speakers,
        dialogueLines,
        promptConfig,
      },
      toneConfig,
      pronunciationDictionary,
    };
  }, [
    apiSettings,
    presets,
    history,
    mode,
    promptConfig,
    speakers,
    dialogueLines,
    toneConfig,
    pronunciationDictionary,
  ]);

  const handleRestoreProjectData = (imported: FullProjectBackupData) => {
    if (imported.apiSettings) {
      setApiSettings(imported.apiSettings);
      saveApiSettings(imported.apiSettings);
    }
    if (Array.isArray(imported.presets)) {
      setPresets(imported.presets);
      safeSavePresets(imported.presets);
    }
    if (Array.isArray(imported.history)) {
      setHistory(imported.history);
      safeSaveHistory(imported.history);
    }
    if (imported.multiSpeakerState) {
      if (Array.isArray(imported.multiSpeakerState.speakers)) setSpeakers(imported.multiSpeakerState.speakers);
      if (Array.isArray(imported.multiSpeakerState.dialogueLines)) setDialogueLines(imported.multiSpeakerState.dialogueLines);
    }
    if (imported.toneConfig) {
      setToneConfig(imported.toneConfig);
    }
    if (Array.isArray(imported.pronunciationDictionary)) {
      setPronunciationDictionary(imported.pronunciationDictionary);
      safeSavePronunciation(imported.pronunciationDictionary);
    }
  };

  useEffect(() => {
    const handleSettingsChanged = (e: any) => {
      if (e.detail) {
        setApiSettings(e.detail);
      }
    };
    window.addEventListener('gemini_vox_api_settings_changed', handleSettingsChanged);
    return () => {
      window.removeEventListener('gemini_vox_api_settings_changed', handleSettingsChanged);
    };
  }, []);

  const handleChangeTtsModel = (newModel: '3.1' | '2.5') => {
    const updated: ApiSettings = { ...apiSettings, ttsModel: newModel };
    setApiSettings(updated);
    saveApiSettings(updated);
  };

  const handleApplyPronunciationDictionaryToScript = () => {
    if (pronunciationDictionary.length === 0) return;

    setDialogueLines(prev => prev.map(line => {
      let newText = line.text;
      pronunciationDictionary.forEach(rule => {
        if (!rule.original.trim() || !rule.replacement.trim()) return;
        // Escape special regex characters in original
        const escapedOriginal = rule.original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        // Match word boundaries roughly. Using \b can be problematic for unicode, 
        // but we'll try to just do global replace if they want that.
        // Wait, simpler approach: just global, case-insensitive string replace.
        // If they define "AI", it might replace inside "thái" if case insensitive.
        // So let's use regex with word boundary, or at least spacing.
        // In JS, \b works decently for latin chars.
        try {
          const regex = new RegExp(`\\b${escapedOriginal}\\b`, 'gi');
          newText = newText.replace(regex, rule.replacement);
        } catch (e) {
          // Fallback if regex fails for some reason
          newText = newText.split(rule.original).join(rule.replacement);
        }
      });
      return { ...line, text: newText };
    }));
  };

  // Generate TTS Handler
  const handleGenerateTTS = async () => {
    setIsGenerating(true);
    setGenError(null);

    try {
      const payload = {
        mode: 'multi',
        speakers,
        dialogueLines,
        promptConfig,
        geminiApiKey: apiSettings.geminiApiKey || undefined,
        ttsModel: apiSettings.ttsModel || '3.1',
      };

      const res = await fetch('/api/tts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Tạo giọng nói không thành công.');
      }

      const usedSpeakerIds: string[] = [];
      dialogueLines.forEach((line) => {
        if (line.speakerId && !usedSpeakerIds.includes(line.speakerId)) {
          const spk = speakers.find((s) => s.id === line.speakerId);
          if (spk && !spk.isHidden) {
            usedSpeakerIds.push(line.speakerId);
          }
        }
      });

      let activeSpeakerNames = usedSpeakerIds
        .map((id) => speakers.find((s) => s.id === id)?.name)
        .filter((name): name is string => Boolean(name && name.trim()));

      if (activeSpeakerNames.length === 0) {
        activeSpeakerNames = speakers
          .filter((s) => !s.isHidden)
          .map((s) => s.name)
          .filter((name): name is string => Boolean(name && name.trim()));
      }

      const spkTitleStr = activeSpeakerNames.length > 0 ? activeSpeakerNames.join(' & ') : 'Nhân vật';
      const generatedTitle = `Cảnh thoại: ${spkTitleStr}`;
      const createdAt = Date.now();

      setActiveAudio({
        url: data.audioData,
        title: generatedTitle,
        speakerNames: activeSpeakerNames,
        createdAt,
      });

      // Automatically add to history
      const newTrack: AudioTrack = {
        id: `track-${createdAt}`,
        title: generatedTitle,
        mode: 'multi',
        speakerNames: activeSpeakerNames,
        speakerCount: activeSpeakerNames.length,
        duration: 0,
        audioUrl: data.audioData,
        audioFormat: 'wav',
        createdAt,
        textSnippet: dialogueLines[0]?.text.substring(0, 60) || '',
        tags: ['custom'],
      };

      setHistory((prev) => [newTrack, ...prev]);
    } catch (err: any) {
      console.error(err);
      setGenError(err.message || 'Lỗi hệ thống khi gọi Gemini TTS Server.');
    } finally {
      setIsGenerating(false);
    }
  };

  // AI Refinement Text Application
  const handleApplyRefinement = (refinedText: string, refineMode?: string) => {
    const lines = refinedText.split('\n').filter((l) => l.trim());
    const newLines: DialogueLine[] = lines.map((lineStr, idx) => {
      const parts = lineStr.split(':');
      const spkId = idx % 2 === 0 
        ? (speakers[0]?.id || 'speaker-1') 
        : (speakers[1]?.id || speakers[0]?.id || 'speaker-2');
      return {
        id: `line-ai-${idx}-${Date.now()}`,
        speakerId: spkId,
        text: parts.length > 1 ? parts.slice(1).join(':').trim() : lineStr.trim(),
      };
    });
    setDialogueLines(newLines);
  };

  // Load Preset
  const handleLoadPreset = (preset: PresetScene) => {
    setToneConfig((prev) => ({
      ...prev,
      speed: preset.speed || 1.0,
      pitch: preset.pitch || 0,
    }));

    if (preset.promptConfig) setPromptConfig(preset.promptConfig);
    if (preset.speakers) setSpeakers(preset.speakers);
    if (preset.dialogueLines) setDialogueLines(preset.dialogueLines);

    setActiveTab('create');
  };

  // Save Current Setup as Preset
  const handleSaveCurrentAsPreset = (title: string, description: string) => {
    const newPreset: PresetScene = {
      id: `preset-${Date.now()}`,
      title,
      description,
      category: 'CÁ NHÂN',
      mode: 'multi',
      speed: toneConfig.speed,
      pitch: toneConfig.pitch,
      style: 'natural',
      promptConfig,
      speakers,
      dialogueLines,
      createdAt: Date.now(),
    };

    setPresets((prev) => [newPreset, ...prev]);
  };

  const getFullContext = useCallback(() => {
    return {
      mode: 'multi',
      promptConfig,
      speakers,
      dialogueLines,
    };
  }, [promptConfig, speakers, dialogueLines]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-slate-950">
      {/* Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        presetCount={presets.length}
        historyCount={history.length}
        onOpenApiSettings={() => setIsApiSettingsOpen(true)}
        onOpenZipModal={() => setIsZipModalOpen(true)}
        onOpenPronunciation={() => setIsPronunciationModalOpen(true)}
        activeProvider={apiSettings.provider}
        activeTtsModel={apiSettings.ttsModel || '3.1'}
        onChangeTtsModel={handleChangeTtsModel}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {activeTab === 'create' && (
          <>
            {/* Error Notice if any */}
            {genError && (
              <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-rose-300 text-xs flex items-center justify-between">
                <span>{genError}</span>
                <button onClick={() => setGenError(null)} className="font-bold underline">
                  Đóng
                </button>
              </div>
            )}

            {/* Main Studio Editor */}
            <MultiSpeakerEditor
              speakers={speakers}
              setSpeakers={setSpeakers}
              dialogueLines={dialogueLines}
              setDialogueLines={setDialogueLines}
              promptConfig={promptConfig}
              setPromptConfig={setPromptConfig}
              onGenerate={handleGenerateTTS}
              isGenerating={isGenerating}
              onOpenRefinement={() => setIsRefineModalOpen(true)}
              onSaveCurrentAsPreset={handleSaveCurrentAsPreset}
              getFullContext={getFullContext}
            />

            {/* Active Audio Player Visualizer (if generated) */}
            {activeAudio && (
              <AudioPlayerVisualizer
                audioUrl={activeAudio.url}
                title={activeAudio.title}
                speakerNames={activeAudio.speakerNames}
                createdAt={activeAudio.createdAt}
                toneConfig={toneConfig}
              />
            )}
          </>
        )}

        {/* Tab Audio Splitter & Cutter */}
        {activeTab === 'splitter' && (
          <AudioSplitterTab
            history={history}
            activeAudioUrl={activeAudio?.url}
            activeAudioTitle={activeAudio?.title}
          />
        )}

        {/* Tab Presets */}
        {activeTab === 'presets' && (
          <PresetManager
            presets={presets}
            speakers={speakers}
            dialogueLines={dialogueLines}
            onLoadPreset={handleLoadPreset}
            onSaveCurrentAsPreset={handleSaveCurrentAsPreset}
            onDeletePreset={(id) => setPresets((prev) => prev.filter((p) => p.id !== id))}
          />
        )}

        {/* Tab History */}
        {activeTab === 'history' && (
          <AudioHistoryList
            history={history}
            onSelectTrack={(track) => {
              setActiveAudio({
                url: track.audioUrl,
                title: track.title,
                speakerNames: track.speakerNames,
                createdAt: track.createdAt,
              });
              setActiveTab('create');
            }}
            onDeleteTrack={(id) => setHistory((prev) => prev.filter((h) => h.id !== id))}
            onClearHistory={() => setHistory([])}
          />
        )}
      </main>

      {/* AI Text Refinement Modal */}
      <TextRefinementModal
        isOpen={isRefineModalOpen}
        onClose={() => setIsRefineModalOpen(false)}
        originalText={dialogueLines.map((l) => l.text).join('\n')}
        onApplyRefinedText={handleApplyRefinement}
      />

      <PronunciationDictionaryModal
        isOpen={isPronunciationModalOpen}
        onClose={() => setIsPronunciationModalOpen(false)}
        dictionary={pronunciationDictionary}
        onUpdateDictionary={setPronunciationDictionary}
        onApplyToScript={() => {
          handleApplyPronunciationDictionaryToScript();
          setIsPronunciationModalOpen(false);
        }}
      />

      {/* Global API Settings Modal */}
      <ApiSettingsModal
        isOpen={isApiSettingsOpen}
        onClose={() => setIsApiSettingsOpen(false)}
        onSettingsSaved={(newSettings) => setApiSettings(newSettings)}
      />

      {/* Zip Backup & Restore Modal */}
      <ProjectZipModal
        isOpen={isZipModalOpen}
        onClose={() => setIsZipModalOpen(false)}
        getCurrentProjectData={getCurrentProjectData}
        onRestoreProject={handleRestoreProjectData}
        presetCount={presets.length}
        historyCount={history.length}
      />

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/80 py-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Gemini Voice Studio • Chuyển Đổi Giọng Nói AI Chuẩn Cao Cấp</span>
          <span className="flex items-center gap-1 text-slate-400">
            <Info className="h-3.5 w-3.5 text-cyan-400" /> Được hỗ trợ bởi Gemini TTS 3.1 & Gemini 3.6 Flash
          </span>
        </div>
      </footer>
    </div>
  );
}
