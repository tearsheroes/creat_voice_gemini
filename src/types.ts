export type VoiceGender = 'male' | 'female';

export interface VoiceOption {
  id: string; // e.g. 'Kore', 'Puck', 'Charon', 'Fenrir', 'Zephyr', 'Aoede', 'Orion', etc.
  name: string;
  gender: VoiceGender;
  description: string;
  bestFor: string;
  sampleText?: string;
  avatarColor: string;
}

export type SpeechStyle = 
  | 'natural'
  | 'cheerful'
  | 'calm'
  | 'dramatic'
  | 'news'
  | 'storytelling'
  | 'authoritative'
  | 'whisper';

export interface AudioTagOption {
  tag: string;
  label: string;
  description: string;
  category: 'emotion' | 'expression' | 'pace' | 'pause';
}

export interface AudioPromptConfig {
  audioProfile?: string;   // Hồ sơ âm thanh nhân vật (độ tuổi, tính cách, bối cảnh)
  sceneContext?: string;   // Bối cảnh & bầu không khí môi trường
  directorsNotes?: string; // Ghi chú của đạo diễn (nhịp thở, giọng điệu, phát âm)
  sceneDirectorsNotes?: string; // Ghi chú đạo diễn riêng cho cảnh kịch bản
  sampleContext?: string;  // Bối cảnh mẫu (khởi đầu tự nhiên)
}

export interface SpeakerAssignment {
  id: string; // e.g. speaker-1
  name: string; // e.g. "Joe" or "Người Dẫn"
  voiceName: string; // e.g. "Kore"
  style: SpeechStyle;
  audioProfile?: string; // Hồ sơ âm thanh nhân vật riêng (tuổi, tính cách, tông giọng)
  directorsNotes?: string; // Ghi chú đạo diễn riêng cho nhân vật này
  toneConfig?: AudioToneConfig; // Tùy chỉnh âm sắc & tốc độ phát riêng cho nhân vật
  isHidden?: boolean; // Ẩn nhân vật khỏi kịch bản khi tạo âm thanh
}

export interface DialogueLine {
  id: string;
  speakerId: string;
  text: string;
  directorsNotes?: string; // Ghi chú riêng cho câu thoại này
  audioData?: string;      // Dữ liệu âm thanh phát riêng cho dòng thoại này (base64)
  isGenerating?: boolean;  // Đang gọi API tạo âm thanh riêng
}

export interface PresetScene {
  id: string;
  title: string;
  description: string;
  category: string;
  mode: 'single' | 'multi';
  voiceName?: string;
  speed: number;
  pitch: number;
  style: SpeechStyle;
  promptConfig?: AudioPromptConfig;
  singleText?: string;
  speakers?: SpeakerAssignment[];
  dialogueLines?: DialogueLine[];
  createdAt: number;
}

export type TtsModelVersion = '3.1' | '2.5';

export interface ApiSettings {
  provider: 'gemini' | 'deepseek' | 'openrouter';
  geminiApiKey?: string;
  customApiKey?: string;
  customEndpoint?: string;
  ttsModel?: TtsModelVersion;
}

export interface RefinementSettings {
  provider: 'gemini' | 'deepseek' | 'openrouter';
  mode: 'prosody' | 'speech_smoothing' | 'auto_dialogue' | 'formal_news' | 'story_dramatic' | 'insert_audio_tags';
  customEndpoint?: string;
  customApiKey?: string;
}

export interface AudioTrack {
  id: string;
  title: string;
  mode: 'single' | 'multi';
  voiceName?: string;
  speakerNames?: string[];
  speakerCount?: number;
  duration: number; // in seconds
  audioUrl: string; // base64 or blob URL
  audioFormat: 'wav' | 'mp3' | 'ogg' | 'aac';
  createdAt: number;
  textSnippet: string;
  tags: string[];
}

export interface AudioToneConfig {
  speed: number; // 0.5 to 2.0
  pitch: number; // -12 to +12 semitones or 0.5 to 1.5 multiplier
  bass: number; // -10 to +10 dB
  treble: number; // -10 to +10 dB
  reverb: number; // 0 to 1 (wet level)
}


export interface PronunciationRule {
  id: string;
  original: string;
  replacement: string;
}
