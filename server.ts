import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

function pcmToWavBuffer(pcmBuffer: Buffer, sampleRate = 24000, numChannels = 1, bitsPerSample = 16): Buffer {
  // If buffer already starts with RIFF header, return as is
  if (pcmBuffer.length >= 4 && pcmBuffer.toString("utf8", 0, 4) === "RIFF") {
    return pcmBuffer;
  }

  const dataSize = pcmBuffer.length;
  const header = Buffer.alloc(44);

  // RIFF descriptor
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write("WAVE", 8);

  // fmt sub-chunk
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16); // Subchunk1Size
  header.writeUInt16LE(1, 20); // AudioFormat PCM = 1
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * numChannels * (bitsPerSample / 8), 28); // ByteRate
  header.writeUInt16LE(numChannels * (bitsPerSample / 8), 32); // BlockAlign
  header.writeUInt16LE(bitsPerSample, 34);

  // data sub-chunk
  header.write("data", 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcmBuffer]);
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "20mb" }));

  // Initialize Gemini Client
  const getGeminiClient = (overrideApiKey?: string) => {
    const apiKey = (overrideApiKey && overrideApiKey.trim()) || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is missing. Vui lòng cấu hình API Key trong mục API Settings.");
    }
    return new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  };

  // Helper for executing Gemini API calls with exponential backoff retry and model fallbacks
  const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

  const callGeminiWithRetry = async (
    ai: any,
    primaryModel: string,
    params: any,
    fallbackModels: string[] = [],
    maxRetries = 4
  ) => {
    const modelsToTry = [primaryModel, ...fallbackModels];
    let lastError: any = null;

    for (const modelName of modelsToTry) {
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          const response = await ai.models.generateContent({
            ...params,
            model: modelName,
          });
          return response;
        } catch (err: any) {
          lastError = err;
          const errMsg = String(err?.message || err?.status || err || "");
          const isTransient =
            errMsg.includes("503") ||
            errMsg.includes("UNAVAILABLE") ||
            errMsg.includes("high demand") ||
            errMsg.includes("429") ||
            errMsg.includes("RESOURCE_EXHAUSTED") ||
            errMsg.includes("FetchError") ||
            errMsg.includes("overloaded");

          if (isTransient) {
            if (attempt < maxRetries) {
              const waitTime = Math.min(1500 * Math.pow(1.5, attempt - 1), 6000);
              console.log(`[Gemini Retry] Attempt ${attempt}/${maxRetries} for ${modelName} due to transient load. Waiting ${Math.round(waitTime)}ms...`);
              await delay(waitTime);
            } else {
              console.warn(`[Gemini Retry] Model ${modelName} reached max retries (${maxRetries}).`);
            }
          } else {
            throw err;
          }
        }
      }
    }
    throw lastError;
  };

  // Format user-friendly error messages
  const formatApiError = (err: any, fallbackText: string) => {
    const rawMsg = String(err?.message || err?.status || err || "");
    if (rawMsg.includes("503") || rawMsg.includes("UNAVAILABLE") || rawMsg.includes("high demand")) {
      return "Máy chủ Gemini đang quá tải tạm thời (503 Service Unavailable). Hệ thống đã tự động thử lại nhưng chưa thành công, vui lòng bấm thử lại sau vài giây.";
    }
    if (
      rawMsg.includes("429") ||
      rawMsg.includes("RESOURCE_EXHAUSTED") ||
      rawMsg.includes("Quota exceeded") ||
      rawMsg.includes("quota")
    ) {
      return "Đã vượt quá giới hạn lượt tạo âm thanh của API Gemini (429 Rate Limit / Quota Exceeded). Vui lòng thêm Gemini API Key riêng của bạn ở mục Cài đặt (API Settings) hoặc thử lại sau ít phút.";
    }
    if (rawMsg.includes("404") || rawMsg.includes("NOT_FOUND")) {
      return "Mô hình Gemini không tìm thấy hoặc chưa được hỗ trợ trên khu vực hiện tại.";
    }
    return rawMsg || fallbackText;
  };

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", service: "Gemini Voice Studio TTS Server" });
  });

  // TTS Endpoint
  app.post("/api/tts/generate", async (req, res) => {
    try {
      const { mode, voiceName, style, text, speakers, dialogueLines, promptConfig, geminiApiKey } = req.body;

      const primaryModel = "gemini-3.1-flash-tts-preview";
      const fallbackModels: string[] = [];

      const ai = getGeminiClient(geminiApiKey);

      if (mode === "single") {
        if (!text || typeof text !== "string" || !text.trim()) {
          return res.status(400).json({ error: "Văn bản không được để trống." });
        }

        const selectedVoice = voiceName || "Kore";
        
        // Build instruction blocks based on Gemini Speech Generation official docs
        const promptBlocks: string[] = [];

        if (promptConfig?.audioProfile) {
          promptBlocks.push(`Audio Profile: ${promptConfig.audioProfile.trim()}`);
        }

        if (promptConfig?.sceneContext) {
          promptBlocks.push(`Scene Context & Atmosphere: ${promptConfig.sceneContext.trim()}`);
        }

        if (promptConfig?.directorsNotes) {
          promptBlocks.push(`Director's Notes: ${promptConfig.directorsNotes.trim()}`);
        }

        if (style && style !== "natural") {
          const styleMap: Record<string, string> = {
            cheerful: "Style: Speak enthusiastically, warmly, and cheerfully.",
            calm: "Style: Speak calmly, peacefully, and gently.",
            dramatic: "Style: Speak with deep emotion, drama, and intense narrative tone.",
            news: "Style: Speak in a formal, clear, and authoritative broadcast news anchor voice.",
            storytelling: "Style: Speak as an expressive audiobook narrator with rich cadence.",
            authoritative: "Style: Speak clearly, authoritatively, and professionally like a lecture instructor.",
            whisper: "Style: Speak softly and gently in a whispery, cozy tone.",
          };
          if (styleMap[style]) {
            promptBlocks.push(styleMap[style]);
          }
        }

        if (promptConfig?.sampleContext) {
          promptBlocks.push(`Sample Context: ${promptConfig.sampleContext.trim()}`);
        }

        promptBlocks.push(`Transcript: ${text.trim()}`);

        const promptText = promptBlocks.join("\n\n");

        const response = await callGeminiWithRetry(
          ai,
          primaryModel,
          {
            contents: [{ parts: [{ text: promptText }] }],
            config: {
              responseModalities: ["AUDIO"],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: selectedVoice },
                },
              },
            },
          },
          fallbackModels,
          3
        );

        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (!base64Audio) {
          throw new Error("Không nhận được dữ liệu âm thanh từ Gemini TTS API.");
        }

        const rawBuffer = Buffer.from(base64Audio, "base64");
        const wavBuffer = pcmToWavBuffer(rawBuffer);
        const wavBase64 = wavBuffer.toString("base64");

        return res.json({
          success: true,
          audioData: `data:audio/wav;base64,${wavBase64}`,
          rawBase64: wavBase64,
          format: "wav",
          mode: "single",
          voiceName: selectedVoice,
        });
      } else if (mode === "multi") {
        // Multi-speaker dialogue (2 to 6 speakers)
        if (!dialogueLines || !Array.isArray(dialogueLines) || dialogueLines.length === 0) {
          return res.status(400).json({ error: "Kịch bản hội thoại không được để trống." });
        }

        if (!speakers || !Array.isArray(speakers) || speakers.length < 2) {
          return res.status(400).json({ error: "Cần chọn ít nhất 2 nhân vật cho chế độ hội thoại." });
        }

        const promptBlocks: string[] = [];

        if (promptConfig?.sceneContext) {
          promptBlocks.push(`Scene Context: ${promptConfig.sceneContext.trim()}`);
        }
        if (promptConfig?.sceneDirectorsNotes) {
          promptBlocks.push(`Scene Director's Performance Notes: ${promptConfig.sceneDirectorsNotes.trim()}`);
        }
        if (promptConfig?.directorsNotes) {
          promptBlocks.push(`Global Director's Notes: ${promptConfig.directorsNotes.trim()}`);
        }

        // Filter active speakers (not hidden)
        const activeSpeakers = speakers.filter((s: any) => !s.isHidden);
        const effectiveSpeakers = activeSpeakers.length > 0 ? activeSpeakers : speakers;

        // Filter active dialogue lines (excluding lines from hidden speakers)
        const activeDialogueLines = dialogueLines.filter((line: any) => {
          const spk = speakers.find((s: any) => s.id === line.speakerId);
          return !spk || !spk.isHidden;
        });
        const effectiveDialogueLines = activeDialogueLines.length > 0 ? activeDialogueLines : dialogueLines;

        // Add individual speaker audio profiles, director's notes & timbre controls for active speakers
        effectiveSpeakers.forEach((spk: any) => {
          if (spk.audioProfile) {
            promptBlocks.push(`${spk.name} Audio Profile: ${spk.audioProfile}`);
          }
          if (spk.directorsNotes) {
            promptBlocks.push(`${spk.name} Director's Notes: ${spk.directorsNotes}`);
          }
          if (spk.toneConfig) {
            const tc = spk.toneConfig;
            if (tc.speed !== 1 || tc.pitch !== 0 || tc.bass !== 0 || tc.treble !== 0) {
              promptBlocks.push(`${spk.name} Audio Timbre & Pace: Reading speed ${tc.speed}x, pitch ${tc.pitch > 0 ? '+' : ''}${tc.pitch} semitones, bass ${tc.bass}dB, treble ${tc.treble}dB.`);
            }
          }
        });

        // Format prompt as multi-speaker conversation
        const conversationText = effectiveDialogueLines
          .map((line: any) => {
            const spk = effectiveSpeakers.find((s: any) => s.id === line.speakerId) || effectiveSpeakers[0];
            const lineNote = line.directorsNotes ? ` (Note: ${line.directorsNotes})` : '';
            return `${spk.name}${lineNote}: ${line.text}`;
          })
          .join("\n");

        const speakerNames = effectiveSpeakers.map((s: any) => s.name).join(", ");
        promptBlocks.push(`TTS the following multi-speaker conversation among ${speakerNames}:\n${conversationText}`);

        const prompt = promptBlocks.join("\n\n");

        // Gemini API multiSpeakerVoiceConfig strictly mandates EXACTLY 2 enabled voices.
        // Take the first 2 active/effective speakers.
        const primarySpeakers = effectiveSpeakers.slice(0, 2);
        const speakerVoiceConfigs = primarySpeakers.map((s: any) => ({
          speaker: s.name,
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: s.voiceName || "Kore" },
          },
        }));

        // Fallback safety if less than 2
        while (speakerVoiceConfigs.length < 2) {
          speakerVoiceConfigs.push({
            speaker: `Người ${speakerVoiceConfigs.length + 1}`,
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: speakerVoiceConfigs.length === 0 ? "Kore" : "Puck" },
            },
          });
        }

        const response = await callGeminiWithRetry(
          ai,
          primaryModel,
          {
            contents: [{ parts: [{ text: prompt }] }],
            config: {
              responseModalities: ["AUDIO"],
              speechConfig: {
                multiSpeakerVoiceConfig: {
                  speakerVoiceConfigs,
                },
              },
            },
          },
          fallbackModels,
          3
        );

        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (!base64Audio) {
          throw new Error("Không nhận được dữ liệu âm thanh từ Gemini TTS multi-speaker API.");
        }

        const rawBuffer = Buffer.from(base64Audio, "base64");
        const wavBuffer = pcmToWavBuffer(rawBuffer);
        const wavBase64 = wavBuffer.toString("base64");

        return res.json({
          success: true,
          audioData: `data:audio/wav;base64,${wavBase64}`,
          rawBase64: wavBase64,
          format: "wav",
          mode: "multi",
          speakerCount: speakers.length,
        });
      } else {
        return res.status(400).json({ error: "Chế độ không hợp lệ." });
      }
    } catch (err: any) {
      console.error("TTS generation error:", err);
      return res.status(500).json({
        error: formatApiError(err, "Lỗi tạo giọng nói từ Gemini TTS API."),
      });
    }
  });

  // Individual Single Line TTS Endpoint (for per-line audio preview in dialogue)
  app.post("/api/tts/generate-line", async (req, res) => {
    try {
      const { voiceName, text, directorsNotes, geminiApiKey } = req.body;
      if (!text || typeof text !== "string" || !text.trim()) {
        return res.status(400).json({ error: "Nội dung câu thoại trống." });
      }

      const primaryModel = "gemini-3.1-flash-tts-preview";
      const fallbackModels: string[] = [];

      const ai = getGeminiClient(geminiApiKey);
      const selectedVoice = voiceName || "Kore";

      let prompt = text.trim();
      if (directorsNotes && directorsNotes.trim()) {
        prompt = `Director's Note: ${directorsNotes.trim()}\nTranscript: ${prompt}`;
      }

      const response = await callGeminiWithRetry(
        ai,
        primaryModel,
        {
          contents: [{ parts: [{ text: prompt }] }],
          config: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: selectedVoice },
              },
            },
          },
        },
        fallbackModels,
        3
      );

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!base64Audio) {
        throw new Error("Không nhận được âm thanh cho câu thoại.");
      }

      const rawBuffer = Buffer.from(base64Audio, "base64");
      const wavBuffer = pcmToWavBuffer(rawBuffer);
      const wavBase64 = wavBuffer.toString("base64");

      return res.json({
        success: true,
        audioData: `data:audio/wav;base64,${wavBase64}`,
      });
    } catch (err: any) {
      console.error("Single line TTS error:", err);
      return res.status(500).json({ error: formatApiError(err, "Lỗi phát câu thoại.") });
    }
  });

  // Smart Field Assistant (Synchronized AI processing per input field)
  app.post("/api/ai/smart-autofill", async (req, res) => {
    try {
      const { targetField, currentValue, context, provider, customApiKey, customEndpoint, geminiApiKey } = req.body;

      const fieldDescriptions: Record<string, string> = {
        audioProfile: "Hồ sơ âm thanh nhân vật (độ tuổi, tính cách, tông giọng, sắc thái)",
        sceneContext: "Bối cảnh & bầu không khí môi trường (không gian phòng thu, âm thanh nền, cảm xúc cảnh)",
        directorsNotes: "Ghi chú đạo diễn tổng thể (nhịp thở, cách nhả chữ, tốc độ đọc, khoảng dừng)",
        sceneDirectorsNotes: "Ghi chú đạo diễn riêng cho từng cảnh kịch bản (tiết tấu, phong cách dàn dựng, chỉ đạo diễn xuất)",
        sampleContext: "Bối cảnh mẫu khởi đầu tự nhiên trước khi thoại",
        singleText: "Nội dung bài viết / kịch bản đọc chính (có chèn các thẻ âm thanh Gemini như [whispering], [excited], [pause 0.5s] nếu phù hợp)",
        speakerName: "Tên nhân vật hội thoại (tên ngắn gọn, rõ ràng, phù hợp bối cảnh)",
        speakerAudioProfile: "Hồ sơ âm thanh nhân vật riêng (tuổi, giới tính, phong cách phát âm, sắc thái giọng đọc)",
        speakerDirectorsNotes: "Ghi chú đạo diễn riêng cho nhân vật này (tốc độ nói chủ đạo, thái độ, sắc thái nhả chữ)",
        dialogueLine: "Dòng thoại nhân vật trong kịch bản hội thoại (có kèm thẻ biểu cảm [whispering], [sighs], [excited]...)",
        lineDirectorsNotes: "Ghi chú đạo diễn riêng cho câu thoại này (cảm xúc bùng nổ, thì thầm, ngắt giọng)",
      };

      const fieldName = fieldDescriptions[targetField] || targetField;

      const isDialogueOrText = targetField === "dialogueLine" || targetField === "singleText";

      const systemPrompt = `Bạn là đạo diễn âm thanh và chuyên gia biên kịch TTS chuyên nghiệp.
Nhiệm vụ của bạn là viết mới hoặc tinh chỉnh ĐÚNG MỘT Ô NHẬP LIỆU: "${fieldName}".

NGUYÊN TẮC QUAN TRỌNG:
1. ĐỒNG BỘ TUYỆT ĐỐI: Phải ăn khớp hoàn toàn với bối cảnh, nhân vật, thể loại và các thông tin khác đã nhập trong dự án.
2. TỐI ƯU HÓA NỘI DUNG:
   - Nếu ô này ĐÃ CÓ nội dung (${currentValue ? `"${currentValue}"` : "trống"}): Hãy nâng cấp, làm hay hơn, giàu cảm xúc hơn và đồng bộ với toàn bộ dự án.
   - Nếu ô này TRỐNG: Hãy dựa vào các thông tin khác của dự án để tạo nội dung mới xuất sắc, logic và ấn tượng.
${
  isDialogueOrText
    ? `3. QUY TẮC BẮT BUỘC DÀNH RIÊNG CHO CÂU THOẠI:
   - TUYỆT ĐỐI KHÔNG TỰ TẠO RA HẲN MỘT CÂU MỚI HOẶC VIẾT LẠI CÂU.
   - TUYỆT ĐỐI KHÔNG THÊM BẤT KỲ TỪ CÓ NGHĨA MỚI NÀO VÀO CÂU THOẠI (giữ nguyên 100% văn bản gốc).
   - CHỈ ĐƯỢC PHÉP CHÈN CÁC THẺ ÂM THANH (như [laugh], [sigh], [gasp], [whisper], [pause 0.5s], [chuckle], [clears throat], [excited]...) HOẶC CÁC ÂM THANH PHỤ KHÔNG CÓ NGHĨA (như tiếng thở, tiếng cười, "ừm...", "hừm...", "à...", "haiz...", "ồ...").
   - NÓI CHUNG CHỈ THÊM CÁC TIẾNG KHÔNG CÓ NGHĨA CHỨ KHÔNG ĐƯỢC THÊM TỪ VÀO CÂU.`
    : ""
}
4. FORMAT: CHỈ TRẢ VỀ ĐÚNG NỘI DUNG CỦA Ô NÀY. Không thêm tiêu đề, không ghi "Nội dung:", không kèm ngoặc kép hay giải thích.`;

      const promptContextText = `
--- THÔNG TIN HIỆN CÓ TRONG DỰ ÁN ---
Chế độ: ${context?.mode === 'multi' ? 'Hội thoại 2 người' : 'Đơn thoại (1 người)'}
Giọng đọc / Nhân vật: ${context?.voiceName || 'Kore'}
Phong cách phát âm: ${context?.speechStyle || 'Tự nhiên'}
Hồ sơ âm thanh (Audio Profile): ${context?.promptConfig?.audioProfile || 'Chưa thiết lập'}
Cảnh & Bầu không khí (Scene Context): ${context?.promptConfig?.sceneContext || 'Chưa thiết lập'}
Ghi chú Đạo diễn (Director's Notes): ${context?.promptConfig?.directorsNotes || 'Chưa thiết lập'}
Bối cảnh mẫu (Sample Context): ${context?.promptConfig?.sampleContext || 'Chưa thiết lập'}
Nội dung đơn thoại (Single Text): ${context?.singleText || 'Chưa thiết lập'}
Danh sách nhân vật: ${JSON.stringify(context?.speakers || [])}
Đoạn hội thoại hiện tại: ${JSON.stringify(context?.dialogueLines || [])}

--- GIÁ TRỊ HIỆN TẠI CỦA Ô NÀY (${fieldName}) ---
"${currentValue || ''}"

Hãy tạo/tinh chỉnh nội dung cho ô "${fieldName}":
`;

      // Check external custom provider if specified
      if ((provider === "deepseek" || provider === "openrouter" || customEndpoint) && customApiKey && customEndpoint) {
        try {
          const apiRes = await fetch(customEndpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${customApiKey}`,
            },
            body: JSON.stringify({
              model: provider === "deepseek" ? "deepseek-chat" : "google/gemini-2.5-flash",
              messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: promptContextText },
              ],
            }),
          });
          const data = await apiRes.json();
          let resultText = data.choices?.[0]?.message?.content || currentValue;
          resultText = resultText.replace(/^["'«»“](.*)["'«»”]$/s, '$1').trim();
          return res.json({ success: true, resultText });
        } catch (e: any) {
          console.warn("External provider failed for autofill, falling back to Gemini:", e.message);
        }
      }

      const ai = getGeminiClient(geminiApiKey);

      const response = await callGeminiWithRetry(
        ai,
        "gemini-3.6-flash",
        {
          contents: promptContextText,
          config: {
            systemInstruction: systemPrompt,
            temperature: 0.7,
          },
        },
        ["gemini-2.5-flash"],
        3
      );

      let resultText = (response.text || "").trim();
      // Clean leading/trailing quotes if Gemini added them
      resultText = resultText.replace(/^["'«»“](.*)["'«»”]$/s, '$1').trim();

      return res.json({
        success: true,
        resultText: resultText || currentValue,
      });
    } catch (err: any) {
      console.error("Smart autofill error:", err);
      return res.status(500).json({ error: formatApiError(err, "Lỗi xử lý AI cho ô nhập liệu.") });
    }
  });

  // Text Refinement Endpoint (AI helper using Gemini 3.6 Flash / DeepSeek / OpenRouter mode)
  app.post("/api/ai/refine-text", async (req, res) => {
    try {
      const { text, mode, provider, customApiKey, customEndpoint, geminiApiKey } = req.body;

      if (!text || typeof text !== "string") {
        return res.status(400).json({ error: "Văn bản cần tinh chỉnh không được để trống." });
      }

      // If user provided a custom endpoint (DeepSeek / OpenRouter compatible OpenAI-like format)
      if (provider === "deepseek" || provider === "openrouter" || customEndpoint) {
        if (customApiKey && customEndpoint) {
          try {
            const apiRes = await fetch(customEndpoint, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${customApiKey}`,
              },
              body: JSON.stringify({
                model: provider === "deepseek" ? "deepseek-chat" : "google/gemini-2.5-flash",
                messages: [
                  {
                    role: "system",
                    content: `Bạn là chuyên gia tinh chỉnh văn bản cho chuyển đổi giọng nói TTS tiếng Việt. Hãy tối ưu văn bản sao cho đọc trôi chảy, tự nhiên nhất. Chỉ trả về kết quả văn bản đã sửa.`,
                  },
                  { role: "user", content: text },
                ],
              }),
            });
            const data = await apiRes.json();
            const refinedContent = data.choices?.[0]?.message?.content || text;
            return res.json({ success: true, refinedText: refinedContent, provider });
          } catch (e: any) {
            console.warn("External provider failed, falling back to Gemini:", e.message);
          }
        }
      }

      // Default to Gemini 3.6 Flash for high-quality text processing
      const ai = getGeminiClient(geminiApiKey);

      let systemPrompt = `Bạn là biên tập viên âm thanh chuyên nghiệp chuẩn bị kịch bản đọc cho Gemini Text-To-Speech (TTS) tiếng Việt. 

QUY TẮC BẮT BUỘC KHI XỬ LÝ CÂU THOẠI/KỊCH BẢN:
1. TUYỆT ĐỐI KHÔNG TỰ TẠO RA HẲN CÂU MỚI, KHÔNG VIẾT LẠI HOẶC BỊA THÊM CÂU MỚI.
2. TUYỆT ĐỐI KHÔNG THÊM BẤT KỲ TỪ CÓ NGHĨA MỚI NÀO VÀO CÂU THOẠI (giữ nguyên 100% văn bản gốc).
3. CHỈ ĐƯỢC PHÉP CHÈN CÁC THẺ ÂM THANH biểu cảm (như [laugh], [sighs], [gasping], [whispering], [excited], [pause 0.5s], [clears throat], [chuckle]...) HOẶC ÂM THANH PHỤ KHÔNG CÓ NGHĨA (như tiếng cười, tiếng thở, "ừm...", "hừm...", "à...", "haiz...").
4. NÓI CHUNG CHỈ THÊM CÁC TIẾNG KHÔNG CÓ NGHĨA CHỨ KHÔNG ĐƯỢC THÊM TỪ VÀO CÂU.\n\n`;

      if (mode === "prosody") {
        systemPrompt += `Hãy thêm các dấu ngắt nghỉ tự nhiên, ngắt nhịp nhẹ như [pause 0.3s], [pause 0.5s], hoặc nhấn giọng ở các từ quan trọng để khi đọc nghe truyền cảm và tự nhiên hơn.`;
      } else if (mode === "insert_audio_tags") {
        systemPrompt += `Hãy phân tích sắc thái biểu cảm và chèn tự nhiên các thẻ âm thanh (audio tags) như: [whispering], [shouting], [sighs], [gasping], [giggling], [laughing], [clears throat], [excited], [sad], [confident], [fast], [slow], [pause 0.5s] và các từ đi kèm ("à", "ừm"...) vào vị trí phù hợp nhất.`;
      } else if (mode === "speech_smoothing") {
        systemPrompt += `Hãy chuẩn hóa từ ngữ dạng văn viết sang văn nói tiếng Việt tự nhiên, thay từ viết tắt thành chữ nói rõ ràng nhưng không bịa thêm câu mới.`;
      } else if (mode === "auto_dialogue") {
        systemPrompt += `Hãy chuyển đổi văn bản thành kịch bản hội thoại đối đáp. Định dạng nghiêm ngặt mỗi dòng theo cú pháp:
TênNhânVật1: [thẻ_âm_thanh nếu có] Câu nói
TênNhânVật2: [thẻ_âm_thanh nếu có] Câu nói`;
      } else if (mode === "formal_news") {
        systemPrompt += `Hãy tinh chỉnh đoạn văn bản thành kịch bản bản tin phát thanh thời sự trang trọng, dứt khoát với thẻ [confident] và [pause 0.5s].`;
      } else if (mode === "story_dramatic") {
        systemPrompt += `Hãy tinh chỉnh văn bản theo phong cách sách nói kể chuyện kịch tính và chèn thẻ [sighs], [whispering], [slow] hợp lý.`;
      }

      const response = await callGeminiWithRetry(
        ai,
        "gemini-3.6-flash",
        {
          contents: text,
          config: {
            systemInstruction: systemPrompt,
            temperature: 0.7,
          },
        },
        ["gemini-2.5-flash"],
        3
      );

      const refinedText = response.text || text;

      return res.json({
        success: true,
        refinedText: refinedText.trim(),
        provider: provider || "gemini",
      });
    } catch (err: any) {
      console.error("Text refinement error:", err);
      return res.status(500).json({ error: formatApiError(err, "Không thể tinh chỉnh văn bản.") });
    }
  });

  // Vite development middleware
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Gemini Voice Studio Server] Listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
