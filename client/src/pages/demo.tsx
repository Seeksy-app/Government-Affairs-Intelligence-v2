import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Play, MonitorPlay } from "lucide-react";
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

function getThumbnailFromUrl(url: string): string | null {
  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
  if (ytMatch) return `https://img.youtube.com/vi/${ytMatch[1]}/maxresdefault.jpg`;
  return null;
}

export default function DemoPage() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const { data: videos, isLoading } = useQuery<DemoVideo[]>({
    queryKey: ["/api/demo-videos"],
  });

  const publishedVideos = videos?.filter(v => v.isPublished) || [];

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
                  {embedUrl ? (
                    <div className="aspect-video w-full">
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
