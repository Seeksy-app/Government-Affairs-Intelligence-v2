import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import {
  ArrowLeft,
  Plus,
  Link as LinkIcon,
  FileText,
  Trash2,
  Send,
  Loader2,
  MessageCircle,
  Globe,
  Youtube,
  File,
  Search,
  User,
  Building,
  Building2,
  Bot,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Matter, ResearchDocument, ResearchConversation, ResearchMessage } from "@shared/schema";

function getDocTypeIcon(type: string) {
  switch (type) {
    case "youtube":
      return <Youtube className="h-4 w-4 text-red-500" />;
    case "url":
      return <Globe className="h-4 w-4 text-blue-500" />;
    case "pdf":
    case "docx":
      return <File className="h-4 w-4 text-orange-500" />;
    case "agent":
    case "extract":
      return <Sparkles className="h-4 w-4 text-purple-500" />;
    default:
      return <FileText className="h-4 w-4" />;
  }
}

export default function MatterDetailPage() {
  const params = useParams();
  const matterId = params.id as string;
  const { toast } = useToast();

  const [isAddUrlOpen, setIsAddUrlOpen] = useState(false);
  const [isAgentResearchOpen, setIsAgentResearchOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [isExtracting, setIsExtracting] = useState(false);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState("");
  const [streamingResponse, setStreamingResponse] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [entityName, setEntityName] = useState("");
  const [entityType, setEntityType] = useState<"person" | "organization" | "company">("person");
  const [agentPrompt, setAgentPrompt] = useState("");
  const [extractUrls, setExtractUrls] = useState("");
  const [extractPrompt, setExtractPrompt] = useState("");
  const [isResearching, setIsResearching] = useState(false);

  const { data: matter } = useQuery<Matter>({
    queryKey: ["/api/matters", matterId],
  });

  const { data: documents = [] } = useQuery<ResearchDocument[]>({
    queryKey: ["/api/matters", matterId, "documents"],
  });

  const { data: conversations = [] } = useQuery<ResearchConversation[]>({
    queryKey: ["/api/matters", matterId, "conversations"],
  });

  const { data: messages = [] } = useQuery<ResearchMessage[]>({
    queryKey: ["/api/conversations", selectedConversation, "messages"],
    enabled: !!selectedConversation,
  });

  const addDocument = useMutation({
    mutationFn: async (docUrl: string) => {
      setIsExtracting(true);
      const res = await apiRequest("POST", `/api/matters/${matterId}/documents/url`, { url: docUrl });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/matters", matterId, "documents"] });
      setIsAddUrlOpen(false);
      setUrl("");
      setIsExtracting(false);
      toast({ title: "Document added successfully" });
    },
    onError: (error: Error) => {
      setIsExtracting(false);
      toast({ title: "Failed to extract content", description: error.message, variant: "destructive" });
    },
  });

  const deleteDocument = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/documents/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/matters", matterId, "documents"] });
      toast({ title: "Document deleted" });
    },
  });

  const researchEntity = useMutation({
    mutationFn: async ({ name, type }: { name: string; type: string }) => {
      setIsResearching(true);
      const res = await apiRequest("POST", `/api/matters/${matterId}/research/entity`, {
        entityName: name,
        entityType: type,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/matters", matterId, "documents"] });
      setIsAgentResearchOpen(false);
      setEntityName("");
      setIsResearching(false);
      toast({ title: "Entity research completed" });
    },
    onError: (error: Error) => {
      setIsResearching(false);
      toast({ title: "Research failed", description: error.message, variant: "destructive" });
    },
  });

  const runAgentQuery = useMutation({
    mutationFn: async (prompt: string) => {
      setIsResearching(true);
      const res = await apiRequest("POST", `/api/matters/${matterId}/research/agent-query`, { prompt });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/matters", matterId, "documents"] });
      setIsAgentResearchOpen(false);
      setAgentPrompt("");
      setIsResearching(false);
      toast({ title: "Agent research completed" });
    },
    onError: (error: Error) => {
      setIsResearching(false);
      toast({ title: "Agent query failed", description: error.message, variant: "destructive" });
    },
  });

  const extractStructuredData = useMutation({
    mutationFn: async ({ urls, prompt }: { urls: string[]; prompt: string }) => {
      setIsResearching(true);
      const res = await apiRequest("POST", `/api/matters/${matterId}/research/extract`, { urls, prompt });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/matters", matterId, "documents"] });
      setIsAgentResearchOpen(false);
      setExtractUrls("");
      setExtractPrompt("");
      setIsResearching(false);
      toast({ title: "Data extraction completed" });
    },
    onError: (error: Error) => {
      setIsResearching(false);
      toast({ title: "Extraction failed", description: error.message, variant: "destructive" });
    },
  });

  const createConversation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/matters/${matterId}/conversations`, {
        title: `Research Session ${new Date().toLocaleDateString()}`,
      });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/matters", matterId, "conversations"] });
      setSelectedConversation(data.id);
    },
  });

  const sendMessage = async () => {
    if (!messageInput.trim() || !selectedConversation || isStreaming) return;

    const question = messageInput;
    setMessageInput("");
    setIsStreaming(true);
    setStreamingResponse("");

    try {
      const response = await fetch(`/api/conversations/${selectedConversation}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ question }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error("Chat API error:", response.status, errorData);
        throw new Error(`Chat failed: ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const text = decoder.decode(value);
          const lines = text.split("\n");

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.content) {
                  setStreamingResponse((prev) => prev + data.content);
                }
                if (data.done) {
                  setStreamingResponse("");
                  queryClient.invalidateQueries({
                    queryKey: ["/api/conversations", selectedConversation, "messages"],
                  });
                }
              } catch {}
            }
          }
        }
      }
    } catch (error) {
      toast({ title: "Failed to send message", variant: "destructive" });
    } finally {
      setIsStreaming(false);
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingResponse]);

  if (!matter) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-48" />
          <div className="h-64 bg-muted rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      <div className="w-80 border-r flex flex-col">
        <div className="p-4 border-b">
          <Link href="/matters">
            <Button variant="ghost" size="sm" className="mb-2" data-testid="button-back-to-matters">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Matters
            </Button>
          </Link>
          <h2 className="font-semibold text-lg">{matter.name}</h2>
          {matter.description && (
            <p className="text-sm text-muted-foreground mt-1">{matter.description}</p>
          )}
        </div>

        <div className="p-4 border-b">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium">Research Documents</h3>
            <div className="flex gap-1">
              <Dialog open={isAgentResearchOpen} onOpenChange={setIsAgentResearchOpen}>
                <DialogTrigger asChild>
                  <Button size="icon" variant="ghost" title="AI Agent Research" data-testid="button-agent-research">
                    <Bot className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-purple-500" />
                      AI Agent Research
                    </DialogTitle>
                  </DialogHeader>
                  <Tabs defaultValue="entity" className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                      <TabsTrigger value="entity">Research Entity</TabsTrigger>
                      <TabsTrigger value="extract">Extract Data</TabsTrigger>
                      <TabsTrigger value="custom">Custom Query</TabsTrigger>
                    </TabsList>
                    <TabsContent value="entity" className="space-y-4 mt-4">
                      <p className="text-sm text-muted-foreground">
                        Use Firecrawl's AI agent to research a person, organization, or company and gather structured intelligence.
                      </p>
                      <div className="space-y-2">
                        <Label htmlFor="entityName">Entity Name</Label>
                        <Input
                          id="entityName"
                          data-testid="input-entity-name"
                          placeholder="e.g., John Smith, AIPAC, Amazon"
                          value={entityName}
                          onChange={(e) => setEntityName(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="entityType">Entity Type</Label>
                        <Select value={entityType} onValueChange={(v) => setEntityType(v as typeof entityType)}>
                          <SelectTrigger data-testid="select-entity-type">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="person">
                              <span className="flex items-center gap-2">
                                <User className="h-4 w-4" /> Person (Staffer, Lobbyist, Official)
                              </span>
                            </SelectItem>
                            <SelectItem value="organization">
                              <span className="flex items-center gap-2">
                                <Building className="h-4 w-4" /> Organization (PAC, Advocacy Group)
                              </span>
                            </SelectItem>
                            <SelectItem value="company">
                              <span className="flex items-center gap-2">
                                <Building2 className="h-4 w-4" /> Company (Corp, Business)
                              </span>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Button
                        className="w-full"
                        disabled={isResearching || !entityName}
                        onClick={() => researchEntity.mutate({ name: entityName, type: entityType })}
                        data-testid="button-submit-entity-research"
                      >
                        {isResearching ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Researching...
                          </>
                        ) : (
                          <>
                            <Search className="mr-2 h-4 w-4" />
                            Research Entity
                          </>
                        )}
                      </Button>
                    </TabsContent>
                    <TabsContent value="custom" className="space-y-4 mt-4">
                      <p className="text-sm text-muted-foreground">
                        Run a custom AI agent query to gather any information from the web.
                      </p>
                      <div className="space-y-2">
                        <Label htmlFor="agentPrompt">Research Query</Label>
                        <Textarea
                          id="agentPrompt"
                          data-testid="input-agent-prompt"
                          placeholder="e.g., Find all lobbying activity by tech companies on AI regulation in 2025"
                          value={agentPrompt}
                          onChange={(e) => setAgentPrompt(e.target.value)}
                          rows={3}
                        />
                      </div>
                      <Button
                        className="w-full"
                        disabled={isResearching || !agentPrompt}
                        onClick={() => runAgentQuery.mutate(agentPrompt)}
                        data-testid="button-submit-agent-query"
                      >
                        {isResearching ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Running Query...
                          </>
                        ) : (
                          <>
                            <Bot className="mr-2 h-4 w-4" />
                            Run Agent Query
                          </>
                        )}
                      </Button>
                    </TabsContent>
                    <TabsContent value="extract" className="space-y-4 mt-4">
                      <p className="text-sm text-muted-foreground">
                        Extract structured data from specific URLs using AI.
                      </p>
                      <div className="space-y-2">
                        <Label htmlFor="extractUrls">URLs (one per line)</Label>
                        <Textarea
                          id="extractUrls"
                          data-testid="input-extract-urls"
                          placeholder="https://example.com/page1&#10;https://example.com/page2"
                          value={extractUrls}
                          onChange={(e) => setExtractUrls(e.target.value)}
                          rows={3}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="extractPrompt">What to extract</Label>
                        <Textarea
                          id="extractPrompt"
                          data-testid="input-extract-prompt"
                          placeholder="e.g., Extract all board members, their titles, and affiliations"
                          value={extractPrompt}
                          onChange={(e) => setExtractPrompt(e.target.value)}
                          rows={2}
                        />
                      </div>
                      <Button
                        className="w-full"
                        disabled={isResearching || !extractUrls || !extractPrompt}
                        onClick={() => {
                          const urls = extractUrls.split("\n").map(u => u.trim()).filter(u => u);
                          extractStructuredData.mutate({ urls, prompt: extractPrompt });
                        }}
                        data-testid="button-submit-extract"
                      >
                        {isResearching ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Extracting...
                          </>
                        ) : (
                          <>
                            <FileText className="mr-2 h-4 w-4" />
                            Extract Data
                          </>
                        )}
                      </Button>
                    </TabsContent>
                  </Tabs>
                </DialogContent>
              </Dialog>
              <Dialog open={isAddUrlOpen} onOpenChange={setIsAddUrlOpen}>
                <DialogTrigger asChild>
                  <Button size="icon" variant="ghost" title="Add URL" data-testid="button-add-document">
                    <Plus className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Research Document</DialogTitle>
                  </DialogHeader>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      addDocument.mutate(url);
                    }}
                    className="space-y-4"
                  >
                    <div className="space-y-2">
                      <Label htmlFor="url">URL (Web page or YouTube video)</Label>
                      <div className="flex gap-2">
                        <LinkIcon className="h-4 w-4 mt-3 text-muted-foreground" />
                        <Input
                          id="url"
                          data-testid="input-document-url"
                          placeholder="https://..."
                          value={url}
                          onChange={(e) => setUrl(e.target.value)}
                          required
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Supports web pages (via Firecrawl) and YouTube videos (transcript extraction)
                      </p>
                    </div>
                    <Button type="submit" className="w-full" disabled={isExtracting} data-testid="button-submit-document">
                      {isExtracting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Extracting content...
                        </>
                      ) : (
                        "Add Document"
                      )}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          <ScrollArea className="h-48">
            {documents.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No documents yet. Add URLs to build your research.
              </p>
            ) : (
              <div className="space-y-2">
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between p-2 rounded hover-elevate bg-muted/50"
                    data-testid={`doc-item-${doc.id}`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {getDocTypeIcon(doc.type)}
                      <span className="text-sm truncate" title={doc.title}>
                        {doc.title}
                      </span>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      onClick={() => deleteDocument.mutate(doc.id)}
                      data-testid={`button-delete-doc-${doc.id}`}
                    >
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        <div className="p-4 flex-1 overflow-hidden flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium">Conversations</h3>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => createConversation.mutate()}
              data-testid="button-new-conversation"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          <ScrollArea className="flex-1">
            {conversations.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Start a new conversation to ask questions about your research.
              </p>
            ) : (
              <div className="space-y-1">
                {conversations.map((conv) => (
                  <Button
                    key={conv.id}
                    variant={selectedConversation === conv.id ? "secondary" : "ghost"}
                    className="w-full justify-start text-left"
                    onClick={() => setSelectedConversation(conv.id)}
                    data-testid={`button-conversation-${conv.id}`}
                  >
                    <MessageCircle className="mr-2 h-4 w-4" />
                    <span className="truncate">{conv.title}</span>
                  </Button>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </div>

      <div className="flex-1 flex flex-col">
        {!selectedConversation ? (
          <div className="flex-1 flex items-center justify-center">
            <Card className="max-w-md">
              <CardHeader className="text-center">
                <MessageCircle className="mx-auto h-12 w-12 text-muted-foreground mb-2" />
                <CardTitle>Research Agent</CardTitle>
                <CardDescription>
                  Add documents and start a conversation to get AI-powered insights from your research.
                </CardDescription>
              </CardHeader>
              <CardContent className="text-center">
                <Button onClick={() => createConversation.mutate()} data-testid="button-start-conversation">
                  <Plus className="mr-2 h-4 w-4" />
                  Start Conversation
                </Button>
              </CardContent>
            </Card>
          </div>
        ) : (
          <>
            <div className="border-b p-4">
              <h3 className="font-medium">
                {conversations.find((c) => c.id === selectedConversation)?.title || "Conversation"}
              </h3>
              <p className="text-sm text-muted-foreground">
                {documents.length} document{documents.length !== 1 ? "s" : ""} in context
              </p>
            </div>

            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                    data-testid={`message-${msg.id}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg p-3 ${
                        msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  </div>
                ))}

                {streamingResponse && (
                  <div className="flex justify-start">
                    <div className="max-w-[80%] rounded-lg p-3 bg-muted">
                      <p className="whitespace-pre-wrap">{streamingResponse}</p>
                    </div>
                  </div>
                )}

                {isStreaming && !streamingResponse && (
                  <div className="flex justify-start">
                    <div className="max-w-[80%] rounded-lg p-3 bg-muted">
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            <div className="border-t p-4">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  sendMessage();
                }}
                className="flex gap-2"
              >
                <Input
                  placeholder="Ask about your research..."
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  disabled={isStreaming}
                  data-testid="input-chat-message"
                />
                <Button type="submit" disabled={isStreaming || !messageInput.trim()} data-testid="button-send-message">
                  {isStreaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </form>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
