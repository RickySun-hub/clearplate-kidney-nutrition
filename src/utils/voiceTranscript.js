// Conversation turns already retain their text. Unknown recipe input has no such history.
export function transcriptAfterInterpretation({ recipe, intent, recognized, audio, existing }) {
  if (!recipe || intent !== 'unknown') return '';
  if (!audio) return existing;
  return [existing, recognized].filter(text => typeof text === 'string' && text.trim()).join('\n');
}
