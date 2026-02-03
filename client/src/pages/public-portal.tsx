import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Folder, FileText, ArrowLeft, Building2, Calendar, MapPin, Phone,
  MessageCircle, X, Send, Bot, User, Loader2
} from "lucide-react";

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

  const { data: matters = [] } = useQuery<PortalMatter[]>({
    queryKey: ["/api/public/portal", params.clientSlug, params.portalSlug, "matters"],
    queryFn: async () => {
      const res = await fetch(`${baseUrl}/matters`);
      if (!res.ok) throw new Error("Failed to load matters");
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
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (portalError || !portal) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="py-12 text-center">
            <p className="text-xl font-semibold mb-2">Portal Not Found</p>
            <p className="text-muted-foreground">The portal you're looking for doesn't exist or is no longer available.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const ChatPanel = () => (
    <div className="fixed bottom-4 right-4 z-50 w-96 max-w-[calc(100vw-2rem)]">
      <Card className="shadow-xl">
        <CardHeader className="py-3 px-4 border-b flex flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-primary" />
            <CardTitle className="text-base">AI Research Assistant</CardTitle>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setIsChatOpen(false)} data-testid="button-close-chat">
            <X className="w-4 h-4" />
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-80 p-4">
            {messages.length === 0 && !streamingMessage && (
              <div className="text-center text-muted-foreground py-8">
                <Bot className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">Ask me anything about the research shared in this portal.</p>
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

  if (selectedMatter) {
    return (
      <div className="min-h-screen bg-background">
        <div className="border-b">
          <div className="container mx-auto py-4">
            <Button variant="ghost" onClick={() => setSelectedMatter(null)} data-testid="button-back-to-matters">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Matters
            </Button>
          </div>
        </div>

        <div className="container mx-auto py-8 space-y-6">
          <div>
            <h1 className="text-2xl font-bold">{selectedMatter.name}</h1>
            {selectedMatter.description && (
              <p className="text-muted-foreground mt-1">{selectedMatter.description}</p>
            )}
          </div>

          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Research Documents</h2>
            {documents.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground">No documents available</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {documents.map((doc) => (
                  <Card key={doc.id} data-testid={`document-${doc.id}`}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-base flex items-center gap-2">
                            <FileText className="w-4 h-4" />
                            {doc.title}
                          </CardTitle>
                          <CardDescription className="mt-1">{doc.summary}</CardDescription>
                        </div>
                        <Badge variant="outline">{doc.type}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="w-4 h-4" />
                        {new Date(doc.createdAt).toLocaleDateString()}
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

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="container mx-auto py-6">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              {portal.clientLogo ? (
                <img 
                  src={portal.clientLogo} 
                  alt={portal.clientName} 
                  className="w-16 h-16 object-contain rounded"
                />
              ) : (
                <div className="w-16 h-16 bg-muted rounded flex items-center justify-center">
                  <Building2 className="w-8 h-8 text-muted-foreground" />
                </div>
              )}
              <div>
                <h1 className="text-2xl font-bold">{portal.clientName}</h1>
                <p className="text-muted-foreground">{portal.name}</p>
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
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto py-8 space-y-6">
        {portal.description && (
          <Card>
            <CardContent className="py-4">
              <p>{portal.description}</p>
            </CardContent>
          </Card>
        )}

        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Available Research</h2>
          {matters.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Folder className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground">No research available at this time</p>
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
                      <Folder className="w-5 h-5" />
                      {matter.name}
                    </CardTitle>
                    {matter.description && (
                      <CardDescription>{matter.description}</CardDescription>
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
        </div>
      </div>

      <footer className="border-t mt-12">
        <div className="container mx-auto py-6 text-center text-sm text-muted-foreground">
          <p>Powered by Political Intelligence Platform</p>
        </div>
      </footer>

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
