"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import {
  AlertCircle,
  ArrowDown,
  Check,
  ChevronDown,
  FileText,
  Loader,
  Mic,
  MicOff,
  Paperclip,
  Send,
  Square,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
} from "react";

import { Button } from "@/components/ui/button";
import { iconProps } from "@/components/ui/icons";
import { Kbd } from "@/components/ui/kbd";
import { MessageText } from "@/components/workspace/message-text";
import { NotifyPrompt } from "@/components/workspace/notify-prompt";
import { OutputBar } from "@/components/workspace/output-bar";
import { useSpeech } from "@/components/workspace/use-speech";
import { cn } from "@/lib/utils/cn";
import {
  ATTACHMENT_PROBLEM_TEXT,
  checkAttachment,
  MAX_ATTACHMENT_BYTES,
  MAX_ATTACHMENTS_PER_MESSAGE,
  splitAttachmentMarker,
  withAttachmentMarker,
} from "@/lib/workspace/attachments";
import {
  changedFiles,
  changedPaths,
  describeToolPart,
  friendlyChatError,
  summariseSteps,
  type ToolLine,
} from "@/lib/workspace/chat-lines";
import { notifyDone, shouldOfferNotifications } from "@/lib/workspace/notify";
import { creditsLabel, type OutputInfo, type Rating } from "@/lib/workspace/outputs";
import {
  clearPendingPrompt,
  formatPromptForMode,
  readPendingPrompt,
} from "@/lib/workspace/pending-prompt";
import { appendDictation } from "@/lib/workspace/speech";
import { suggestFollowUps, type SuggestionFile } from "@/lib/workspace/suggestions";

const MAX_CHARS = 8000;
// Room kept for the "Attached: ..." line that is added to a message with files.
const ATTACH_ROOM = 300;

type Part = UIMessage["parts"][number];
type Group =
  | { kind: "text"; index: number; text: string }
  | { kind: "steps"; lines: Array<{ index: number; line: ToolLine }> };

const STARTERS = [
  "A landing page for a coffee shop with a menu and opening hours",
  "A habit tracker with a weekly grid and streak counter",
  "An expense log with a monthly total",
] as const;

// Text parts and consecutive file steps, in the order the assistant produced them.
function groupParts(parts: Part[]): Group[] {
  const out: Group[] = [];
  parts.forEach((part, index) => {
    if (part.type === "text") {
      if (part.text) out.push({ kind: "text", index, text: part.text });
      return;
    }
    const line = describeToolPart(part as Parameters<typeof describeToolPart>[0]);
    if (!line) return;
    const previous = out[out.length - 1];
    if (previous?.kind === "steps") previous.lines.push({ index, line });
    else out.push({ kind: "steps", lines: [{ index, line }] });
  });
  return out;
}

const allLines = (groups: Group[]): ToolLine[] =>
  groups.flatMap((group) => (group.kind === "steps" ? group.lines.map((entry) => entry.line) : []));

function ToolLineRow({ line, animate }: { line: ToolLine; animate: boolean }) {
  const Icon = line.state === "working" ? Loader : line.state === "failed" ? AlertCircle : Check;
  return (
    <li
      className={cn(
        "flex items-start gap-2.5 px-3 py-2 font-mono text-xs leading-5",
        line.state === "failed" ? "text-danger" : "text-muted",
        animate && "chat-in",
      )}
    >
      <Icon
        {...iconProps}
        className={cn(
          "mt-0.5 shrink-0",
          line.state === "working" && "text-accent motion-safe:animate-spin",
          line.state === "done" && "text-success",
        )}
      />
      <span className="min-w-0 [overflow-wrap:anywhere]">{line.text}</span>
    </li>
  );
}

function Steps({
  lines,
  animate,
}: {
  lines: Array<{ index: number; line: ToolLine }>;
  animate: boolean;
}) {
  return (
    <ul
      aria-label="File changes"
      className={cn(
        "ring-line bg-surface divide-hairline divide-y overflow-hidden rounded-lg",
        animate && "chat-in",
      )}
    >
      {lines.map(({ index, line }) => (
        <ToolLineRow key={index} line={line} animate={animate} />
      ))}
    </ul>
  );
}

function UserMessage({ message }: { message: UIMessage }) {
  const raw = message.parts.map((part) => (part.type === "text" ? part.text : "")).join("");
  const { text, paths } = splitAttachmentMarker(raw);
  return (
    <div className="bg-surface-2 ml-auto flex max-w-[88%] flex-col gap-2 rounded-2xl rounded-br-md px-3.5 py-2.5">
      <p className="[overflow-wrap:anywhere] whitespace-pre-wrap">{text}</p>
      {paths.length > 0 ? (
        <ul aria-label="Attached files" className="flex flex-wrap gap-1.5">
          {paths.map((path) => (
            <li
              key={path}
              className="ring-line bg-surface text-muted flex max-w-full items-center gap-1.5 rounded-md px-2 py-1 text-xs"
            >
              <FileText {...iconProps} size={14} className="shrink-0" />
              <span className="min-w-0 truncate" title={path}>
                {path.slice("attachments/".length)}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

// A finished reply is shown as a preview: the closing message, one line saying what changed, and
// the actions. "Details" opens everything that happened along the way. While the reply is still
// being written the whole transcript streams in so progress is visible.
function AssistantMessage({
  message,
  live,
  animate,
  info,
  onRate,
  onOpenFile,
  onOpenPreview,
}: {
  message: UIMessage;
  live: boolean;
  animate: boolean;
  info: OutputInfo | undefined;
  onRate: (rating: Rating | null) => void;
  onOpenFile: ((path: string) => void) | undefined;
  onOpenPreview: (() => void) | undefined;
}) {
  const [open, setOpen] = useState(false);
  const groups = useMemo(() => groupParts(message.parts), [message.parts]);
  const lastIndex = message.parts.length - 1;

  if (live) {
    return (
      <div className="flex min-w-0 flex-col gap-3">
        {groups.map((group) =>
          group.kind === "text" ? (
            <MessageText
              key={group.index}
              text={group.text}
              streaming={group.index === lastIndex}
              animate={animate}
            />
          ) : (
            <Steps key={`steps-${group.lines[0]?.index}`} lines={group.lines} animate={animate} />
          ),
        )}
      </div>
    );
  }

  const lines = allLines(groups);
  const texts = groups.filter((group) => group.kind === "text");
  const final = texts[texts.length - 1];
  const earlier = groups.filter((group) => group !== final);
  const summary = summariseSteps(lines);
  const changed = changedPaths(lines);
  const hasDetails = lines.length > 0 || earlier.length > 0 || Boolean(info?.usage);
  const copyText = texts.map((group) => (group.kind === "text" ? group.text : "")).join("\n\n");
  const detailsId = `details-${message.id}`;

  return (
    <div className="flex min-w-0 flex-col gap-3">
      {final && final.kind === "text" ? <MessageText text={final.text} animate={animate} /> : null}

      {hasDetails ? (
        <div className="ring-line bg-surface overflow-hidden rounded-lg">
          <button
            type="button"
            aria-expanded={open}
            aria-controls={detailsId}
            onClick={() => setOpen((value) => !value)}
            className="press hover:bg-surface-2 flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-xs"
          >
            <span className="text-muted min-w-0 [overflow-wrap:anywhere]">
              {summary || "Looked through the project"}
            </span>
            <span className="text-text flex shrink-0 items-center gap-1 font-medium">
              Details
              <ChevronDown
                {...iconProps}
                size={14}
                className={cn("transition-transform duration-200 ease-out", open && "rotate-180")}
              />
            </span>
          </button>
          {open ? (
            <div
              id={detailsId}
              className="chat-in border-hairline flex flex-col gap-3 border-t p-3"
            >
              {earlier.map((group) =>
                group.kind === "text" ? (
                  <div key={group.index} className="text-muted text-[13px] leading-5">
                    <MessageText text={group.text} />
                  </div>
                ) : (
                  <Steps
                    key={`steps-${group.lines[0]?.index}`}
                    lines={group.lines}
                    animate={false}
                  />
                ),
              )}
              {changed.length > 0 && onOpenFile ? (
                <div>
                  <p className="text-subtle mb-1.5 text-xs font-medium">Open a changed file</p>
                  <ul className="flex flex-wrap gap-1.5">
                    {changed.map((path) => (
                      <li key={path}>
                        <button
                          type="button"
                          onClick={() => onOpenFile(path)}
                          title={path}
                          className="press ring-line bg-surface hover:bg-surface-2 text-muted hover:text-text max-w-[16rem] truncate rounded-md px-2 py-1 font-mono text-xs"
                        >
                          {path}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <div className="flex flex-wrap items-center justify-between gap-2">
                {info?.usage ? (
                  <p className="text-muted text-xs tabular-nums">
                    {creditsLabel(info.usage.credits)} ·{" "}
                    {info.usage.inputTokens.toLocaleString("en")} tokens in ·{" "}
                    {info.usage.outputTokens.toLocaleString("en")} out
                  </p>
                ) : (
                  <p className="text-muted text-xs">Credits were not recorded for this reply.</p>
                )}
                {onOpenPreview && changed.length > 0 ? (
                  <Button variant="secondary" size="sm" onClick={onOpenPreview}>
                    View preview
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {copyText ? <OutputBar text={copyText} info={info} onRate={onRate} /> : null}
    </div>
  );
}

function Thinking() {
  return (
    <li className="text-muted flex items-center gap-2 text-xs" role="status">
      <span className="flex items-center gap-1" aria-hidden="true">
        <span className="thinking-dot" />
        <span className="thinking-dot" />
        <span className="thinking-dot" />
      </span>
      Working
    </li>
  );
}

interface Attachment {
  name: string;
  content: string;
  bytes: number;
}

function readText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(new Error("read failed"));
    reader.readAsText(file);
  });
}

async function errorMessageFrom(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: { message?: unknown } };
    if (typeof body.error?.message === "string") return body.error.message.slice(0, 200);
  } catch {
    // Not JSON.
  }
  return "The files could not be attached. Try again.";
}

export function ChatPanel({
  projectId,
  initialMessages,
  initialOutputs = {},
  projectFiles = [],
  canUseAssistant,
  hasCredits,
  onFilesChanged,
  onFinished,
  onOpenFile,
  onOpenPreview,
  onBusyChange,
}: {
  projectId: string;
  initialMessages: UIMessage[];
  initialOutputs?: Record<string, OutputInfo>;
  projectFiles?: SuggestionFile[];
  canUseAssistant: boolean;
  hasCredits: boolean;
  onFilesChanged: () => void;
  onFinished: () => void;
  onOpenFile?: (path: string) => void;
  onOpenPreview?: () => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [offerNotify, setOfferNotify] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [attachError, setAttachError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [outputs, setOutputs] = useState<Record<string, OutputInfo>>(initialOutputs);
  const log = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const [away, setAway] = useState(false);
  const field = useRef<HTMLTextAreaElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  // Only what arrives after the panel opened animates; the history that was already there
  // does not replay.
  const [knownMessages] = useState(initialMessages.length);
  const notifiedTools = useRef(new Set<string>());

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        // Only the newest message goes to the server; history is loaded there from the database.
        prepareSendMessagesRequest: ({ messages }) => {
          const last = messages[messages.length - 1];
          const text = (last?.parts ?? [])
            .map((part) => (part.type === "text" ? part.text : ""))
            .join("");
          return {
            body: { id: projectId, message: { role: "user", parts: [{ type: "text", text }] } },
          };
        },
      }),
    [projectId],
  );

  // What each reply cost and how the person rated it. Read after a turn finishes, and again a
  // moment later because the charge is settled just after the stream closes.
  const refreshOutputs = useCallback(async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/outputs`, { cache: "no-store" });
      if (!response.ok) return;
      const data = (await response.json()) as { outputs?: Record<string, OutputInfo> };
      if (data.outputs) setOutputs((current) => ({ ...current, ...data.outputs }));
    } catch {
      // The next refresh will catch up; the reply itself is already shown.
    }
  }, [projectId]);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (settleTimer.current) clearTimeout(settleTimer.current);
    },
    [],
  );

  const { messages, sendMessage, status, stop } = useChat({
    id: projectId,
    messages: initialMessages,
    transport,
    onError: (chatError) => {
      setError(friendlyChatError(chatError));
      notifyDone("error");
    },
    onFinish: () => {
      notifyDone("done");
      onFinished();
      void refreshOutputs();
      if (settleTimer.current) clearTimeout(settleTimer.current);
      settleTimer.current = setTimeout(() => void refreshOutputs(), 2500);
    },
  });

  const busy = status === "submitted" || status === "streaming";
  const enabled = canUseAssistant && hasCredits;

  useEffect(() => {
    onBusyChange?.(busy);
  }, [busy, onBusyChange]);

  // Show the dots whenever work is under way but no text is streaming and no file step is
  // running: between sending and the first token, and between one tool call and the next.
  const lastMessage = messages[messages.length - 1];
  const lastPart = lastMessage?.parts[lastMessage.parts.length - 1];
  const lastLine =
    lastPart && lastPart.type.startsWith("tool-")
      ? describeToolPart(lastPart as Parameters<typeof describeToolPart>[0])
      : null;
  const thinking =
    status === "submitted" ||
    (status === "streaming" &&
      lastMessage?.role === "assistant" &&
      !(lastPart?.type === "text" && lastPart.text !== "") &&
      lastLine?.state !== "working");

  // A prompt typed on the home page before signing in is sent once, only into the project it
  // was saved for, and only when the assistant can actually run. Otherwise it stays in the box
  // so the person can send it themselves once they have confirmed their email or topped up.
  const autoSent = useRef(false);
  useEffect(() => {
    if (autoSent.current) return;
    const pending = readPendingPrompt();
    if (!pending || pending.projectId !== projectId) return;
    autoSent.current = true;
    if (enabled && initialMessages.length === 0) {
      const sendPending = async () => {
        let text = formatPromptForMode(pending.text, pending.mode);
        if (pending.attachments?.length) {
          setUploading(true);
          try {
            const response = await fetch(`/api/projects/${projectId}/files`, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ files: pending.attachments }),
            });
            if (!response.ok) {
              setInput(text);
              setAttachments(
                pending.attachments.map((file) => ({
                  ...file,
                  bytes: new TextEncoder().encode(file.content).length,
                })),
              );
              setAttachError(await errorMessageFrom(response));
              return;
            }
            const data = (await response.json()) as { paths?: string[] };
            if (!data.paths || data.paths.length !== pending.attachments.length) {
              setInput(text);
              setAttachments(
                pending.attachments.map((file) => ({
                  ...file,
                  bytes: new TextEncoder().encode(file.content).length,
                })),
              );
              setAttachError("The files were not attached. Try again.");
              return;
            }
            text = withAttachmentMarker(text, data.paths);
            onFilesChanged();
          } catch {
            setInput(text);
            setAttachments(
              pending.attachments.map((file) => ({
                ...file,
                bytes: new TextEncoder().encode(file.content).length,
              })),
            );
            setAttachError("The files could not be attached. Check your connection and try again.");
            return;
          } finally {
            setUploading(false);
          }
        }
        clearPendingPrompt();
        stick.current = true;
        void sendMessage({ text });
        if (shouldOfferNotifications()) setOfferNotify(true);
      };
      void sendPending();
    } else {
      clearPendingPrompt();
      setInput(formatPromptForMode(pending.text, pending.mode));
      setAttachments(
        (pending.attachments ?? []).map((file) => ({
          ...file,
          bytes: new TextEncoder().encode(file.content).length,
        })),
      );
    }
  }, [enabled, initialMessages.length, onFilesChanged, projectId, sendMessage]);

  // Refresh the file tree as soon as each file-changing tool call completes.
  useEffect(() => {
    let changed = false;
    for (const message of messages) {
      for (const part of message.parts) {
        if (!part.type.startsWith("tool-")) continue;
        const id = `${message.id}:${(part as { toolCallId?: string }).toolCallId ?? ""}`;
        if (
          changedFiles(part as Parameters<typeof changedFiles>[0]) &&
          !notifiedTools.current.has(id)
        ) {
          notifiedTools.current.add(id);
          changed = true;
        }
      }
    }
    if (changed) onFilesChanged();
  }, [messages, onFilesChanged]);

  useEffect(() => {
    const element = log.current;
    if (element && stick.current) element.scrollTop = element.scrollHeight;
  }, [messages, status]);

  const jumpToLatest = () => {
    const element = log.current;
    if (!element) return;
    stick.current = true;
    setAway(false);
    element.scrollTo({ top: element.scrollHeight, behavior: "smooth" });
  };

  // Voice: what is heard replaces the dictated tail of the box, so partial words settle in place
  // and anything typed before or after is kept.
  const dictationBase = useRef("");
  const onHeard = useCallback((heard: string) => {
    setInput(appendDictation(dictationBase.current, heard));
  }, []);
  const speech = useSpeech(onHeard);
  const toggleVoice = () => {
    if (speech.listening) {
      speech.stop();
      return;
    }
    dictationBase.current = input;
    speech.start();
    field.current?.focus();
  };

  const addFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (picked.length === 0) return;
    setAttachError(null);
    const next = [...attachments];
    for (const file of picked) {
      if (next.length >= MAX_ATTACHMENTS_PER_MESSAGE) {
        setAttachError(ATTACHMENT_PROBLEM_TEXT.too_many);
        break;
      }
      if (file.size > MAX_ATTACHMENT_BYTES) {
        setAttachError(`${file.name}: ${ATTACHMENT_PROBLEM_TEXT.too_large}`);
        continue;
      }
      try {
        const content = await readText(file);
        const checked = checkAttachment(file.name, content);
        if (!checked.ok) {
          setAttachError(`${file.name}: ${ATTACHMENT_PROBLEM_TEXT[checked.problem]}`);
          continue;
        }
        next.push({ name: file.name, content, bytes: file.size });
      } catch {
        setAttachError(`${file.name}: it could not be read.`);
      }
    }
    setAttachments(next);
  };

  const submit = async (event?: FormEvent) => {
    event?.preventDefault();
    const typed = input.trim();
    if ((!typed && attachments.length === 0) || busy || uploading || !enabled) return;
    if (speech.listening) speech.stop();
    setError(null);
    setAttachError(null);

    let text = typed || "Use the attached files.";
    if (attachments.length > 0) {
      setUploading(true);
      try {
        const response = await fetch(`/api/projects/${projectId}/files`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            files: attachments.map(({ name, content }) => ({ name, content })),
          }),
        });
        if (!response.ok) {
          setAttachError(await errorMessageFrom(response));
          return;
        }
        const data = (await response.json()) as { paths?: string[] };
        text = withAttachmentMarker(text, data.paths ?? []);
        onFilesChanged();
      } catch {
        setAttachError("The files could not be attached. Check your connection and try again.");
        return;
      } finally {
        setUploading(false);
      }
    }

    setInput("");
    setAttachments([]);
    clearPendingPrompt();
    stick.current = true;
    void sendMessage({ text });
    if (shouldOfferNotifications()) setOfferNotify(true);
  };

  // Stops the local stream at once and also tells the server, which otherwise keeps the model
  // running (and billing) after the browser lets go. A failed request is ignored: the reply has
  // already stopped on screen and the server's own limits still apply.
  const stopReply = () => {
    void stop();
    void fetch(`/api/projects/${projectId}/chat/stop`, { method: "POST" }).catch(() => undefined);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      void submit();
    }
  };

  const rate = async (messageId: string, next: Rating | null) => {
    const previous = outputs[messageId]?.rating ?? null;
    setOutputs((current) => ({
      ...current,
      [messageId]: { usage: current[messageId]?.usage ?? null, rating: next },
    }));
    try {
      const response = await fetch(`/api/projects/${projectId}/messages/${messageId}/feedback`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ rating: next ?? "none" }),
      });
      if (!response.ok) throw new Error("rating failed");
    } catch {
      setOutputs((current) => ({
        ...current,
        [messageId]: { usage: current[messageId]?.usage ?? null, rating: previous },
      }));
      setError("Your rating could not be saved. Try again.");
    }
  };

  const assistantReplies = messages.filter((message) => message.role === "assistant").length;
  const suggestions = useMemo(
    () => suggestFollowUps(projectFiles, assistantReplies),
    [projectFiles, assistantReplies],
  );
  const showSuggestions =
    enabled && !busy && input === "" && lastMessage?.role === "assistant" && suggestions.length > 0;

  const placeholder = !canUseAssistant
    ? "Confirm your email address to use the assistant"
    : !hasCredits
      ? "You are out of credits"
      : "Describe what to build";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="relative flex min-h-0 flex-1 flex-col">
        <div
          ref={log}
          role="log"
          aria-label="Conversation"
          aria-live="polite"
          onScroll={(event) => {
            const el = event.currentTarget;
            const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
            stick.current = atBottom;
            setAway((current) => (current === !atBottom ? current : !atBottom));
          }}
          className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-4 py-5"
        >
          {messages.length === 0 ? (
            <div className="chat-in flex flex-col gap-4 text-[13px]">
              <div>
                <p className="text-text text-sm font-medium">What should we build?</p>
                <p className="text-muted mt-1 leading-5">
                  Describe it in plain words, or dictate it. You can attach notes or data too. The
                  assistant creates and edits the files in this project, and the preview updates as
                  it works.
                </p>
              </div>
              {enabled ? (
                <ul className="flex flex-col gap-2" aria-label="Starting points">
                  {STARTERS.map((suggestion) => (
                    <li key={suggestion}>
                      <button
                        type="button"
                        onClick={() => {
                          setInput(suggestion);
                          field.current?.focus();
                        }}
                        className="press ring-line bg-surface text-muted hover:text-text hover:bg-surface-2 w-full rounded-lg px-3 py-2 text-left leading-5"
                      >
                        {suggestion}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : (
            <ol className="flex flex-col gap-6">
              {messages.map((message, index) => {
                const animate = index >= knownMessages;
                const live = busy && index === messages.length - 1 && message.role === "assistant";
                return (
                  <li
                    key={message.id}
                    className={cn("min-w-0 text-sm leading-6", animate && "chat-in")}
                  >
                    <p
                      className={cn(
                        "text-subtle mb-1.5 text-xs leading-4 font-medium",
                        message.role === "user" && "sr-only",
                      )}
                    >
                      {message.role === "user" ? "You" : "Buildr"}
                    </p>
                    {message.role === "user" ? (
                      <UserMessage message={message} />
                    ) : (
                      <AssistantMessage
                        message={message}
                        live={live}
                        animate={animate}
                        info={outputs[message.id]}
                        onRate={(next) => void rate(message.id, next)}
                        onOpenFile={onOpenFile}
                        onOpenPreview={onOpenPreview}
                      />
                    )}
                  </li>
                );
              })}
              {thinking ? <Thinking /> : null}
            </ol>
          )}
        </div>

        {away ? (
          <button
            type="button"
            onClick={jumpToLatest}
            className="press ring-line bg-surface text-muted hover:text-text chat-in absolute bottom-3 left-1/2 flex h-8 -translate-x-1/2 items-center gap-1.5 rounded-full px-3 text-xs shadow-md"
          >
            <ArrowDown {...iconProps} />
            Latest
          </button>
        ) : null}
      </div>

      {!hasCredits && canUseAssistant ? (
        <p
          role="status"
          className="border-hairline bg-accent-subtle border-t px-4 py-2 text-[13px]"
        >
          You are out of credits, so the assistant is paused. Your projects and files are still
          available.
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="border-danger bg-danger-subtle border-t px-4 py-2 text-[13px]">
          {error}
        </p>
      ) : null}

      {showSuggestions ? (
        <ul aria-label="Suggested next steps" className="flex flex-wrap gap-1.5 px-3 pt-2">
          {suggestions.map((suggestion) => (
            <li key={suggestion} className="chat-in">
              <button
                type="button"
                onClick={() => {
                  setInput(suggestion);
                  field.current?.focus();
                }}
                className="press ring-line bg-surface text-muted hover:text-text hover:bg-surface-2 rounded-full px-3 py-1 text-left text-xs leading-5"
              >
                {suggestion}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <form onSubmit={(event) => void submit(event)} className="p-3">
        <div className="border-input bg-surface transition-ui ring-line-focus rounded-xl border">
          {attachments.length > 0 ? (
            <ul aria-label="Files to attach" className="flex flex-wrap gap-1.5 px-3 pt-3">
              {attachments.map((attachment) => (
                <li
                  key={attachment.name}
                  className="chat-in ring-line bg-surface-2 flex max-w-full items-center gap-1.5 rounded-md py-1 pr-1 pl-2 text-xs"
                >
                  <FileText {...iconProps} size={14} className="text-muted shrink-0" />
                  <span className="min-w-0 truncate" title={attachment.name}>
                    {attachment.name}
                  </span>
                  <span className="text-subtle shrink-0 tabular-nums">
                    {Math.max(1, Math.round(attachment.bytes / 1024))} KB
                  </span>
                  <button
                    type="button"
                    aria-label={`Remove ${attachment.name}`}
                    onClick={() =>
                      setAttachments((current) => current.filter((item) => item !== attachment))
                    }
                    className="press text-muted hover:text-text hover:bg-surface flex size-5 shrink-0 items-center justify-center rounded"
                  >
                    <X {...iconProps} size={14} />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <label htmlFor="chat-input" className="sr-only">
            Message
          </label>
          <textarea
            ref={field}
            id="chat-input"
            rows={2}
            maxLength={MAX_CHARS - ATTACH_ROOM}
            value={input}
            disabled={!enabled}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder={speech.listening ? "Listening" : placeholder}
            className="placeholder:text-subtle field-sizing-content max-h-48 min-h-14 w-full resize-none bg-transparent px-3.5 pt-3 pb-1 text-sm leading-6 focus-visible:outline-none disabled:opacity-60"
          />
          <div className="flex items-center justify-between gap-2 px-2 pb-2.5">
            <div className="flex min-w-0 items-center gap-0.5">
              <input
                ref={picker}
                type="file"
                multiple
                tabIndex={-1}
                aria-hidden="true"
                className="hidden"
                accept=".txt,.md,.csv,.json,.css,.html,.ts,.tsx,.js,.jsx,.svg,.xml,.yaml,.yml,.log,text/*"
                onChange={(event) => void addFiles(event)}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Attach files"
                title={`Attach up to ${MAX_ATTACHMENTS_PER_MESSAGE} text files, ${MAX_ATTACHMENT_BYTES / 1024} KB each`}
                disabled={!enabled || busy || attachments.length >= MAX_ATTACHMENTS_PER_MESSAGE}
                onClick={() => picker.current?.click()}
              >
                <Paperclip {...iconProps} />
              </Button>
              {speech.supported ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={speech.listening ? "Stop voice input" : "Start voice input"}
                  aria-pressed={speech.listening}
                  title="Dictate with your browser's speech recognition"
                  disabled={!enabled || busy}
                  onClick={toggleVoice}
                  className={cn(speech.listening && "bg-danger-subtle text-danger")}
                >
                  {speech.listening ? <MicOff {...iconProps} /> : <Mic {...iconProps} />}
                </Button>
              ) : null}
              <p className="text-muted ml-1 hidden truncate text-xs sm:block">
                <Kbd>Ctrl</Kbd> <Kbd>Enter</Kbd> to send
              </p>
            </div>
            {busy ? (
              <Button type="button" variant="secondary" size="sm" onClick={stopReply}>
                <Square {...iconProps} />
                Stop
              </Button>
            ) : (
              <Button
                type="submit"
                size="sm"
                loading={uploading}
                disabled={!enabled || (input.trim().length === 0 && attachments.length === 0)}
              >
                <Send {...iconProps} />
                Send
              </Button>
            )}
          </div>
        </div>
        <div aria-live="polite" className="text-xs">
          {speech.listening ? (
            <p className="text-muted mt-2">
              Listening. Your browser turns speech into text and may use its own online service to
              do it. Nothing is recorded here.
            </p>
          ) : null}
          {speech.error ? <p className="text-danger mt-2">{speech.error}</p> : null}
          {attachError ? (
            <p role="alert" className="text-danger mt-2">
              {attachError}
            </p>
          ) : null}
        </div>
      </form>
      <NotifyPrompt open={offerNotify} onClose={() => setOfferNotify(false)} />
    </div>
  );
}
