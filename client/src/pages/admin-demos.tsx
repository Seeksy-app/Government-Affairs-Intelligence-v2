import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, GripVertical, ExternalLink, Eye, EyeOff, Pencil, MonitorPlay, Video } from "lucide-react";
import type { DemoVideo } from "@shared/schema";

function getYouTubeThumbnail(url: string): string | null {
  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
  if (ytMatch) return `https://img.youtube.com/vi/${ytMatch[1]}/mqdefault.jpg`;
  return null;
}

export default function AdminDemos() {
  const { toast } = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const [editVideo, setEditVideo] = useState<DemoVideo | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [sortOrder, setSortOrder] = useState(0);

  const { data: videos, isLoading } = useQuery<DemoVideo[]>({
    queryKey: ["/api/admin/demo-videos"],
  });

  const addMutation = useMutation({
    mutationFn: async (data: { title: string; description: string; videoUrl: string; sortOrder: number }) => {
      return apiRequest("POST", "/api/admin/demo-videos", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/demo-videos"] });
      queryClient.invalidateQueries({ queryKey: ["/api/demo-videos"] });
      toast({ title: "Video added" });
      resetForm();
      setAddOpen(false);
    },
    onError: (error: Error) => {
      toast({ title: "Failed to add video", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<DemoVideo> }) => {
      return apiRequest("PATCH", `/api/admin/demo-videos/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/demo-videos"] });
      queryClient.invalidateQueries({ queryKey: ["/api/demo-videos"] });
      toast({ title: "Video updated" });
      setEditVideo(null);
      resetForm();
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update video", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/admin/demo-videos/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/demo-videos"] });
      queryClient.invalidateQueries({ queryKey: ["/api/demo-videos"] });
      toast({ title: "Video deleted" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to delete video", description: error.message, variant: "destructive" });
    },
  });

  const togglePublishMutation = useMutation({
    mutationFn: async ({ id, isPublished }: { id: string; isPublished: boolean }) => {
      return apiRequest("PATCH", `/api/admin/demo-videos/${id}`, { isPublished });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/demo-videos"] });
      queryClient.invalidateQueries({ queryKey: ["/api/demo-videos"] });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update", description: error.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setVideoUrl("");
    setSortOrder(0);
  };

  const openEditDialog = (video: DemoVideo) => {
    setEditVideo(video);
    setTitle(video.title);
    setDescription(video.description || "");
    setVideoUrl(video.videoUrl);
    setSortOrder(video.sortOrder || 0);
  };

  const handleSubmit = () => {
    if (!title.trim() || !videoUrl.trim()) {
      toast({ title: "Title and video URL are required", variant: "destructive" });
      return;
    }
    if (editVideo) {
      updateMutation.mutate({
        id: editVideo.id,
        data: { title, description: description || null, videoUrl, sortOrder },
      });
    } else {
      addMutation.mutate({ title, description, videoUrl, sortOrder });
    }
  };

  const sortedVideos = [...(videos || [])].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-admin-demos-title">Demo Videos</h1>
          <p className="text-muted-foreground mt-1">
            Manage videos shown on the public demo page at <span className="font-mono text-xs">/demo</span>
          </p>
        </div>
        <div className="flex gap-2">
          <a href="/demo" target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm" data-testid="button-preview-demo">
              <ExternalLink className="w-4 h-4 mr-2" />
              Preview Demo Page
            </Button>
          </a>
          <Dialog open={addOpen} onOpenChange={(open) => { setAddOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-demo-video">
                <Plus className="w-4 h-4 mr-2" />
                Add Video
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Demo Video</DialogTitle>
                <DialogDescription>
                  Paste a YouTube, Vimeo, or Loom URL. The video will be embedded on the demo page.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g., Platform Overview"
                    data-testid="input-video-title"
                  />
                </div>
                <div>
                  <Label htmlFor="videoUrl">Video URL</Label>
                  <Input
                    id="videoUrl"
                    value={videoUrl}
                    onChange={(e) => setVideoUrl(e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=..."
                    data-testid="input-video-url"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Supports YouTube, Vimeo, and Loom links
                  </p>
                </div>
                <div>
                  <Label htmlFor="description">Description (optional)</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Brief description of what this video covers"
                    rows={3}
                    data-testid="input-video-description"
                  />
                </div>
                <div>
                  <Label htmlFor="sortOrder">Sort Order</Label>
                  <Input
                    id="sortOrder"
                    type="number"
                    value={sortOrder}
                    onChange={(e) => setSortOrder(parseInt(e.target.value) || 0)}
                    placeholder="0"
                    data-testid="input-video-sort-order"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Lower numbers appear first</p>
                </div>
                <Button
                  onClick={handleSubmit}
                  disabled={addMutation.isPending}
                  className="w-full"
                  data-testid="button-submit-video"
                >
                  {addMutation.isPending ? "Adding..." : "Add Video"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Video className="w-5 h-5 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{videos?.length || 0}</p>
                <p className="text-sm text-muted-foreground">Total Videos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Eye className="w-5 h-5 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{videos?.filter(v => v.isPublished).length || 0}</p>
                <p className="text-sm text-muted-foreground">Published</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      )}

      {!isLoading && sortedVideos.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <MonitorPlay className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">No demo videos yet. Add your first video to get started.</p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {sortedVideos.map((video) => {
          const thumbnail = getYouTubeThumbnail(video.videoUrl);
          return (
            <Card key={video.id} data-testid={`admin-video-${video.id}`}>
              <CardContent className="py-4">
                <div className="flex items-center gap-4">
                  <GripVertical className="w-4 h-4 text-muted-foreground/40 shrink-0" />
                  {thumbnail ? (
                    <img src={thumbnail} alt="" className="w-28 h-16 object-cover rounded shrink-0" />
                  ) : (
                    <div className="w-28 h-16 bg-muted rounded shrink-0 flex items-center justify-center">
                      <Video className="w-6 h-6 text-muted-foreground/40" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm truncate">{video.title}</p>
                      <Badge variant={video.isPublished ? "default" : "secondary"} className="text-xs">
                        {video.isPublished ? "Published" : "Draft"}
                      </Badge>
                      <span className="text-xs text-muted-foreground">Order: {video.sortOrder}</span>
                    </div>
                    {video.description && (
                      <p className="text-xs text-muted-foreground mt-1 truncate">{video.description}</p>
                    )}
                    <p className="text-xs text-muted-foreground/60 mt-1 truncate font-mono">{video.videoUrl}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Switch
                      checked={video.isPublished ?? true}
                      onCheckedChange={(checked) => togglePublishMutation.mutate({ id: video.id, isPublished: checked })}
                      data-testid={`switch-publish-${video.id}`}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditDialog(video)}
                      data-testid={`button-edit-video-${video.id}`}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        if (confirm("Delete this video?")) {
                          deleteMutation.mutate(video.id);
                        }
                      }}
                      data-testid={`button-delete-video-${video.id}`}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={!!editVideo} onOpenChange={(open) => { if (!open) { setEditVideo(null); resetForm(); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Demo Video</DialogTitle>
            <DialogDescription>Update the video details below.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-title">Title</Label>
              <Input
                id="edit-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                data-testid="input-edit-video-title"
              />
            </div>
            <div>
              <Label htmlFor="edit-videoUrl">Video URL</Label>
              <Input
                id="edit-videoUrl"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                data-testid="input-edit-video-url"
              />
            </div>
            <div>
              <Label htmlFor="edit-description">Description (optional)</Label>
              <Textarea
                id="edit-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                data-testid="input-edit-video-description"
              />
            </div>
            <div>
              <Label htmlFor="edit-sortOrder">Sort Order</Label>
              <Input
                id="edit-sortOrder"
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(parseInt(e.target.value) || 0)}
                data-testid="input-edit-video-sort-order"
              />
            </div>
            <Button
              onClick={handleSubmit}
              disabled={updateMutation.isPending}
              className="w-full"
              data-testid="button-update-video"
            >
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
