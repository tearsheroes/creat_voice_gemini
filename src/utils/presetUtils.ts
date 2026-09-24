import { SpeakerAssignment, DialogueLine } from '../types';

/**
 * Automatically generates a scene title based on the names of characters in the dialogue script.
 * e.g., "Cảnh thoại: Bác sĩ & Bệnh nhân"
 */
export function getDialogueCharacterSceneName(
  speakers: SpeakerAssignment[] = [],
  dialogueLines: DialogueLine[] = []
): string {
  // 1. Get unique speaker IDs from dialogue lines in order of appearance
  const usedSpeakerIds: string[] = [];
  dialogueLines.forEach((line) => {
    if (line.speakerId && !usedSpeakerIds.includes(line.speakerId)) {
      usedSpeakerIds.push(line.speakerId);
    }
  });

  // 2. Find speaker names
  let names = usedSpeakerIds
    .map((id) => speakers.find((s) => s.id === id)?.name)
    .filter((name): name is string => Boolean(name && name.trim()));

  // 3. Fallback to active non-hidden speakers if no dialogue lines
  if (names.length === 0) {
    const activeSpeakers = speakers.filter((s) => !s.isHidden);
    const targetList = activeSpeakers.length > 0 ? activeSpeakers : speakers;
    names = targetList.map((s) => s.name).filter((n) => n && n.trim());
  }

  if (names.length === 0) return 'Cảnh Kịch Bản Mới';

  if (names.length === 1) return `Cảnh thoại: ${names[0]}`;
  if (names.length === 2) return `Cảnh thoại: ${names[0]} & ${names[1]}`;

  const last = names[names.length - 1];
  const rest = names.slice(0, names.length - 1).join(', ');
  return `Cảnh thoại: ${rest} & ${last}`;
}
