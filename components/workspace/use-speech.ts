"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  speechErrorMessage,
  speechRecognitionConstructor,
  transcriptFrom,
  type SpeechRecognitionLike,
} from "@/lib/workspace/speech";

// Dictation through the browser's speech recognition. `onTranscript` receives everything heard
// in the current session (finished and in-progress), so the caller replaces its dictated tail
// instead of appending to it.
export function useSpeech(onTranscript: (heard: string) => void) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognition = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    // Only the browser knows whether speech recognition exists, so this is decided after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSupported(speechRecognitionConstructor() !== null);
    return () => recognition.current?.abort();
  }, []);

  const start = useCallback(() => {
    const Recognition = speechRecognitionConstructor();
    if (!Recognition || recognition.current) return;
    setError(null);
    const session = new Recognition();
    session.lang = navigator.language || "en-US";
    session.continuous = true;
    session.interimResults = true;
    session.onresult = (event) => onTranscript(transcriptFrom(event));
    session.onerror = (event) => setError(speechErrorMessage(event.error));
    session.onend = () => {
      recognition.current = null;
      setListening(false);
    };
    recognition.current = session;
    try {
      session.start();
      setListening(true);
    } catch {
      recognition.current = null;
      setError("Voice input could not start. Try again.");
    }
  }, [onTranscript]);

  const stop = useCallback(() => recognition.current?.stop(), []);

  return { supported, listening, error, start, stop };
}
