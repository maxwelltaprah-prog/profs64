// Voice input uses the browser's own speech recognition (Web Speech API). Nothing is recorded or
// uploaded by this app: the browser turns speech into text, and some browsers do that on their
// vendor's servers, which is why the button says so. Where the browser has no speech recognition
// (Firefox, some in-app browsers) the button is not shown.

interface SpeechAlternative {
  transcript: string;
}
interface SpeechResult {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechAlternative | undefined;
}
export interface SpeechResultEvent {
  resultIndex: number;
  results: { length: number; item(index: number): SpeechResult | undefined };
}
export interface SpeechErrorEvent {
  error: string;
}

export interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechResultEvent) => void) | null;
  onerror: ((event: SpeechErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

export function speechRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const scope = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition ?? null;
}

// Joins the finished and in-progress pieces of one recognition session into plain text.
export function transcriptFrom(event: SpeechResultEvent): string {
  let text = "";
  for (let index = 0; index < event.results.length; index += 1) {
    const piece = event.results.item(index)?.[0]?.transcript;
    if (piece) text += piece;
  }
  return text.trim();
}

export function speechErrorMessage(code: string): string | null {
  switch (code) {
    case "not-allowed":
    case "service-not-allowed":
      return "Microphone access is blocked. Allow it for this site in your browser settings.";
    case "audio-capture":
      return "No microphone was found.";
    case "network":
      return "The browser's speech service could not be reached.";
    case "no-speech":
    case "aborted":
      return null;
    default:
      return "Voice input stopped unexpectedly. Try again.";
  }
}

// Adds dictated text to what is already in the box, with one space between them.
export function appendDictation(base: string, dictated: string): string {
  if (!dictated) return base;
  if (!base) return dictated;
  return /\s$/.test(base) ? `${base}${dictated}` : `${base} ${dictated}`;
}
