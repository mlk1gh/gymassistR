import { useState, useRef, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetChatHistory,
  useSendChatMessage,
  useClearChatHistory,
  getGetChatHistoryQueryKey,
} from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Send, Trash2, Mic, MicOff, Bot, User, Zap } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export default function ChatPage() {
  const qc = useQueryClient();
  const history = useGetChatHistory();
  const sendMutation = useSendChatMessage();
  const clearMutation = useClearChatHistory();

  const [input, setInput] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const messages = history.data ?? [];

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, sendMutation.isPending]);

  const sendMessage = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setInput("");
    sendMutation.mutate(
      { data: { message: trimmed } },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getGetChatHistoryQueryKey() });
        },
        onError: () => toast({ title: "Failed to send message", variant: "destructive" }),
      }
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const handleClear = () => {
    clearMutation.mutate(undefined, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetChatHistoryQueryKey() });
        toast({ title: "Chat history cleared" });
      },
      onError: () => toast({ title: "Failed to clear history", variant: "destructive" }),
    });
  };

  const toggleRecording = async () => {
    if (isRecording && mediaRecorder) {
      mediaRecorder.stop();
      setIsRecording(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];

      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: "audio/webm" });
        const reader = new FileReader();
        reader.onloadend = () => {
          if (inputRef.current) {
            inputRef.current.focus();
          }
          toast({ title: "Voice recording captured", description: "Type your message or record again." });
        };
        reader.readAsDataURL(blob);
        setMediaRecorder(null);
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
    } catch {
      toast({ title: "Microphone access denied", variant: "destructive" });
    }
  };

  const isPending = sendMutation.isPending;

  return (
    <AppLayout>
      <div className="flex flex-col h-[calc(100vh-8rem)] md:h-[calc(100vh-4rem)] max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-4 shrink-0">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">AI Coach</h1>
            <p className="text-muted-foreground text-sm mt-1 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-primary" />
              Knows your workouts & health data — can create plans and log metrics for you
            </p>
          </div>
          {messages.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="gap-2 text-muted-foreground hover:text-destructive"
              onClick={handleClear}
              disabled={clearMutation.isPending}
              data-testid="clear-chat-btn"
            >
              <Trash2 className="w-4 h-4" /> Clear
            </Button>
          )}
        </div>

        <Card className="flex-1 flex flex-col bg-card border-border overflow-hidden">
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
            {history.isLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className={`h-12 animate-pulse bg-secondary rounded-xl max-w-sm ${i % 2 === 1 ? "ml-auto" : ""}`} />
                ))}
              </div>
            ) : messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center gap-3 text-center py-12">
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                  <Bot className="w-7 h-7 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">GymAssist Coach</p>
                  <p className="text-muted-foreground text-sm mt-1 max-w-sm">
                    I have access to your workouts, health metrics, and exercise library. I can create plans, log data, and give advice tailored to you.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-3 w-full max-w-sm">
                  {[
                    { label: "Show my workout plans", icon: "📋" },
                    { label: "Create a push day for me", icon: "💪" },
                    { label: "Log my weight: 75 kg", icon: "⚖️" },
                    { label: "What exercises are in my plans?", icon: "🏋️" },
                    { label: "How am I tracking this week?", icon: "📈" },
                    { label: "Suggest chest exercises to add", icon: "🎯" },
                  ].map((q) => (
                    <button
                      key={q.label}
                      onClick={() => sendMessage(q.label)}
                      className="text-xs px-3 py-2.5 rounded-xl border border-border text-left text-muted-foreground hover:text-foreground hover:border-primary/50 hover:bg-primary/5 transition-colors flex items-center gap-1.5"
                      data-testid={`suggestion-${q.label.toLowerCase().replace(/\s+/g, "-")}`}
                    >
                      <span>{q.icon}</span>
                      <span>{q.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={cn("flex gap-2", msg.role === "user" ? "flex-row-reverse" : "flex-row")}
                    data-testid={`message-${msg.id}`}
                  >
                    <div className={cn(
                      "w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5",
                      msg.role === "user" ? "bg-primary/20" : "bg-secondary"
                    )}>
                      {msg.role === "user"
                        ? <User className="w-3.5 h-3.5 text-primary" />
                        : <Bot className="w-3.5 h-3.5 text-muted-foreground" />
                      }
                    </div>
                    <div className={cn("max-w-[75%]", msg.role === "user" ? "items-end" : "items-start", "flex flex-col gap-1")}>
                      <div className={cn(
                        "px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap",
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground rounded-tr-sm"
                          : "bg-secondary text-foreground rounded-tl-sm"
                      )}>
                        {msg.content}
                      </div>
                      <span className="text-xs text-muted-foreground px-1">
                        {format(new Date(msg.createdAt), "h:mm a")}
                      </span>
                    </div>
                  </div>
                ))}
                {isPending && (
                  <div className="flex gap-2 flex-row">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 bg-secondary mt-0.5">
                      <Bot className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                    <div className="px-4 py-3 bg-secondary rounded-2xl rounded-tl-sm">
                      <div className="flex gap-1 items-center">
                        <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce [animation-delay:0ms]" />
                        <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce [animation-delay:150ms]" />
                        <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce [animation-delay:300ms]" />
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="shrink-0 p-3 border-t border-border">
            <div className="flex gap-2">
              <button
                onClick={toggleRecording}
                className={cn(
                  "shrink-0 w-9 h-9 rounded-lg flex items-center justify-center transition-colors",
                  isRecording
                    ? "bg-destructive text-destructive-foreground animate-pulse"
                    : "bg-secondary text-muted-foreground hover:text-foreground"
                )}
                data-testid="voice-btn"
                title={isRecording ? "Stop recording" : "Start voice input"}
              >
                {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask your coach anything..."
                className="flex-1"
                disabled={isPending}
                data-testid="chat-input"
              />
              <Button
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || isPending}
                size="icon"
                className="shrink-0"
                data-testid="send-btn"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
            {isRecording && (
              <p className="text-xs text-destructive mt-1.5 text-center animate-pulse">Recording... click the mic to stop</p>
            )}
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}
