/** Convierte la pregunta en algo que se lea bien en voz alta. */
export function spokenText(prompt: string): string {
  return prompt
    .replace(/\p{Extended_Pictographic}/gu, ' ')
    .replace(/\+/g, ' más ')
    .replace(/−/g, ' menos ')
    .replace(/×/g, ' por ')
    .replace(/=/g, ' es igual a ')
    .replace(/__/g, ' espacio en blanco ')
    .replace(/\?(?=\s*=)/g, ' qué número ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function canSpeak(): boolean {
  return typeof globalThis.speechSynthesis !== 'undefined' && typeof SpeechSynthesisUtterance !== 'undefined';
}

export function speak(text: string): void {
  if (!canSpeak()) return;
  const synth = globalThis.speechSynthesis;
  synth.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'es-ES';
  utterance.rate = 0.9;
  synth.speak(utterance);
}

export function stopSpeaking(): void {
  if (canSpeak()) globalThis.speechSynthesis.cancel();
}
