"use client";

import { useState, useRef } from "react";
import { Navbar } from "@/components/Navbar";
import { VideoInputCard } from "@/components/VideoInputCard";
import { AnalyzeButton } from "@/components/AnalyzeButton";
import { MetricsTable } from "@/components/MetricsTable";
import { ChatPanel } from "@/components/ChatPanel";
import { LoadingOverlay } from "@/components/LoadingOverlay";
import { EmptyState } from "@/components/EmptyState";
import { ErrorBanner } from "@/components/ErrorBanner";
import { ApiError, ingestVideos, buildChatUrl } from "@/lib/api";
import { formatDuration } from "@/lib/format";
import { openChatStream } from "@/lib/sse";
import type { VideoMetadata } from "@/lib/types";

type VideoData = VideoMetadata;

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export default function Home() {
  const [urlA, setUrlA] = useState("");
  const [urlB, setUrlB] = useState("");
  const [videoA, setVideoA] = useState<VideoData | null>(null);
  const [videoB, setVideoB] = useState<VideoData | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [ingesting, setIngesting] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [streamEnabled, setStreamEnabled] = useState(true);
  const [ingestError, setIngestError] = useState<string | null>(null);
  const [threadId] = useState(() => crypto.randomUUID());

  const closeStreamRef = useRef<(() => void) | null>(null);

  // Ingest handler — calls POST /api/ingest
  const handleIngest = async () => {
    if (!urlA.trim() || !urlB.trim()) return;
    setIngesting(true);
    setIngestError(null);
    setVideoA(null);
    setVideoB(null);
    setMessages([]);
    try {
      const res = await ingestVideos(urlA, urlB);
      setVideoA(res.video_a);
      setVideoB(res.video_b);
    } catch (e) {
      setIngestError(
        e instanceof ApiError
          ? `${e.status}: ${e.detail}`
          : (e as Error).message
      );
    } finally {
      setIngesting(false);
    }
  };

  // Chat handler — connects to GET /api/chat stream
  const handleSend = (question: string) => {
    if (!videoA || !videoB || !question.trim() || chatLoading) return;

    const userMsg: Message = {
      role: "user",
      content: question,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    const assistantMsg: Message = {
      role: "assistant",
      content: "",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setChatLoading(true);

    const url = buildChatUrl({
      threadId,
      videoAId: videoA.video_id,
      videoBId: videoB.video_id,
      question,
    });

    const stream = openChatStream(url);
    closeStreamRef.current = () => stream.close();

    let buffer = "";

    stream.on("token", (tok) => {
      if (streamEnabled) {
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last && last.role === "assistant") {
            next[next.length - 1] = {
              ...last,
              content: last.content + tok,
            };
          }
          return next;
        });
      } else {
        buffer += tok;
      }
    });

    stream.on("done", () => {
      if (!streamEnabled) {
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last && last.role === "assistant") {
            next[next.length - 1] = {
              ...last,
              content: buffer,
            };
          }
          return next;
        });
      }
      setChatLoading(false);
    });

    stream.on("fail", (err) => {
      setMessages((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last && last.role === "assistant") {
          next[next.length - 1] = {
            ...last,
            content: last.content || `[error] ${err.message}`,
          };
        }
        return next;
      });
      setChatLoading(false);
    });
  };

  // Citation click handler — seek to timestamp
  const handleCitationClick = (videoLabel: "A" | "B", seconds: number) => {
    console.log("seek", videoLabel, seconds);

    // Find any embedded iframe matching the target video and send seek commands
    const iframes = document.querySelectorAll("iframe");
    const targetVideo = videoLabel === "A" ? videoA : videoB;
    
    if (targetVideo) {
      iframes.forEach((iframe) => {
        if (iframe.src.includes(targetVideo.video_id)) {
          iframe.contentWindow?.postMessage(
            JSON.stringify({ event: "command", func: "seekTo", args: [seconds, true] }),
            "*"
          );
          iframe.contentWindow?.postMessage(
            JSON.stringify({ event: "command", func: "playVideo", args: [] }),
            "*"
          );
        }
      });
    }
  };

  // Clear chat handler
  const handleClear = () => {
    closeStreamRef.current?.();
    setMessages([]);
    setChatLoading(false);
  };

  // Reset analysis handler
  const handleNewAnalysis = () => {
    closeStreamRef.current?.();
    setVideoA(null);
    setVideoB(null);
    setUrlA("");
    setUrlB("");
    setMessages([]);
    setChatLoading(false);
    setIngestError(null);
  };

  const mapVideoMetadata = (v: VideoData | null) => {
    if (!v) return undefined;
    return {
      title: v.title,
      channel: v.channel_name,
      verified: (v.follower_count ?? 0) > 100000,
      date: v.upload_date ?? "",
      duration: formatDuration(v.duration_seconds),
      thumbnail: v.thumbnail_url ?? "",
      views: v.view_count,
      likes: v.like_count,
      comments: v.comment_count,
      subscribers: v.follower_count ?? 0,
      engagementRate: v.engagement_rate,
    };
  };

  const hasVideos = !!videoA && !!videoB;

  return (
    <>
      <LoadingOverlay visible={ingesting} />

      <div className="min-h-screen bg-[#F5F5F7] dark:bg-[#0a0a0f] text-gray-900 dark:text-[#F9FAFB] flex flex-col transition-colors duration-200">
        {/* Top Navbar */}
        <Navbar
          onNewAnalysis={handleNewAnalysis}
          onExport={() => alert("Report exported successfully!")}
        />

        {/* Main content grid */}
        <main className="flex-1 flex flex-col md:flex-row gap-0 overflow-hidden">
          
          {/* Left Column (Video Inputs + Comparison Metrics) */}
          <aside className="w-full md:w-[28%] md:min-w-[340px] md:max-w-[440px] flex-shrink-0 border-r border-gray-200 dark:border-white/8 flex flex-col p-5 gap-4 overflow-y-auto bg-[#EEEEEF] dark:bg-[#0D0D14] justify-between h-auto md:h-[calc(100vh-3.5rem)] transition-colors duration-200">
            <div className="space-y-4">
              {/* Header Label */}
              <div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-gray-500 dark:text-[#6B7280] font-mono">
                  VIDEO INPUTS
                </div>
              </div>

              {/* Error Alert if ingestion fails */}
              {ingestError && (
                <ErrorBanner
                  message={ingestError}
                  onDismiss={() => setIngestError(null)}
                />
              )}

              {/* Video Card A */}
              <VideoInputCard
                label="A"
                value={urlA}
                onChange={setUrlA}
                onSubmit={handleIngest}
                loading={ingesting}
                video={mapVideoMetadata(videoA)}
              />

              {/* Video Card B */}
              <VideoInputCard
                label="B"
                value={urlB}
                onChange={setUrlB}
                onSubmit={handleIngest}
                loading={ingesting}
                video={mapVideoMetadata(videoB)}
              />

              {/* Metrics Table */}
              {hasVideos && (
                <MetricsTable
                  videoA={{
                    views: videoA.view_count,
                    likes: videoA.like_count,
                    comments: videoA.comment_count,
                    engagementRate: videoA.engagement_rate,
                  }}
                  videoB={{
                    views: videoB.view_count,
                    likes: videoB.like_count,
                    comments: videoB.comment_count,
                    engagementRate: videoB.engagement_rate,
                  }}
                />
              )}
            </div>

            {/* Analyze CTA button (always visible) */}
            <div className="pt-6">
              <AnalyzeButton
                disabled={!urlA.trim() || !urlB.trim()}
                loading={ingesting}
                onClick={handleIngest}
              />
            </div>
          </aside>

          {/* Right Column (Empty State OR Active Chat Panel) */}
          <section className="flex-1 flex flex-col p-5 bg-white dark:bg-[#0A0A0F] h-auto md:h-[calc(100vh-3.5rem)] transition-colors duration-200">
            {!hasVideos ? (
              <div className="flex-1 flex flex-col items-center justify-center border border-gray-200 dark:border-white/5 border-dashed rounded-xl p-8 bg-white dark:bg-[#12121c]/30">
                <EmptyState />
              </div>
            ) : (
              <ChatPanel
                messages={messages}
                loading={chatLoading}
                streamEnabled={streamEnabled}
                onStreamToggle={setStreamEnabled}
                onSend={handleSend}
                onCitationClick={handleCitationClick}
                onClear={handleClear}
                disabled={chatLoading}
              />
            )}
          </section>

        </main>
      </div>
    </>
  );
}
