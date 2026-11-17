// Turns a reply written in Markdown into text that sounds right when read aloud, in chunks short
// enough for browser speech engines (some stop after about fifteen seconds of one utterance).
export const SPEECH_CHUNK_MAX = 220;

export function plainSpeech(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, " Code omitted. ")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s*(?:[-*+]|\d+[.)])\s+/gm, "")
    .replace(/^\s*>\s?/gm, "")
    .replace(/[*_~]{1,3}([^*_~\n]+)[*_~]{1,3}/g, "$1")
    .replace(/\|/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function speechChunks(markdown: string, max = SPEECH_CHUNK_MAX): string[] {
  const text = plainSpeech(markdown);
  if (!text) return [];
  const sentences = text.match(/[^.!?]+[.!?]*\s*/g) ?? [text];
  const chunks: string[] = [];
  let current = "";
  const push = () => {
    if (current.trim()) chunks.push(current.trim());
    current = "";
  };
  for (const sentence of sentences) {
    if (sentence.length > max) {
      push();
      // A very long sentence is cut at word boundaries.
      for (const word of sentence.split(/\s+/)) {
        if ((current + " " + word).trim().length > max) push();
        current = (current + " " + word).trim();
      }
      push();
    } else if ((current + sentence).length > max) {
      push();
      current = sentence;
    } else {
      current += sentence;
    }
  }
  push();
  return chunks;
}
