import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, GripVertical, ExternalLink, Eye, Pencil, MonitorPlay, Video, Upload, Loader2, Link } from "lucide-react";
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
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [addTab, setAddTab] = useState<string>("url");
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    setAddTab("url");
    setUploadProgress("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const openEditDialog = (video: DemoVideo) => {
    setEditVideo(video);
    setTitle(video.title);
    setDescription(video.description || "");
    setVideoUrl(video.videoUrl);
    setSortOrder(video.sortOrder || 0);
  };

  const handleFileUpload = async (file: File) => {
    if (!file) return;

    const maxSize = 500 * 1024 * 1024;
    if (file.size > maxSize) {
      toast({ title: "File too large", description: "Maximum file size is 500MB", variant: "destructive" });
      return;
    }

    const allowedTypes = ["video/mp4", "video/webm", "video/quicktime", "video/x-msvideo", "video/x-matroska"];
    if (!allowedTypes.includes(file.type)) {
      toast({ title: "Invalid file type", description: "Please upload an MP4, WebM, MOV, AVI, or MKV file", variant: "destructive" });
      return;
    }

    setUploading(true);
    setUploadProgress("Requesting upload URL...");

    try {
      const urlRes = await fetch("/api/uploads/request-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: file.name,
          size: file.size,
          contentType: file.type,
        }),
      });

      if (!urlRes.ok) {
        let errorMsg = "Failed to get upload URL";
        try {
          const errData = await urlRes.json();
          errorMsg = errData.message || errData.error || errorMsg;
        } catch {}
        throw new Error(errorMsg);
      }
      const { uploadURL, objectPath } = await urlRes.json();

      setUploadProgress(`Uploading ${(file.size / (1024 * 1024)).toFixed(1)}MB...`);

      const uploadRes = await fetch(uploadURL, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!uploadRes.ok) throw new Error("Upload to storage failed. Please try again.");

      setUploadProgress("Upload complete!");
      setVideoUrl(objectPath);
      toast({ title: "Video uploaded", description: "You can now save the demo video" });
    } catch (error: any) {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
      setUploadProgress("");
    } finally {
      setUploading(false);
    }
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
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Add Demo Video</DialogTitle>
                <DialogDescription>
                  Upload a video file or paste a YouTube/Vimeo/Loom URL.
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

                <Tabs value={addTab} onValueChange={setAddTab}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="url" className="flex items-center gap-1.5">
                      <Link className="w-3.5 h-3.5" />
                      Paste URL
                    </TabsTrigger>
                    <TabsTrigger value="upload" className="flex items-center gap-1.5">
                      <Upload className="w-3.5 h-3.5" />
                      Upload File
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="url" className="mt-3">
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
                  </TabsContent>
                  <TabsContent value="upload" className="mt-3">
                    <div className="space-y-3">
                      <div
                        className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
                        onClick={() => !uploading && fileInputRef.current?.click()}
                        data-testid="dropzone-video-upload"
                      >
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="video/mp4,video/webm,video/quicktime,video/x-msvideo,video/x-matroska"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleFileUpload(file);
                          }}
                          data-testid="input-video-file"
                        />
                        {uploading ? (
                          <div className="flex flex-col items-center gap-2">
                            <Loader2 className="w-8 h-8 text-primary animate-spin" />
                            <p className="text-sm text-muted-foreground">{uploadProgress}</p>
                          </div>
                        ) : videoUrl && videoUrl.startsWith("/objects/") ? (
                          <div className="flex flex-col items-center gap-2">
                            <Video className="w-8 h-8 text-primary" />
                            <p className="text-sm font-medium text-primary">Video uploaded</p>
                            <p className="text-xs text-muted-foreground">Click to replace</p>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-2">
                            <Upload className="w-8 h-8 text-muted-foreground/40" />
                            <p className="text-sm text-muted-foreground">Click to select a video file</p>
                            <p className="text-xs text-muted-foreground/60">MP4, WebM, MOV, AVI, MKV up to 500MB</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>

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
                  disabled={addMutation.isPending || uploading || !title.trim() || !videoUrl.trim()}
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
          const isUploaded = video.videoUrl.startsWith("/objects/");
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
                      {isUploaded && (
                        <Badge variant="outline" className="text-xs">
                          <Upload className="w-3 h-3 mr-1" />
                          Uploaded
                        </Badge>
                      )}
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
