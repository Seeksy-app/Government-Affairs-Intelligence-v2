import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Plus, Trash2, Sparkles, Save, FileText, Lock, Share2, ExternalLink,
} from "lucide-react";

function getInitialState() {
  const params = new URLSearchParams(window.location.search);
  const prefillUrls: string[] = [];
  for (let i = 0; i < 5; i++) {
    const v = params.get(`url${i}`);
    if (v) prefillUrls.push(v);
  }
  return {
    title: params.get("title") ?? "",
    clientContext: params.get("clientContext") ?? "",
    urls: prefillUrls.length > 0 ? prefillUrls : [""],
  };
}

export default function BriefsNew() {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const init = getInitialState();
  const [title, setTitle] = useState(init.title);
  const [clientContext, setClientContext] = useState(init.clientContext);
  const [sensitivity, setSensitivity] = useState<"internal" | "shareable">("internal");
  const [urls, setUrls] = useState<string[]>(init.urls);

  const addUrl = () => {
    if (urls.length < 5) setUrls([...urls, ""]);
  };

  const removeUrl = (i: number) => {
    setUrls(urls.filter((_, idx) => idx !== i));
  };

  const updateUrl = (i: number, val: string) => {
    setUrls(urls.map((u, idx) => (idx === i ? val : u)));
  };

  const validUrls = urls.filter((u) => u.trim() !== "");

  const createMutation = useMutation({
    mutationFn: async (generate: boolean) => {
      const res = await apiRequest("POST", "/api/briefs", {
        title: title.trim(),
        clientContext: clientContext.trim() || null,
        sensitivity,
        sourceUrls: validUrls,
      });
      const brief = await res.json();
      if (generate) {
        await apiRequest("POST", `/api/briefs/${brief.id}/generate`, {});
      }
      return brief;
    },
    onSuccess: (brief) => {
      navigate(`/briefs/${brief.id}`);
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const canSubmit = title.trim().length > 0 && validUrls.length > 0;

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-1">
          <FileText className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-semibold">New Decision Brief</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          AI-generated decision brief for client delivery
        </p>
      </div>

      <div className="space-y-6">
        {/* Title */}
        <div className="space-y-2">
          <Label htmlFor="title">
            Topic / Title <span className="text-destructive">*</span>
          </Label>
          <Input
            id="title"
            placeholder="e.g. Senate Defense Bill Amendment Markup"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={500}
          />
        </div>

        {/* Sensitivity toggle */}
        <div className="space-y-2">
          <Label>Sensitivity</Label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setSensitivity("internal")}
              className={`flex items-center gap-2 px-4 py-2 rounded-md border text-sm font-medium transition-colors ${
                sensitivity === "internal"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background border-border hover:bg-muted"
              }`}
            >
              <Lock className="h-4 w-4" />
              Internal
            </button>
            <button
              type="button"
              onClick={() => setSensitivity("shareable")}
              className={`flex items-center gap-2 px-4 py-2 rounded-md border text-sm font-medium transition-colors ${
                sensitivity === "shareable"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background border-border hover:bg-muted"
              }`}
            >
              <Share2 className="h-4 w-4" />
              Shareable
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            {sensitivity === "internal"
              ? "Frank, hedged tone — for internal strategy use only"
              : "Polished, on-message tone — suitable for external audiences"}
          </p>
        </div>

        {/* Client context */}
        <div className="space-y-2">
          <Label htmlFor="context">
            Client Context{" "}
            <span className="text-muted-foreground text-xs font-normal">(optional)</span>
          </Label>
          <Textarea
            id="context"
            placeholder="e.g. Our client is a defense contractor primarily concerned with R&D funding allocations in the NDAA..."
            value={clientContext}
            onChange={(e) => setClientContext(e.target.value)}
            maxLength={2000}
            rows={4}
          />
          <p className="text-xs text-muted-foreground">
            {clientContext.length}/2000 — used to tailor the "Why It Matters" section
          </p>
        </div>

        {/* Source URLs */}
        <div className="space-y-2">
          <Label>
            Source URLs <span className="text-destructive">*</span>
          </Label>
          <p className="text-xs text-muted-foreground">
            Up to 5 article URLs. These are the primary grounding material for
            the brief.
          </p>
          <div className="space-y-2">
            {urls.map((url, i) => (
              <div key={i} className="flex gap-2">
                <div className="relative flex-1">
                  <ExternalLink className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    placeholder="https://..."
                    value={url}
                    onChange={(e) => updateUrl(i, e.target.value)}
                    className="pl-9"
                    type="url"
                  />
                </div>
                {urls.length > 1 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeUrl(i)}
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
          {urls.length < 5 && (
            <Button variant="outline" size="sm" onClick={addUrl} className="mt-1">
              <Plus className="h-4 w-4 mr-1" />
              Add URL ({urls.length}/5)
            </Button>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-2 border-t">
          <Button
            variant="outline"
            disabled={!canSubmit || createMutation.isPending}
            onClick={() => createMutation.mutate(false)}
          >
            <Save className="h-4 w-4 mr-2" />
            Save Draft
          </Button>
          <Button
            disabled={!canSubmit || createMutation.isPending}
            onClick={() => createMutation.mutate(true)}
          >
            {createMutation.isPending ? (
              <>
                <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full mr-2" />
                Creating...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Generate Brief
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
