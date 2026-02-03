import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare, Send, Sparkles, ArrowRight, History, Search, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const SUGGESTED_PROMPTS = [
  "Find recent lobbying activities related to healthcare reform",
  "What legislation has been introduced on climate change this month?",
  "Research key staffers working on defense policy",
  "Who are the top lobbyists for tech companies?",
  "Find connections between energy sector and congressional committees",
  "What are recent career moves in the EPA?",
];

export function GlobalAIChat() {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    const saved = localStorage.getItem("ai-agent-recent-searches");
    return saved ? JSON.parse(saved) : [];
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
        history: chatMessages 
      });
      return res.json();
    },
    onSuccess: (data) => {
      setChatMessages(prev => [...prev, { role: "assistant", content: data.response }]);
      setChatInput("");
    },
    onError: (error: Error) => {
      toast({ title: "Chat failed", description: error.message, variant: "destructive" });
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

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" className="gap-2" data-testid="button-global-ai-chat">
          <MessageSquare className="w-4 h-4" />
          AI Chat
          {chatMessages.length > 0 && (
            <Badge variant="secondary" className="ml-1">{chatMessages.length}</Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[400px] sm:w-[480px] flex flex-col p-0">
        <div className="p-6 pb-4">
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
        
        <div className="flex-1 flex flex-col min-h-0 px-6">
          {chatMessages.length === 0 ? (
            <ScrollArea className="flex-1">
              <div className="space-y-6 pb-4">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Ask questions about your research or get help with political intelligence analysis.
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
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground rounded-br-md"
                          : "bg-muted rounded-bl-md"
                      }`}
                      data-testid={`global-chat-message-${i}`}
                    >
                      <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
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
  );
}
