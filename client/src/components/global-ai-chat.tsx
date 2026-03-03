import { useState, useRef, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { MessageSquare, Send, Sparkles, ArrowRight, History, Search, Loader2, Save, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { AIMessageRenderer } from "@/components/ai-message-renderer";
import type { ClientPortal } from "@shared/schema";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  provider?: string;
}

const SUGGESTED_PROMPTS = [
  "Find recent lobbying activities related to healthcare reform",
  "What legislation has been introduced on climate change this month?",
  "Research key staffers working on defense policy",
  "Who are the top lobbyists for tech companies?",
  "Find connections between energy sector and congressional committees",
  "What are recent career moves in the EPA?",
];

const AI_PROVIDERS = [
  { value: "auto", label: "Auto (Best Available)" },
  { value: "openai", label: "OpenAI GPT-4.1" },
  { value: "gemini", label: "Google Gemini" },
  { value: "anthropic", label: "Anthropic Claude" },
];

export function openAIChat(prefillMessage?: string) {
  window.dispatchEvent(new CustomEvent("open-ai-chat", { detail: { message: prefillMessage } }));
}

export function GlobalAIChat() {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [selectedProvider, setSelectedProvider] = useState("auto");
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [selectedPortalId, setSelectedPortalId] = useState("");
  const [messageToSave, setMessageToSave] = useState<ChatMessage | null>(null);
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    const saved = localStorage.getItem("ai-agent-recent-searches");
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setIsOpen(true);
      if (detail?.message) {
        setChatInput(detail.message);
      }
    };
    window.addEventListener("open-ai-chat", handler);
    return () => window.removeEventListener("open-ai-chat", handler);
  }, []);

  const { data: portals = [] } = useQuery<ClientPortal[]>({
    queryKey: ["/api/portals"],
  });

  const saveRecentSearch = (query: string) => {
    const updated = [query, ...recentSearches.filter(s => s !== query)].slice(0, 5);
    setRecentSearches(updated);
    localStorage.setItem("ai-agent-recent-searches", JSON.stringify(updated));
  };

  const chatMutation = useMutation({
    mutationFn: async (message: string) => {
      const res = await apiRequest("POST", "/api/research/chat", { 
        message, 
        context: "",
        history: chatMessages,
        provider: selectedProvider === "auto" ? undefined : selectedProvider 
      });
      return res.json();
    },
    onSuccess: (data) => {
      setChatMessages(prev => [...prev, { 
        role: "assistant", 
        content: data.response,
        provider: data.provider 
      }]);
      setChatInput("");
    },
    onError: (error: Error) => {
      toast({ title: "Chat failed", description: error.message, variant: "destructive" });
    },
  });

  const saveToPortalMutation = useMutation({
    mutationFn: async ({ portalId, content }: { portalId: string; content: string }) => {
      const res = await apiRequest("POST", `/api/portals/${portalId}/documents`, {
        title: `AI Research - ${new Date().toLocaleDateString()}`,
        content,
        documentType: "research",
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Saved to portal", description: "Research has been added to the customer portal" });
      setSaveDialogOpen(false);
      setMessageToSave(null);
      setSelectedPortalId("");
      queryClient.invalidateQueries({ queryKey: ["/api/portals"] });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to save", description: error.message, variant: "destructive" });
    },
  });

  const handleChatSubmit = () => {
    if (!chatInput.trim()) return;
    saveRecentSearch(chatInput);
    setChatMessages(prev => [...prev, { role: "user", content: chatInput }]);
    chatMutation.mutate(chatInput);
  };

  const handlePromptClick = (prompt: string) => {
    saveRecentSearch(prompt);
    setChatInput(prompt);
    setChatMessages(prev => [...prev, { role: "user", content: prompt }]);
    chatMutation.mutate(prompt);
  };

  const handleSaveToPortal = (message: ChatMessage) => {
    setMessageToSave(message);
    setSaveDialogOpen(true);
  };

  const confirmSaveToPortal = () => {
    if (!selectedPortalId || !messageToSave) return;
    saveToPortalMutation.mutate({
      portalId: selectedPortalId,
      content: messageToSave.content,
    });
  };

  return (
    <>
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetTrigger asChild>
          <Button className="gap-2 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-md px-5" data-testid="button-global-ai-chat">
            <Sparkles className="w-4 h-4" />
            AI Chat
            {chatMessages.length > 0 && (
              <Badge variant="secondary" className="ml-1 bg-white/20 text-white hover:bg-white/30">{chatMessages.length}</Badge>
            )}
          </Button>
        </SheetTrigger>
        <SheetContent className="w-[480px] sm:w-[540px] lg:w-[600px] flex flex-col p-0">
          <div className="p-6 pb-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="font-semibold text-lg">Research Assistant</h2>
                  <p className="text-xs text-muted-foreground">AI-powered political intelligence</p>
                </div>
              </div>
            </div>
            <div className="mt-4">
              <Select value={selectedProvider} onValueChange={setSelectedProvider}>
                <SelectTrigger className="w-full" data-testid="select-ai-provider">
                  <SelectValue placeholder="Select AI Provider" />
                </SelectTrigger>
                <SelectContent>
                  {AI_PROVIDERS.map((provider) => (
                    <SelectItem key={provider.value} value={provider.value}>
                      {provider.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="flex-1 flex flex-col min-h-0 px-6">
            {chatMessages.length === 0 ? (
              <ScrollArea className="flex-1">
                <div className="space-y-6 pb-4">
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Ask questions about your research or get help with political intelligence analysis. Sources are provided with every response.
                  </p>
                  
                  {recentSearches.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <History className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm font-medium">Recent Searches</span>
                      </div>
                      <div className="space-y-1">
                        {recentSearches.map((search, i) => (
                          <button
                            key={i}
                            className="w-full text-left px-3 py-2.5 rounded-lg border border-transparent hover:border-border hover:bg-muted/50 transition-colors group flex items-center gap-2"
                            onClick={() => handlePromptClick(search)}
                            data-testid={`global-recent-search-${i}`}
                          >
                            <Search className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors flex-shrink-0" />
                            <span className="text-sm truncate">{search}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Suggested Prompts</span>
                    </div>
                    <div className="space-y-1">
                      {SUGGESTED_PROMPTS.map((prompt, i) => (
                        <button
                          key={i}
                          className="w-full text-left px-3 py-2.5 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors group flex items-start gap-2"
                          onClick={() => handlePromptClick(prompt)}
                          data-testid={`global-suggested-prompt-${i}`}
                        >
                          <ArrowRight className="w-4 h-4 mt-0.5 text-primary flex-shrink-0" />
                          <span className="text-sm leading-relaxed">{prompt}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </ScrollArea>
            ) : (
              <ScrollArea className="flex-1">
                <div className="space-y-4 pb-4">
                  {chatMessages.map((msg, i) => (
                    <div
                      key={i}
                      className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <div className="flex flex-col gap-1 max-w-[95%]">
                        {msg.role === "user" ? (
                          <div
                            className="rounded-2xl px-4 py-3 bg-primary text-primary-foreground rounded-br-md"
                            data-testid={`global-chat-message-${i}`}
                          >
                            <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                          </div>
                        ) : (
                          <div
                            className="rounded-2xl px-4 py-3 bg-muted rounded-bl-md"
                            data-testid={`global-chat-message-${i}`}
                          >
                            <AIMessageRenderer 
                              content={msg.content} 
                              onFollowUp={(query) => {
                                setChatInput(query);
                                saveRecentSearch(query);
                                setChatMessages(prev => [...prev, { role: "user", content: query }]);
                                chatMutation.mutate(query);
                              }}
                            />
                          </div>
                        )}
                        {msg.role === "assistant" && portals.length > 0 && (
                          <div className="flex gap-1 px-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                              onClick={() => handleSaveToPortal(msg)}
                              data-testid={`button-save-to-portal-${i}`}
                            >
                              <Save className="w-3 h-3 mr-1" />
                              Save to Portal
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  {chatMutation.isPending && (
                    <div className="flex justify-start">
                      <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-sm text-muted-foreground">Thinking...</span>
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>
            )}
          </div>

          <div className="p-4 border-t bg-muted/30">
            <div className="flex gap-2 items-center">
              <div className="flex-1 relative">
                <Input
                  placeholder="Ask a question..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleChatSubmit()}
                  disabled={chatMutation.isPending}
                  className="pr-10 bg-background"
                  data-testid="input-global-chat"
                />
              </div>
              <Button
                size="icon"
                onClick={handleChatSubmit}
                disabled={!chatInput.trim() || chatMutation.isPending}
                className="shrink-0"
                data-testid="button-send-global-chat"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
            {chatMessages.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full mt-2 text-xs text-muted-foreground"
                onClick={() => setChatMessages([])}
                data-testid="button-clear-global-chat"
              >
                Clear conversation
              </Button>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ExternalLink className="w-5 h-5" />
              Save to Customer Portal
            </DialogTitle>
            <DialogDescription>
              Select a customer portal to save this research response. It will be available for your clients to view.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Select value={selectedPortalId} onValueChange={setSelectedPortalId}>
              <SelectTrigger data-testid="select-portal-for-save">
                <SelectValue placeholder="Select a portal..." />
              </SelectTrigger>
              <SelectContent>
                {portals.map((portal) => (
                  <SelectItem key={portal.id} value={portal.id}>
                    {portal.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {portals.length === 0 && (
              <p className="text-sm text-muted-foreground mt-2">
                No customer portals available. Create a portal first to save research.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={confirmSaveToPortal} 
              disabled={!selectedPortalId || saveToPortalMutation.isPending}
              data-testid="button-confirm-save-to-portal"
            >
              {saveToPortalMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save to Portal
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
