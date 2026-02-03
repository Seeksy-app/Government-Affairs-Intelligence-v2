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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Bot, Send, Globe, Youtube, User, Building2, Briefcase, Loader2, MessageSquare, Sparkles, Search, History, ArrowRight, Video, Radio, FileText, ExternalLink, Clock, Bookmark, RefreshCw } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

interface TranscriptSource {
  name: string;
  url: string;
  description: string;
}

interface YoutubeWatchItem {
  id: string;
  videoUrl: string;
  videoId: string;
  title: string | null;
  channelName: string | null;
  status: string;
  transcriptAvailable: boolean;
  createdAt: string;
}

interface CongressBill {
  congress: number;
  type: string;
  number: number;
  title: string;
  introducedDate: string;
  latestAction?: {
    actionDate: string;
    text: string;
  };
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
  const [youtubeDialogOpen, setYoutubeDialogOpen] = useState(false);
  const [webDialogOpen, setWebDialogOpen] = useState(false);
  const [queryDialogOpen, setQueryDialogOpen] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [webUrl, setWebUrl] = useState("");
  const [queryText, setQueryText] = useState("");
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    const saved = localStorage.getItem("ai-agent-recent-searches");
    return saved ? JSON.parse(saved) : [];
  });

  const { data: matters = [] } = useQuery<Matter[]>({
    queryKey: ["/api/matters"],
  });

  const { data: transcriptSources = [] } = useQuery<TranscriptSource[]>({
    queryKey: ["/api/transcript-sources"],
  });

  const { data: watchList = [], refetch: refetchWatchList } = useQuery<YoutubeWatchItem[]>({
    queryKey: ["/api/youtube-watchlist"],
  });

  const [billSearch, setBillSearch] = useState("");
  const [billResults, setBillResults] = useState<CongressBill[]>([]);
  const [billSearchLoading, setBillSearchLoading] = useState(false);

  const searchBills = async () => {
    if (!billSearch.trim()) return;
    setBillSearchLoading(true);
    try {
      const res = await apiRequest("GET", `/api/bills/search?keyword=${encodeURIComponent(billSearch)}&limit=10`);
      const data = await res.json();
      setBillResults(data.bills || []);
    } catch (error) {
      toast({ title: "Error", description: "Failed to search bills", variant: "destructive" });
    } finally {
      setBillSearchLoading(false);
    }
  };

  const addToWatchList = useMutation({
    mutationFn: async (data: { videoUrl: string; title?: string }) => {
      const res = await apiRequest("POST", "/api/youtube-watchlist", data);
      return res.json();
    },
    onSuccess: () => {
      refetchWatchList();
      toast({ title: "Added to watch list" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to add to watch list", variant: "destructive" });
    },
  });

  const checkWatchList = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/youtube-watchlist/check");
      return res.json();
    },
    onSuccess: (data) => {
      refetchWatchList();
      toast({
        title: "Check complete",
        description: `${data.processed} transcripts now available, ${data.stillPending} still pending`,
      });
    },
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
                                data-testid={`recent-search-${i}`}
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
                              data-testid={`suggested-prompt-${i}`}
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
                            data-testid={`chat-message-${i}`}
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
                      data-testid="input-chat"
                    />
                  </div>
                  <Button
                    size="icon"
                    onClick={handleChatSubmit}
                    disabled={!chatInput.trim() || chatMutation.isPending}
                    className="shrink-0"
                    data-testid="button-send-chat"
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
                    data-testid="button-clear-chat"
                  >
                    Clear conversation
                  </Button>
                )}
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
            <div className="flex gap-2 text-sm">
              <Badge 
                variant="outline" 
                className="gap-1 cursor-pointer hover-elevate"
                onClick={() => setWebDialogOpen(true)}
                data-testid="badge-web-pages"
              >
                <Globe className="w-3 h-3" /> Web Pages
              </Badge>
              <Badge 
                variant="outline" 
                className="gap-1 cursor-pointer hover-elevate"
                onClick={() => setYoutubeDialogOpen(true)}
                data-testid="badge-youtube"
              >
                <Youtube className="w-3 h-3" /> YouTube
              </Badge>
              <Badge 
                variant="outline" 
                className="gap-1 cursor-pointer hover-elevate"
                onClick={() => setQueryDialogOpen(true)}
                data-testid="badge-ai-queries"
              >
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

        {/* Bills Search & Transcript Sources */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Congressional Bills & Transcripts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="bills" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="bills" data-testid="tab-bills">Bills</TabsTrigger>
                <TabsTrigger value="transcripts" data-testid="tab-transcripts">Transcripts</TabsTrigger>
                <TabsTrigger value="watchlist" data-testid="tab-watchlist">
                  Watch List
                  {watchList.filter(w => w.status === "pending").length > 0 && (
                    <Badge variant="secondary" className="ml-1">
                      {watchList.filter(w => w.status === "pending").length}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="bills" className="space-y-4 pt-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="Search bills by keyword (e.g., climate, healthcare, defense)"
                    value={billSearch}
                    onChange={(e) => setBillSearch(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && searchBills()}
                    data-testid="input-bill-search"
                  />
                  <Button onClick={searchBills} disabled={billSearchLoading} data-testid="button-search-bills">
                    {billSearchLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Search the 119th Congress (2025-2026) bills from Congress.gov
                </p>
                {billResults.length > 0 && (
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {billResults.map((bill) => (
                      <div key={`${bill.type}-${bill.number}`} className="p-3 border rounded-md space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{bill.type.toUpperCase()}.{bill.number}</Badge>
                          <span className="text-xs text-muted-foreground">{bill.introducedDate}</span>
                        </div>
                        <p className="text-sm line-clamp-2">{bill.title}</p>
                        {bill.latestAction && (
                          <p className="text-xs text-muted-foreground">
                            Latest: {bill.latestAction.text}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="transcripts" className="space-y-4 pt-4">
                <p className="text-sm text-muted-foreground">
                  Quick links to official transcript and video sources
                </p>
                <div className="grid gap-2">
                  {transcriptSources.map((source) => (
                    <a
                      key={source.name}
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between p-3 border rounded-md hover-elevate"
                      data-testid={`link-source-${source.name.toLowerCase().replace(/\s+/g, '-')}`}
                    >
                      <div className="space-y-0.5">
                        <p className="text-sm font-medium">{source.name}</p>
                        <p className="text-xs text-muted-foreground">{source.description}</p>
                      </div>
                      <ExternalLink className="w-4 h-4 text-muted-foreground" />
                    </a>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="watchlist" className="space-y-4 pt-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Videos waiting for transcripts to become available
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => checkWatchList.mutate()}
                    disabled={checkWatchList.isPending}
                    data-testid="button-check-watchlist"
                  >
                    {checkWatchList.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <RefreshCw className="w-4 h-4 mr-2" />
                    )}
                    Check Now
                  </Button>
                </div>
                {watchList.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">
                    No videos in watch list. Add YouTube URLs that don't have captions yet.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {watchList.map((item) => (
                      <div key={item.id} className="flex items-center justify-between p-3 border rounded-md">
                        <div className="flex items-center gap-3">
                          <Youtube className={`w-5 h-5 ${item.status === "completed" ? "text-green-500" : "text-amber-500"}`} />
                          <div>
                            <p className="text-sm">{item.title || item.videoId}</p>
                            <div className="flex items-center gap-2">
                              <Badge variant={item.status === "completed" ? "default" : "secondary"} className="text-xs">
                                {item.status}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {new Date(item.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        </div>
                        <a
                          href={item.videoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
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

      {/* YouTube Dialog */}
      <Dialog open={youtubeDialogOpen} onOpenChange={setYoutubeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Youtube className="w-5 h-5 text-red-500" />
              Extract YouTube Video
            </DialogTitle>
            <DialogDescription>
              Enter a YouTube URL to extract the video transcript
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Input
              placeholder="https://www.youtube.com/watch?v=..."
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              data-testid="input-youtube-url"
            />
            <div className="text-sm text-muted-foreground space-y-2">
              <p className="flex items-center gap-2">
                <Video className="w-4 h-4" />
                Works with regular YouTube videos that have captions
              </p>
              <p className="flex items-center gap-2">
                <Radio className="w-4 h-4" />
                <span className="text-amber-600 dark:text-amber-400">
                  Live streams: Add to Watch List and check back later
                </span>
              </p>
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setYoutubeDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                if (youtubeUrl) {
                  addToWatchList.mutate({ videoUrl: youtubeUrl });
                  setYoutubeDialogOpen(false);
                  setYoutubeUrl("");
                }
              }}
              disabled={!youtubeUrl || addToWatchList.isPending}
              data-testid="button-add-to-watchlist"
            >
              {addToWatchList.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Clock className="w-4 h-4 mr-2" />
              )}
              Add to Watch List
            </Button>
            <Button
              onClick={() => {
                if (youtubeUrl) {
                  urlSearchMutation.mutate(youtubeUrl);
                  setYoutubeDialogOpen(false);
                  setYoutubeUrl("");
                }
              }}
              disabled={!youtubeUrl || urlSearchMutation.isPending}
              data-testid="button-extract-youtube"
            >
              {urlSearchMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Youtube className="w-4 h-4 mr-2" />
              )}
              Extract Transcript
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Web Page Dialog */}
      <Dialog open={webDialogOpen} onOpenChange={setWebDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-blue-500" />
              Extract Web Page
            </DialogTitle>
            <DialogDescription>
              Enter a URL to extract the page content
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Input
              placeholder="https://example.com/article"
              value={webUrl}
              onChange={(e) => setWebUrl(e.target.value)}
              data-testid="input-web-url"
            />
            <div className="text-sm text-muted-foreground">
              Supports news articles, government websites, press releases, and more
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWebDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (webUrl) {
                  urlSearchMutation.mutate(webUrl);
                  setWebDialogOpen(false);
                  setWebUrl("");
                }
              }}
              disabled={!webUrl || urlSearchMutation.isPending}
              data-testid="button-extract-web"
            >
              {urlSearchMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Globe className="w-4 h-4 mr-2" />
              )}
              Extract Content
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI Query Dialog */}
      <Dialog open={queryDialogOpen} onOpenChange={setQueryDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-primary" />
              AI Research Query
            </DialogTitle>
            <DialogDescription>
              Ask the AI to research any topic
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Textarea
              placeholder="e.g., Find recent lobbying activities related to healthcare reform..."
              value={queryText}
              onChange={(e) => setQueryText(e.target.value)}
              className="min-h-[100px]"
              data-testid="input-ai-query"
            />
            <div className="text-sm text-muted-foreground">
              The AI will search the web and compile research on your topic
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQueryDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (queryText) {
                  queryMutation.mutate(queryText);
                  setQueryDialogOpen(false);
                  setQueryText("");
                }
              }}
              disabled={!queryText || queryMutation.isPending}
              data-testid="button-run-ai-query"
            >
              {queryMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Bot className="w-4 h-4 mr-2" />
              )}
              Run Query
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
