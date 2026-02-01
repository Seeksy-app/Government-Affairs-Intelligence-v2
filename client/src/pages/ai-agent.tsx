import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bot, Send, Globe, Youtube, User, Building2, Briefcase, Loader2, MessageSquare, Sparkles, Search, History, ArrowRight } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Matter } from "@shared/schema";

interface SearchResult {
  id: string;
  type: "url" | "youtube" | "entity" | "query";
  title: string;
  content: string;
  timestamp: Date;
}

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

export default function AIAgentPage() {
  const { toast } = useToast();
  const [searchInput, setSearchInput] = useState("");
  const [entityName, setEntityName] = useState("");
  const [entityType, setEntityType] = useState<"person" | "organization" | "company">("person");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [selectedMatterId, setSelectedMatterId] = useState<string>("");
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    const saved = localStorage.getItem("ai-agent-recent-searches");
    return saved ? JSON.parse(saved) : [];
  });

  const { data: matters = [] } = useQuery<Matter[]>({
    queryKey: ["/api/matters"],
  });

  const saveRecentSearch = (query: string) => {
    const updated = [query, ...recentSearches.filter(s => s !== query)].slice(0, 5);
    setRecentSearches(updated);
    localStorage.setItem("ai-agent-recent-searches", JSON.stringify(updated));
  };

  const urlSearchMutation = useMutation({
    mutationFn: async (url: string) => {
      const res = await apiRequest("POST", "/api/research/extract-url", { url });
      return res.json();
    },
    onSuccess: (data) => {
      const result: SearchResult = {
        id: Date.now().toString(),
        type: searchInput.includes("youtube.com") || searchInput.includes("youtu.be") ? "youtube" : "url",
        title: data.title || "Extracted Content",
        content: data.summary || data.content?.substring(0, 500) || "Content extracted successfully",
        timestamp: new Date(),
      };
      setSearchResults(prev => [result, ...prev]);
      saveRecentSearch(searchInput);
      toast({ title: "Content extracted successfully" });
      setSearchInput("");
    },
    onError: (error: Error) => {
      toast({ title: "Extraction failed", description: error.message, variant: "destructive" });
    },
  });

  const entityResearchMutation = useMutation({
    mutationFn: async (data: { entityName: string; entityType: string }) => {
      const res = await apiRequest("POST", "/api/research/entity", data);
      return res.json();
    },
    onSuccess: (data) => {
      const result: SearchResult = {
        id: Date.now().toString(),
        type: "entity",
        title: `Research: ${entityName}`,
        content: data.summary || data.content?.substring(0, 500) || "Research completed",
        timestamp: new Date(),
      };
      setSearchResults(prev => [result, ...prev]);
      saveRecentSearch(`Entity: ${entityName}`);
      toast({ title: "Entity research completed" });
      setEntityName("");
    },
    onError: (error: Error) => {
      toast({ title: "Research failed", description: error.message, variant: "destructive" });
    },
  });

  const queryMutation = useMutation({
    mutationFn: async (prompt: string) => {
      const res = await apiRequest("POST", "/api/research/query", { prompt });
      return res.json();
    },
    onSuccess: (data) => {
      const result: SearchResult = {
        id: Date.now().toString(),
        type: "query",
        title: searchInput.substring(0, 50) + (searchInput.length > 50 ? "..." : ""),
        content: data.summary || data.content?.substring(0, 500) || "Query completed",
        timestamp: new Date(),
      };
      setSearchResults(prev => [result, ...prev]);
      saveRecentSearch(searchInput);
      toast({ title: "Research query completed" });
      setSearchInput("");
    },
    onError: (error: Error) => {
      toast({ title: "Query failed", description: error.message, variant: "destructive" });
    },
  });

  const chatMutation = useMutation({
    mutationFn: async (message: string) => {
      const context = searchResults.map(r => `${r.title}: ${r.content}`).join("\n\n");
      const res = await apiRequest("POST", "/api/research/chat", { 
        message, 
        context,
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

  const handleSearch = () => {
    if (!searchInput.trim()) return;
    
    if (searchInput.startsWith("http://") || searchInput.startsWith("https://")) {
      urlSearchMutation.mutate(searchInput);
    } else {
      queryMutation.mutate(searchInput);
    }
  };

  const handleEntityResearch = () => {
    if (!entityName.trim()) return;
    entityResearchMutation.mutate({ entityName, entityType });
  };

  const handleChatSubmit = () => {
    if (!chatInput.trim()) return;
    setChatMessages(prev => [...prev, { role: "user", content: chatInput }]);
    chatMutation.mutate(chatInput);
  };

  const handlePromptClick = (prompt: string) => {
    setChatInput(prompt);
    setChatMessages(prev => [...prev, { role: "user", content: prompt }]);
    chatMutation.mutate(prompt);
  };

  const isLoading = urlSearchMutation.isPending || entityResearchMutation.isPending || queryMutation.isPending;

  return (
    <div className="flex h-full">
      <div className="flex-1 overflow-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Bot className="w-6 h-6" />
              AI Research Agent
            </h1>
            <p className="text-muted-foreground">
              Search the web, extract content, and research political intelligence
            </p>
          </div>
          <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" className="gap-2" data-testid="button-open-chat">
                <MessageSquare className="w-4 h-4" />
                AI Chat
                {chatMessages.length > 0 && (
                  <Badge variant="secondary" className="ml-1">{chatMessages.length}</Badge>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent className="w-[400px] sm:w-[540px] flex flex-col">
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5" />
                  Research Assistant
                </SheetTitle>
              </SheetHeader>
              
              <div className="flex-1 flex flex-col mt-4 min-h-0">
                {chatMessages.length === 0 ? (
                  <div className="space-y-4">
                    <div className="text-sm text-muted-foreground">
                      Ask questions about your research or get help with political intelligence.
                    </div>
                    
                    {recentSearches.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <History className="w-4 h-4" />
                          Recent Searches
                        </div>
                        <div className="space-y-1">
                          {recentSearches.map((search, i) => (
                            <Button
                              key={i}
                              variant="ghost"
                              className="w-full justify-start text-left h-auto py-2 px-3"
                              onClick={() => handlePromptClick(search)}
                              data-testid={`recent-search-${i}`}
                            >
                              <Search className="w-3 h-3 mr-2 flex-shrink-0" />
                              <span className="truncate text-sm">{search}</span>
                            </Button>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Sparkles className="w-4 h-4" />
                        Suggested Prompts
                      </div>
                      <div className="space-y-1">
                        {SUGGESTED_PROMPTS.map((prompt, i) => (
                          <Button
                            key={i}
                            variant="ghost"
                            className="w-full justify-start text-left h-auto py-2 px-3"
                            onClick={() => handlePromptClick(prompt)}
                            data-testid={`suggested-prompt-${i}`}
                          >
                            <ArrowRight className="w-3 h-3 mr-2 flex-shrink-0" />
                            <span className="text-sm">{prompt}</span>
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <ScrollArea className="flex-1 pr-4">
                    <div className="space-y-4">
                      {chatMessages.map((msg, i) => (
                        <div
                          key={i}
                          className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`max-w-[85%] rounded-lg px-4 py-2 ${
                              msg.role === "user"
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted"
                            }`}
                            data-testid={`chat-message-${i}`}
                          >
                            <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                          </div>
                        </div>
                      ))}
                      {chatMutation.isPending && (
                        <div className="flex justify-start">
                          <div className="bg-muted rounded-lg px-4 py-2">
                            <Loader2 className="w-4 h-4 animate-spin" />
                          </div>
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                )}

                <div className="flex gap-2 pt-4 border-t mt-4">
                  <Input
                    placeholder="Ask a question..."
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleChatSubmit()}
                    disabled={chatMutation.isPending}
                    data-testid="input-chat"
                  />
                  <Button
                    size="icon"
                    onClick={handleChatSubmit}
                    disabled={!chatInput.trim() || chatMutation.isPending}
                    data-testid="button-send-chat"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="w-5 h-5" />
              Search & Extract
            </CardTitle>
            <CardDescription>
              Enter a URL to extract content, or type a research query
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Enter URL or research query..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="flex-1"
                data-testid="input-search"
              />
              <Button
                onClick={handleSearch}
                disabled={!searchInput.trim() || isLoading}
                data-testid="button-search"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Search className="w-4 h-4 mr-2" />
                    Search
                  </>
                )}
              </Button>
            </div>
            <div className="flex gap-2 text-sm text-muted-foreground">
              <Badge variant="outline" className="gap-1">
                <Globe className="w-3 h-3" /> Web Pages
              </Badge>
              <Badge variant="outline" className="gap-1">
                <Youtube className="w-3 h-3" /> YouTube
              </Badge>
              <Badge variant="outline" className="gap-1">
                <Bot className="w-3 h-3" /> AI Queries
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              Entity Research
            </CardTitle>
            <CardDescription>
              Research a person, organization, or company
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <Input
                  placeholder="Enter name (e.g., John Smith, EPA, Acme Corp)"
                  value={entityName}
                  onChange={(e) => setEntityName(e.target.value)}
                  data-testid="input-entity-name"
                />
              </div>
              <Select value={entityType} onValueChange={(v: any) => setEntityType(v)}>
                <SelectTrigger data-testid="select-entity-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="person">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4" /> Person
                    </div>
                  </SelectItem>
                  <SelectItem value="organization">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4" /> Organization
                    </div>
                  </SelectItem>
                  <SelectItem value="company">
                    <div className="flex items-center gap-2">
                      <Briefcase className="w-4 h-4" /> Company
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={handleEntityResearch}
              disabled={!entityName.trim() || entityResearchMutation.isPending}
              data-testid="button-research-entity"
            >
              {entityResearchMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Researching...
                </>
              ) : (
                <>
                  <Bot className="w-4 h-4 mr-2" />
                  Research Entity
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Research Results</span>
              {matters.length > 0 && searchResults.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-normal text-muted-foreground">Save to:</span>
                  <Select value={selectedMatterId} onValueChange={setSelectedMatterId}>
                    <SelectTrigger className="w-[200px]" data-testid="select-save-matter">
                      <SelectValue placeholder="Select matter..." />
                    </SelectTrigger>
                    <SelectContent>
                      {matters.map((m) => (
                        <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </CardTitle>
            <CardDescription>
              Your extracted content and research findings
            </CardDescription>
          </CardHeader>
          <CardContent>
            {searchResults.length === 0 ? (
              <div className="text-center py-12">
                <Search className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground">No results yet</p>
                <p className="text-sm text-muted-foreground">
                  Search for content or research entities to see results here
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {searchResults.map((result) => (
                  <div 
                    key={result.id} 
                    className="flex items-start gap-3 p-4 border rounded-lg hover-elevate"
                    data-testid={`result-${result.id}`}
                  >
                    {result.type === "youtube" ? (
                      <Youtube className="w-5 h-5 text-red-500 mt-1 flex-shrink-0" />
                    ) : result.type === "entity" || result.type === "query" ? (
                      <Bot className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                    ) : (
                      <Globe className="w-5 h-5 text-blue-500 mt-1 flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">{result.title}</p>
                      <p className="text-sm text-muted-foreground line-clamp-3 mt-1">
                        {result.content}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="secondary" className="text-xs">{result.type}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {result.timestamp.toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setIsSheetOpen(true);
                        setChatInput(`Tell me more about: ${result.title}`);
                      }}
                      data-testid={`button-chat-result-${result.id}`}
                    >
                      <MessageSquare className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
