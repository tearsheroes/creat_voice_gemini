import JSZip from 'jszip';
import {
  ApiSettings,
  PresetScene,
  AudioTrack,
  SpeakerAssignment,
  DialogueLine,
  SpeechStyle,
  AudioPromptConfig,
  AudioToneConfig,
} from '../types';

export interface FullProjectBackupData {
  version: string;
  exportDate: string;
  apiSettings: ApiSettings;
  presets: PresetScene[];
  history: AudioTrack[];
  mode: 'single' | 'multi';
  selectedTagId?: string | null;
  singleSpeakerState?: {
    singleText: string;
    voiceName: string;
    speechStyle: SpeechStyle;
    promptConfig: AudioPromptConfig;
  };
  multiSpeakerState: {
    speakers: SpeakerAssignment[];
    dialogueLines: DialogueLine[];
    promptConfig: AudioPromptConfig;
  };
  toneConfig: AudioToneConfig;
  pronunciationDictionary?: import('../types').PronunciationRule[];
}

// Convert data URL (base64) to Uint8Array & MIME info
function dataURLToUint8Array(dataUrl: string): { data: Uint8Array; mime: string; ext: string } {
  const parts = dataUrl.split(',');
  const mimeMatch = parts[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'audio/wav';
  const binary = atob(parts[1]);
  const array = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    array[i] = binary.charCodeAt(i);
  }
  let ext = 'wav';
  if (mime.includes('mp3')) ext = 'mp3';
  else if (mime.includes('ogg')) ext = 'ogg';
  else if (mime.includes('aac')) ext = 'aac';
  return { data: array, mime, ext };
}

// Convert ArrayBuffer to Data URL
function bufferToDataURL(buffer: ArrayBuffer, mimeType: string = 'audio/wav'): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);
  return `data:${mimeType};base64,${base64}`;
}

export async function exportProjectToZip(data: FullProjectBackupData): Promise<Blob> {
  const zip = new JSZip();
  const audioFolder = zip.folder('audio');

  // Clone history and dialogue lines to avoid mutating original state
  const historyExport = JSON.parse(JSON.stringify(data.history || [])) as AudioTrack[];
  const dialogueLinesExport = JSON.parse(
    JSON.stringify(data.multiSpeakerState?.dialogueLines || [])
  ) as DialogueLine[];

  // Process history audio files
  for (let i = 0; i < historyExport.length; i++) {
    const track = historyExport[i];
    if (track.audioUrl && track.audioUrl.startsWith('data:audio/')) {
      try {
        const { data: bin, ext } = dataURLToUint8Array(track.audioUrl);
        const fileName = `track_${track.id || i}.${ext}`;
        if (audioFolder) {
          audioFolder.file(fileName, bin);
        }
        track.audioUrl = `zip://audio/${fileName}`;
      } catch (e) {
        console.warn('Could not compress history track audio:', e);
      }
    }
  }

  // Process dialogue lines audio files
  for (let i = 0; i < dialogueLinesExport.length; i++) {
    const line = dialogueLinesExport[i];
    if (line.audioData && line.audioData.startsWith('data:audio/')) {
      try {
        const { data: bin, ext } = dataURLToUint8Array(line.audioData);
        const fileName = `dialogue_${line.id || i}.${ext}`;
        if (audioFolder) {
          audioFolder.file(fileName, bin);
        }
        line.audioData = `zip://audio/${fileName}`;
      } catch (e) {
        console.warn('Could not compress line audio:', e);
      }
    }
  }

  const jsonContent = JSON.stringify(
    {
      ...data,
      history: historyExport,
      multiSpeakerState: {
        ...data.multiSpeakerState,
        dialogueLines: dialogueLinesExport,
      },
    },
    null,
    2
  );

  zip.file('project.json', jsonContent);

  return await zip.generateAsync({ type: 'blob' });
}

export async function importProjectFromZip(file: File): Promise<FullProjectBackupData> {
  const zip = await JSZip.loadAsync(file);

  const projectJsonFile = zip.file('project.json');
  if (!projectJsonFile) {
    throw new Error('Tệp ZIP không hợp lệ hoặc thiếu file project.json cấu hình dự án.');
  }

  const projectJsonText = await projectJsonFile.async('string');
  const backupData: FullProjectBackupData = JSON.parse(projectJsonText);

  // Restore history audio files
  if (Array.isArray(backupData.history)) {
    for (const track of backupData.history) {
      if (track.audioUrl && track.audioUrl.startsWith('zip://audio/')) {
        const relativePath = track.audioUrl.replace('zip://', '');
        const audioFileInZip = zip.file(relativePath);
        if (audioFileInZip) {
          const buffer = await audioFileInZip.async('arraybuffer');
          let mime = 'audio/wav';
          if (relativePath.endsWith('.mp3')) mime = 'audio/mp3';
          if (relativePath.endsWith('.ogg')) mime = 'audio/ogg';
          if (relativePath.endsWith('.aac')) mime = 'audio/aac';
          track.audioUrl = bufferToDataURL(buffer, mime);
        }
      }
    }
  }

  // Restore dialogue lines audio files
  if (backupData.multiSpeakerState && Array.isArray(backupData.multiSpeakerState.dialogueLines)) {
    for (const line of backupData.multiSpeakerState.dialogueLines) {
      if (line.audioData && line.audioData.startsWith('zip://audio/')) {
        const relativePath = line.audioData.replace('zip://', '');
        const audioFileInZip = zip.file(relativePath);
        if (audioFileInZip) {
          const buffer = await audioFileInZip.async('arraybuffer');
          let mime = 'audio/wav';
          if (relativePath.endsWith('.mp3')) mime = 'audio/mp3';
          if (relativePath.endsWith('.ogg')) mime = 'audio/ogg';
          if (relativePath.endsWith('.aac')) mime = 'audio/aac';
          line.audioData = bufferToDataURL(buffer, mime);
        }
      }
    }
  }

  return backupData;
}

export function triggerFileDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
