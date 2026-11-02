const DENOMINATORS: Record<number, [one: string, many: string]> = {
  2: ['medio', 'medios'],
  3: ['tercio', 'tercios'],
  4: ['cuarto', 'cuartos'],
  5: ['quinto', 'quintos'],
  6: ['sexto', 'sextos'],
  7: ['séptimo', 'séptimos'],
  8: ['octavo', 'octavos'],
  9: ['noveno', 'novenos'],
  10: ['décimo', 'décimos'],
  12: ['doceavo', 'doceavos'],
};

const denominatorWord = (den: number, plural: boolean): string => DENOMINATORS[den]?.[plural ? 1 : 0] ?? '';

/** Convierte la pregunta en algo que se lea bien en voz alta. */
export function spokenText(prompt: string): string {
  return prompt
    .replace(/\p{Extended_Pictographic}/gu, ' ')
    .replace(/__\/(\d+)/g, (_m, den: string) => ` espacio en blanco ${denominatorWord(Number(den), true) || `sobre ${den}`} `)
    .replace(/(\d+)\/(\d+)/g, (_m, num: string, den: string) => {
      const word = denominatorWord(Number(den), Number(num) !== 1);
      if (!word) return ` ${num} sobre ${den} `;
      return Number(num) === 1 ? ` un ${word} ` : ` ${num} ${word} `;
    })
    .replace(/÷/g, ' entre ')
    .replace(/\$(\d+(?:\.\d+)?)/g, '$1 dólares')
    .replace(/(\d+)\.(\d+)/g, '$1 punto $2')
    .replace(/f'\(/g, ' f prima de ')
    .replace(/\bf\(/g, ' f de ')
    .replace(/θ/g, ' theta ')
    .replace(/log([₀-₉]+)/g, (_m, n: string) => ` logaritmo base ${[...n].map((c) => '₀₁₂₃₄₅₆₇₈₉'.indexOf(c)).join('')} de `)
    .replace(/\^/g, ' elevado a ')
    .replace(/\)([²³⁴⁵⁶⁷⁸⁹])/g, ') elevado $1')
    .replace(/³/g, ' al cubo ')
    .replace(/⁴/g, ' a la cuarta ')
    .replace(/⁵/g, ' a la quinta ')
    .replace(/⁶/g, ' a la sexta ')
    .replace(/⁷/g, ' a la séptima ')
    .replace(/⁸/g, ' a la octava ')
    .replace(/⁹/g, ' a la novena ')
    .replace(/(\d)\(/g, '$1 por el paréntesis ')
    .replace(/\)\(/g, ' por el paréntesis ')
    .replace(/[()]/g, ' ')
    .replace(/%/g, ' por ciento ')
    .replace(/cm²/g, ' centímetros cuadrados ')
    .replace(/\bcm\b/g, ' centímetros ')
    .replace(/²/g, ' al cuadrado ')
    .replace(/(\d)([xy])\b/g, '$1 $2')
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
