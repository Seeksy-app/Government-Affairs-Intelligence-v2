import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Folder, FileText, ArrowLeft, Building2, Calendar, MapPin, Phone,
  MessageCircle, X, Send, Bot, User, Loader2, Newspaper, Gavel,
  TrendingUp, ExternalLink, Clock, Star, BarChart3, FileSearch,
  Activity, AlertCircle, Rss
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

interface PortalInfo {
  id: string;
  name: string;
  description: string;
  clientName: string;
  clientLogo?: string;
  clientAddress?: string;
  clientPhone?: string;
}

interface PortalMatter {
  id: string;
  name: string;
  description: string;
  status: string;
}

interface PortalDocument {
  id: string;
  title: string;
  type: string;
  summary: string;
  createdAt: string;
}

interface PortalNews {
  id: string;
  title: string;
  summary: string;
  source: string;
  url: string;
  relevanceScore: number;
  publishedAt: string;
  isRead: boolean;
}

interface PortalBill {
  id: string;
  billId: string;
  title: string;
  status: string;
  sponsor: string;
  chamber: string;
  congress: number;
  priority: string;
  lastActionDate: string;
}

interface PortalStats {
  totalMatters: number;
  totalFeeds: number;
  totalBills: number;
  recentArticles: number;
  highPriorityBills: number;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface Conversation {
  id: string;
  title: string;
  createdAt: string;
}

export default function PublicPortal() {
  const params = useParams<{ clientSlug: string; portalSlug: string }>();
  const [selectedMatter, setSelectedMatter] = useState<PortalMatter | null>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [activeConversation, setActiveConversation] = useState<string | null>(null);
  const [streamingMessage, setStreamingMessage] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [pendingUserMessage, setPendingUserMessage] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const baseUrl = `/api/public/portal/${params.clientSlug}/${params.portalSlug}`;

  const { data: portal, isLoading: portalLoading, error: portalError } = useQuery<PortalInfo>({
    queryKey: ["/api/public/portal", params.clientSlug, params.portalSlug],
    queryFn: async () => {
      const res = await fetch(`${baseUrl}`);
      if (!res.ok) throw new Error("Portal not found");
      return res.json();
    },
  });

  const { data: stats, isLoading: statsLoading } = useQuery<PortalStats>({
    queryKey: ["/api/public/portal", params.clientSlug, params.portalSlug, "stats"],
    queryFn: async () => {
      const res = await fetch(`${baseUrl}/stats`);
      if (!res.ok) return { totalMatters: 0, totalFeeds: 0, totalBills: 0, recentArticles: 0, highPriorityBills: 0 };
      return res.json();
    },
    enabled: !!portal,
  });

  const { data: matters = [], isLoading: mattersLoading } = useQuery<PortalMatter[]>({
    queryKey: ["/api/public/portal", params.clientSlug, params.portalSlug, "matters"],
    queryFn: async () => {
      const res = await fetch(`${baseUrl}/matters`);
      if (!res.ok) throw new Error("Failed to load matters");
      return res.json();
    },
    enabled: !!portal,
  });

  const { data: news = [], isLoading: newsLoading } = useQuery<PortalNews[]>({
    queryKey: ["/api/public/portal", params.clientSlug, params.portalSlug, "news"],
    queryFn: async () => {
      const res = await fetch(`${baseUrl}/news`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!portal,
  });

  const { data: bills = [], isLoading: billsLoading } = useQuery<PortalBill[]>({
    queryKey: ["/api/public/portal", params.clientSlug, params.portalSlug, "bills"],
    queryFn: async () => {
      const res = await fetch(`${baseUrl}/bills`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!portal,
  });

  const { data: documents = [] } = useQuery<PortalDocument[]>({
    queryKey: ["/api/public/portal", params.clientSlug, params.portalSlug, "matters", selectedMatter?.id, "documents"],
    queryFn: async () => {
      const res = await fetch(`${baseUrl}/matters/${selectedMatter!.id}/documents`);
      if (!res.ok) throw new Error("Failed to load documents");
      return res.json();
    },
    enabled: !!selectedMatter,
  });

  const { data: messages = [], refetch: refetchMessages } = useQuery<ChatMessage[]>({
    queryKey: ["/api/public/portal", params.clientSlug, params.portalSlug, "conversations", activeConversation, "messages"],
    queryFn: async () => {
      const res = await fetch(`${baseUrl}/conversations/${activeConversation}/messages`);
      if (!res.ok) throw new Error("Failed to load messages");
      return res.json();
    },
    enabled: !!activeConversation,
  });

  const createConversationMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${baseUrl}/conversations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "New Conversation" }),
      });
      if (!res.ok) throw new Error("Failed to create conversation");
      return res.json();
    },
    onSuccess: (data: Conversation) => {
      setActiveConversation(data.id);
    },
  });

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, streamingMessage, pendingUserMessage]);

  const sendMessage = async () => {
    if (!chatInput.trim() || isStreaming) return;
    
    let convId = activeConversation;
    
    if (!convId) {
      const newConv = await createConversationMutation.mutateAsync();
      convId = newConv.id;
    }

    const userMessage = chatInput;
    setChatInput("");
    setPendingUserMessage(userMessage);
    setIsStreaming(true);
    setStreamingMessage("");

    try {
      const response = await fetch(`${baseUrl}/conversations/${convId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMessage }),
      });

      if (!response.ok) throw new Error("Chat failed");

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let fullMessage = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") continue;
            try {
              const parsed = JSON.parse(data);
              if (parsed.content) {
                fullMessage += parsed.content;
                setStreamingMessage(fullMessage);
              }
            } catch {}
          }
        }
      }

      await refetchMessages();
    } catch (error) {
      console.error("Chat error:", error);
    } finally {
      setIsStreaming(false);
      setStreamingMessage("");
      setPendingUserMessage(null);
    }
  };

  if (portalLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Loading your portal...</p>
        </div>
      </div>
    );
  }

  if (portalError || !portal) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="py-12 text-center">
            <AlertCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-xl font-semibold mb-2">Portal Not Found</p>
            <p className="text-muted-foreground">The portal you're looking for doesn't exist or is no longer available.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const ChatPanel = () => (
    <div className="fixed bottom-4 right-4 z-50 w-96 max-w-[calc(100vw-2rem)]">
      <Card className="shadow-xl border-2">
        <CardHeader className="py-3 px-4 border-b flex flex-row items-center justify-between gap-2 bg-primary/5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
              <Bot className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <CardTitle className="text-base">AI Research Assistant</CardTitle>
              <p className="text-xs text-muted-foreground">Ask questions about your research</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setIsChatOpen(false)} data-testid="button-close-chat">
            <X className="w-4 h-4" />
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-80 p-4">
            {messages.length === 0 && !streamingMessage && !pendingUserMessage && (
              <div className="text-center text-muted-foreground py-8">
                <Bot className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm font-medium">How can I help you today?</p>
                <p className="text-xs mt-1">Ask me anything about your research documents and briefings.</p>
              </div>
            )}
            <div className="space-y-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  data-testid={`chat-message-${msg.role}-${msg.id}`}
                  className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {msg.role === "assistant" && (
                    <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center shrink-0">
                      <Bot className="w-4 h-4 text-primary-foreground" />
                    </div>
                  )}
                  <div
                    className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    {msg.content}
                  </div>
                  {msg.role === "user" && (
                    <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center shrink-0">
                      <User className="w-4 h-4" />
                    </div>
                  )}
                </div>
              ))}
              {pendingUserMessage && (
                <div className="flex gap-2 justify-end" data-testid="chat-message-pending">
                  <div className="max-w-[80%] rounded-lg px-3 py-2 text-sm bg-primary text-primary-foreground">
                    {pendingUserMessage}
                  </div>
                  <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <User className="w-4 h-4" />
                  </div>
                </div>
              )}
              {streamingMessage && (
                <div className="flex gap-2 justify-start" data-testid="chat-message-streaming">
                  <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center shrink-0">
                    <Bot className="w-4 h-4 text-primary-foreground" />
                  </div>
                  <div className="max-w-[80%] rounded-lg px-3 py-2 text-sm bg-muted">
                    {streamingMessage}
                  </div>
                </div>
              )}
              {isStreaming && !streamingMessage && (
                <div className="flex gap-2 justify-start" data-testid="chat-loading">
                  <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center shrink-0">
                    <Bot className="w-4 h-4 text-primary-foreground" />
                  </div>
                  <div className="rounded-lg px-3 py-2 bg-muted">
                    <Loader2 className="w-4 h-4 animate-spin" />
                  </div>
                </div>
              )}
            </div>
            <div ref={chatEndRef} />
          </ScrollArea>
          <div className="p-3 border-t flex gap-2">
            <Input
              placeholder="Ask a question..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
              disabled={isStreaming}
              data-testid="input-chat-message"
            />
            <Button
              size="icon"
              onClick={sendMessage}
              disabled={!chatInput.trim() || isStreaming}
              data-testid="button-send-chat"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // Document detail view
  if (selectedMatter) {
    return (
      <div className="min-h-screen bg-background">
        <div className="border-b bg-card">
          <div className="container mx-auto py-4">
            <Button variant="ghost" onClick={() => setSelectedMatter(null)} data-testid="button-back-to-matters">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
          </div>
        </div>

        <div className="container mx-auto py-8 space-y-6">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Folder className="w-6 h-6 text-primary" />
                {selectedMatter.name}
              </h1>
              {selectedMatter.description && (
                <p className="text-muted-foreground mt-1">{selectedMatter.description}</p>
              )}
            </div>
            <Badge variant={selectedMatter.status === "active" ? "default" : "secondary"}>
              {selectedMatter.status}
            </Badge>
          </div>

          <div className="space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Research Documents
            </h2>
            {documents.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <FileSearch className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground">No documents available yet</p>
                  <p className="text-sm text-muted-foreground mt-1">Documents will appear here when your team shares them.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {documents.map((doc) => (
                  <Card key={doc.id} className="hover-elevate" data-testid={`document-${doc.id}`}>
                    <CardHeader>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <CardTitle className="text-base flex items-center gap-2">
                            <FileText className="w-4 h-4 text-primary" />
                            {doc.title}
                          </CardTitle>
                          <CardDescription className="mt-2 line-clamp-2">{doc.summary}</CardDescription>
                        </div>
                        <Badge variant="outline">{doc.type}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="w-4 h-4" />
                        {format(new Date(doc.createdAt), "MMM d, yyyy")}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>

        {!isChatOpen && (
          <Button
            className="fixed bottom-4 right-4 rounded-full shadow-lg"
            size="lg"
            onClick={() => setIsChatOpen(true)}
            data-testid="button-open-chat"
          >
            <MessageCircle className="w-5 h-5 mr-2" />
            Ask AI
          </Button>
        )}
        {isChatOpen && <ChatPanel />}
      </div>
    );
  }

  // Main Dashboard View
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="container mx-auto py-6">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              {portal.clientLogo ? (
                <img 
                  src={portal.clientLogo} 
                  alt={portal.clientName} 
                  className="w-16 h-16 object-contain rounded-lg border"
                />
              ) : (
                <div className="w-16 h-16 bg-primary/10 rounded-lg flex items-center justify-center">
                  <Building2 className="w-8 h-8 text-primary" />
                </div>
              )}
              <div>
                <h1 className="text-2xl font-bold" data-testid="text-portal-client-name">{portal.clientName}</h1>
                <p className="text-muted-foreground flex items-center gap-1">
                  <Star className="w-4 h-4" />
                  {portal.name}
                </p>
              </div>
            </div>
            <div className="text-right text-sm text-muted-foreground space-y-1">
              {portal.clientAddress && (
                <div className="flex items-center gap-2 justify-end">
                  <MapPin className="w-4 h-4" />
                  <span>{portal.clientAddress}</span>
                </div>
              )}
              {portal.clientPhone && (
                <div className="flex items-center gap-2 justify-end">
                  <Phone className="w-4 h-4" />
                  <span>{portal.clientPhone}</span>
                </div>
              )}
              <div className="flex items-center gap-2 justify-end">
                <Clock className="w-4 h-4" />
                <span>{format(new Date(), "EEEE, MMMM d, yyyy")}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="container mx-auto py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
            <TabsTrigger value="overview" data-testid="tab-overview">
              <BarChart3 className="w-4 h-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="news" data-testid="tab-news">
              <Newspaper className="w-4 h-4 mr-2" />
              News
            </TabsTrigger>
            <TabsTrigger value="bills" data-testid="tab-bills">
              <Gavel className="w-4 h-4 mr-2" />
              Bills
            </TabsTrigger>
            <TabsTrigger value="research" data-testid="tab-research">
              <Folder className="w-4 h-4 mr-2" />
              Research
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Stats Cards */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2 gap-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Research Matters</CardTitle>
                  <Folder className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats?.totalMatters ?? matters.length}</div>
                  <p className="text-xs text-muted-foreground">Active research projects</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2 gap-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">News Sources</CardTitle>
                  <Rss className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats?.totalFeeds ?? 0}</div>
                  <p className="text-xs text-muted-foreground">Assigned feeds</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2 gap-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Tracked Bills</CardTitle>
                  <Gavel className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats?.totalBills ?? bills.length}</div>
                  <p className="text-xs text-muted-foreground">
                    {stats?.highPriorityBills ? `${stats.highPriorityBills} high priority` : "Legislative tracking"}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2 gap-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Today's News</CardTitle>
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats?.recentArticles ?? 0}</div>
                  <p className="text-xs text-muted-foreground">Articles in last 24h</p>
                </CardContent>
              </Card>
            </div>

            {/* Quick Sections */}
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Recent News */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2">
                  <CardTitle className="flex items-center gap-2">
                    <Newspaper className="w-5 h-5" />
                    Recent News
                  </CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => setActiveTab("news")}>
                    View All
                  </Button>
                </CardHeader>
                <CardContent>
                  {news.length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground">
                      <Newspaper className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No news articles yet</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {news.slice(0, 3).map((article) => (
                        <div key={article.id} className="border-b last:border-0 pb-3 last:pb-0">
                          <a 
                            href={article.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="font-medium text-sm hover:text-primary line-clamp-2"
                          >
                            {article.title}
                          </a>
                          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                            <span>{article.source}</span>
                            <span>•</span>
                            <span>{article.publishedAt ? formatDistanceToNow(new Date(article.publishedAt), { addSuffix: true }) : ""}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Tracked Bills */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2">
                  <CardTitle className="flex items-center gap-2">
                    <Gavel className="w-5 h-5" />
                    Tracked Bills
                  </CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => setActiveTab("bills")}>
                    View All
                  </Button>
                </CardHeader>
                <CardContent>
                  {bills.length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground">
                      <Gavel className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No bills being tracked</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {bills.slice(0, 3).map((bill) => (
                        <div key={bill.id} className="border-b last:border-0 pb-3 last:pb-0">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="font-medium text-sm">{bill.billId}</p>
                              <p className="text-xs text-muted-foreground line-clamp-1">{bill.title}</p>
                            </div>
                            <Badge variant={bill.priority === "high" ? "destructive" : bill.priority === "medium" ? "default" : "secondary"} className="text-xs shrink-0">
                              {bill.priority}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Portal Description */}
            {portal.description && (
              <Card>
                <CardContent className="py-4">
                  <p className="text-muted-foreground">{portal.description}</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* News Tab */}
          <TabsContent value="news" className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="text-lg font-semibold">News Feed</h2>
              <Badge variant="outline">{news.length} articles</Badge>
            </div>
            
            {newsLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Card key={i}>
                    <CardContent className="py-4 space-y-3">
                      <Skeleton className="h-5 w-3/4" />
                      <Skeleton className="h-4 w-full" />
                      <div className="flex gap-2">
                        <Skeleton className="h-5 w-20" />
                        <Skeleton className="h-5 w-24" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : news.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Newspaper className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="text-lg font-medium">No news articles available</p>
                  <p className="text-muted-foreground text-sm mt-1">News from your assigned sources will appear here.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {news.map((article) => (
                  <Card key={article.id} className="hover-elevate" data-testid={`news-article-${article.id}`}>
                    <CardContent className="py-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <a 
                            href={article.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="font-medium hover:text-primary flex items-center gap-2"
                          >
                            {article.title}
                            <ExternalLink className="w-4 h-4 shrink-0" />
                          </a>
                          {article.summary && (
                            <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{article.summary}</p>
                          )}
                          <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
                            <Badge variant="outline">{article.source}</Badge>
                            {article.publishedAt && (
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {formatDistanceToNow(new Date(article.publishedAt), { addSuffix: true })}
                              </span>
                            )}
                            {article.relevanceScore > 0 && (
                              <span className="flex items-center gap-1">
                                <TrendingUp className="w-3 h-3" />
                                {article.relevanceScore}% relevance
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Bills Tab */}
          <TabsContent value="bills" className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="text-lg font-semibold">Tracked Legislation</h2>
              <Badge variant="outline">{bills.length} bills</Badge>
            </div>
            
            {billsLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Card key={i}>
                    <CardContent className="py-4 space-y-3">
                      <Skeleton className="h-5 w-1/2" />
                      <Skeleton className="h-4 w-full" />
                      <div className="flex gap-2">
                        <Skeleton className="h-5 w-16" />
                        <Skeleton className="h-5 w-16" />
                        <Skeleton className="h-5 w-20" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : bills.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Gavel className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="text-lg font-medium">No bills being tracked</p>
                  <p className="text-muted-foreground text-sm mt-1">Legislation relevant to your interests will appear here.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {bills.map((bill) => (
                  <Card key={bill.id} className="hover-elevate" data-testid={`bill-${bill.id}`}>
                    <CardContent className="py-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-bold">{bill.billId}</span>
                            <Badge variant="outline" className="text-xs">{bill.chamber}</Badge>
                            <Badge 
                              variant={bill.priority === "high" ? "destructive" : bill.priority === "medium" ? "default" : "secondary"}
                              className="text-xs"
                            >
                              {bill.priority} priority
                            </Badge>
                          </div>
                          <p className="text-sm">{bill.title}</p>
                          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                            <span>Sponsor: {bill.sponsor}</span>
                            <span>Status: {bill.status}</span>
                            {bill.lastActionDate && (
                              <span>Last action: {format(new Date(bill.lastActionDate), "MMM d, yyyy")}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Research Tab */}
          <TabsContent value="research" className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="text-lg font-semibold">Research Matters</h2>
              <Badge variant="outline">{matters.length} matters</Badge>
            </div>
            
            {mattersLoading ? (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => (
                  <Card key={i}>
                    <CardHeader className="space-y-2">
                      <Skeleton className="h-5 w-3/4" />
                      <Skeleton className="h-4 w-full" />
                    </CardHeader>
                    <CardContent>
                      <Skeleton className="h-5 w-16" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : matters.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Folder className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="text-lg font-medium">No research available</p>
                  <p className="text-muted-foreground text-sm mt-1">Research documents and briefings will appear here when shared.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {matters.map((matter) => (
                  <Card 
                    key={matter.id} 
                    className="cursor-pointer hover-elevate"
                    onClick={() => setSelectedMatter(matter)}
                    data-testid={`matter-${matter.id}`}
                  >
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Folder className="w-5 h-5 text-primary" />
                        {matter.name}
                      </CardTitle>
                      {matter.description && (
                        <CardDescription className="line-clamp-2">{matter.description}</CardDescription>
                      )}
                    </CardHeader>
                    <CardContent>
                      <Badge variant={matter.status === "active" ? "default" : "secondary"}>
                        {matter.status}
                      </Badge>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Footer */}
      <footer className="border-t mt-12 bg-card">
        <div className="container mx-auto py-6 text-center text-sm text-muted-foreground">
          <p>Powered by Political Intelligence Platform</p>
          <p className="text-xs mt-1">Secure client portal for {portal.clientName}</p>
        </div>
      </footer>

      {/* AI Chat FAB */}
      {!isChatOpen && (
        <Button
          className="fixed bottom-4 right-4 rounded-full shadow-lg h-14 w-14"
          size="icon"
          onClick={() => setIsChatOpen(true)}
          data-testid="button-open-chat"
        >
          <MessageCircle className="w-6 h-6" />
        </Button>
      )}
      {isChatOpen && <ChatPanel />}
    </div>
  );
}
