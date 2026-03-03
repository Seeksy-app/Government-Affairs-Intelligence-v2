import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Play, MonitorPlay, Mail, Lock } from "lucide-react";
import { Link } from "wouter";
import type { DemoVideo } from "@shared/schema";

function getEmbedUrl(url: string): string | null {
  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`;

  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`;

  const loomMatch = url.match(/loom\.com\/share\/([a-zA-Z0-9]+)/);
  if (loomMatch) return `https://www.loom.com/embed/${loomMatch[1]}`;

  if (url.includes("embed") || url.endsWith(".mp4") || url.endsWith(".webm")) return url;

  return null;
}

function formatTimeSpent(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins < 60) return `${mins}:${secs.toString().padStart(2, "0")}`;
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  return `${hrs}:${remMins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

export default function DemoPage() {
  const [email, setEmail] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [videosViewed, setVideosViewed] = useState(new Set<string>());
  const [videosCompleted, setVideosCompleted] = useState(new Set<string>());
  const startTimeRef = useRef<number>(Date.now());
  const sessionIdRef = useRef<string | null>(null);
  const videosViewedRef = useRef(new Set<string>());
  const videosCompletedRef = useRef(new Set<string>());

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  useEffect(() => {
    videosViewedRef.current = videosViewed;
  }, [videosViewed]);

  useEffect(() => {
    videosCompletedRef.current = videosCompleted;
  }, [videosCompleted]);

  const sendUpdate = useCallback(() => {
    const sid = sessionIdRef.current;
    if (!sid) return;
    const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
    fetch(`/api/demo-access/${sid}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        timeSpentSeconds: elapsed,
        videosViewed: videosViewedRef.current.size,
        videosCompleted: videosCompletedRef.current.size,
      }),
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!sessionId) return;
    const interval = setInterval(sendUpdate, 10000);
    const handleBeforeUnload = () => sendUpdate();
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      clearInterval(interval);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      sendUpdate();
    };
  }, [sessionId, sendUpdate]);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !email.includes("@")) {
      setError("Please enter a valid email address");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/demo-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to submit");
      }
      const session = await res.json();
      setSessionId(session.id);
      startTimeRef.current = Date.now();
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  const handleVideoView = (videoId: string) => {
    setVideosViewed(prev => {
      const next = new Set(prev);
      next.add(videoId);
      return next;
    });
  };

  const handleVideoEnded = (videoId: string) => {
    setVideosCompleted(prev => {
      const next = new Set(prev);
      next.add(videoId);
      return next;
    });
  };

  const { data: videos, isLoading } = useQuery<DemoVideo[]>({
    queryKey: ["/api/demo-videos"],
  });

  const publishedVideos = videos?.filter(v => v.isPublished) || [];

  if (!sessionId) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-full max-w-md px-6">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <MonitorPlay className="w-6 h-6 text-primary" />
              </div>
            </div>
            <h1 className="text-2xl font-bold mb-2" data-testid="text-demo-gate-title">Watch Our Product Demo</h1>
            <p className="text-muted-foreground text-sm">
              Enter your email to access our demo videos and see Government Affairs Intelligence in action.
            </p>
          </div>

          <Card>
            <CardContent className="pt-6">
              <form onSubmit={handleEmailSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="email" className="text-sm font-medium">Work Email</Label>
                  <div className="relative mt-1.5">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10"
                      autoFocus
                      data-testid="input-demo-email"
                    />
                  </div>
                </div>
                {error && (
                  <p className="text-sm text-destructive" data-testid="text-demo-error">{error}</p>
                )}
                <Button
                  type="submit"
                  className="w-full"
                  disabled={submitting || !email.trim()}
                  data-testid="button-demo-submit-email"
                >
                  {submitting ? "Loading..." : "Watch Demo"}
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  By continuing, you agree to our <Link href="/terms" className="underline">Terms</Link> and <Link href="/privacy" className="underline">Privacy Policy</Link>.
                </p>
              </form>
            </CardContent>
          </Card>

          <div className="mt-6 text-center">
            <Link href="/">
              <Button variant="ghost" size="sm" data-testid="button-back-home-gate">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Home
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="mb-6">
          <Link href="/">
            <Button variant="ghost" size="sm" data-testid="button-back-home">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Button>
          </Link>
        </div>

        <div className="mb-10 text-center">
          <div className="flex items-center justify-center gap-3 mb-3">
            <MonitorPlay className="w-8 h-8 text-primary" />
            <h1 className="text-3xl font-bold" data-testid="text-demo-title">Product Demo</h1>
          </div>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            See Government Affairs Intelligence in action. Watch walkthroughs of our key features and capabilities.
          </p>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        )}

        {!isLoading && publishedVideos.length === 0 && (
          <div className="text-center py-20">
            <MonitorPlay className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Demo videos coming soon</h2>
            <p className="text-muted-foreground">Check back shortly for product walkthroughs and feature demos.</p>
          </div>
        )}

        <div className="space-y-8">
          {publishedVideos.map((video) => {
            const embedUrl = getEmbedUrl(video.videoUrl);
            return (
              <Card key={video.id} className="overflow-hidden" data-testid={`demo-video-${video.id}`}>
                <CardContent className="p-0">
                  {video.videoUrl.startsWith("/objects/") ? (
                    <div className="aspect-video w-full bg-black">
                      <video
                        src={video.videoUrl}
                        className="w-full h-full"
                        controls
                        preload="metadata"
                        playsInline
                        onPlay={() => handleVideoView(video.id)}
                        onEnded={() => handleVideoEnded(video.id)}
                        data-testid={`video-player-${video.id}`}
                      >
                        Your browser does not support the video tag.
                      </video>
                    </div>
                  ) : embedUrl ? (
                    <div
                      className="aspect-video w-full"
                      onMouseEnter={() => handleVideoView(video.id)}
                      onClick={() => handleVideoView(video.id)}
                    >
                      <iframe
                        src={embedUrl}
                        className="w-full h-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        title={video.title}
                      />
                    </div>
                  ) : (
                    <div className="aspect-video w-full bg-muted flex items-center justify-center">
                      <a
                        href={video.videoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex flex-col items-center gap-3 text-muted-foreground hover:text-primary transition-colors"
                        onClick={() => handleVideoView(video.id)}
                      >
                        <Play className="w-16 h-16" />
                        <span className="text-sm">Open Video</span>
                      </a>
                    </div>
                  )}
                  <div className="p-5">
                    <h2 className="text-xl font-semibold mb-1" data-testid={`text-video-title-${video.id}`}>{video.title}</h2>
                    {video.description && (
                      <p className="text-muted-foreground text-sm">{video.description}</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
