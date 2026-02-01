import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bot, Send, Globe, Youtube, FileText, User, Building2, Briefcase, Loader2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Matter, ResearchDocument } from "@shared/schema";

export default function AIAgentPage() {
  const { toast } = useToast();
  const [selectedMatterId, setSelectedMatterId] = useState<string>("");
  const [urlInput, setUrlInput] = useState("");
  const [entityName, setEntityName] = useState("");
  const [entityType, setEntityType] = useState<"person" | "organization" | "company">("person");
  const [customQuery, setCustomQuery] = useState("");

  const { data: matters = [] } = useQuery<Matter[]>({
    queryKey: ["/api/matters"],
  });

  const { data: documents = [] } = useQuery<ResearchDocument[]>({
    queryKey: ["/api/matters", selectedMatterId, "documents"],
    queryFn: async () => {
      if (!selectedMatterId) return [];
      const res = await fetch(`/api/matters/${selectedMatterId}/documents`);
      if (!res.ok) throw new Error("Failed to load documents");
      return res.json();
    },
    enabled: !!selectedMatterId,
  });

  const addUrlMutation = useMutation({
    mutationFn: async (url: string) => {
      return apiRequest("POST", `/api/matters/${selectedMatterId}/documents/url`, { url });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/matters", selectedMatterId, "documents"] });
      toast({ title: "Content extracted successfully" });
      setUrlInput("");
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const entityResearchMutation = useMutation({
    mutationFn: async (data: { entityName: string; entityType: string }) => {
      return apiRequest("POST", `/api/matters/${selectedMatterId}/research/entity`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/matters", selectedMatterId, "documents"] });
      toast({ title: "Entity research completed" });
      setEntityName("");
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const agentQueryMutation = useMutation({
    mutationFn: async (prompt: string) => {
      return apiRequest("POST", `/api/matters/${selectedMatterId}/research/agent-query`, { prompt });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/matters", selectedMatterId, "documents"] });
      toast({ title: "Research query completed" });
      setCustomQuery("");
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const selectedMatter = matters.find(m => m.id === selectedMatterId);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bot className="w-6 h-6" />
            AI Research Agent
          </h1>
          <p className="text-muted-foreground">
            Intelligent research assistant for extracting and analyzing political intelligence
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Select Research Matter</CardTitle>
          <CardDescription>Choose a matter to add research documents and run AI queries</CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={selectedMatterId} onValueChange={setSelectedMatterId}>
            <SelectTrigger className="w-full max-w-md" data-testid="select-matter">
              <SelectValue placeholder="Select a matter..." />
            </SelectTrigger>
            <SelectContent>
              {matters.map((matter) => (
                <SelectItem key={matter.id} value={matter.id}>
                  {matter.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {selectedMatterId && (
        <>
          <Tabs defaultValue="extract" className="space-y-6">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="extract" data-testid="tab-extract">
                <Globe className="w-4 h-4 mr-2" />
                Extract Content
              </TabsTrigger>
              <TabsTrigger value="entity" data-testid="tab-entity">
                <User className="w-4 h-4 mr-2" />
                Entity Research
              </TabsTrigger>
              <TabsTrigger value="query" data-testid="tab-query">
                <Bot className="w-4 h-4 mr-2" />
                Custom Query
              </TabsTrigger>
              <TabsTrigger value="documents" data-testid="tab-documents">
                <FileText className="w-4 h-4 mr-2" />
                Documents ({documents.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="extract">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Globe className="w-5 h-5" />
                    Extract Web Content
                  </CardTitle>
                  <CardDescription>
                    Enter a URL to extract content using Firecrawl. Supports web pages and YouTube videos.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-2">
                    <Input
                      placeholder="https://example.com/article or YouTube URL"
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                      className="flex-1"
                      data-testid="input-url"
                    />
                    <Button
                      onClick={() => addUrlMutation.mutate(urlInput)}
                      disabled={!urlInput || addUrlMutation.isPending}
                      data-testid="button-extract-url"
                    >
                      {addUrlMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <Send className="w-4 h-4 mr-2" />
                          Extract
                        </>
                      )}
                    </Button>
                  </div>
                  <div className="flex gap-2 text-sm text-muted-foreground">
                    <Badge variant="outline" className="gap-1">
                      <Globe className="w-3 h-3" /> Web Pages
                    </Badge>
                    <Badge variant="outline" className="gap-1">
                      <Youtube className="w-3 h-3" /> YouTube Videos
                    </Badge>
                    <Badge variant="outline" className="gap-1">
                      <FileText className="w-3 h-3" /> Articles
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="entity">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="w-5 h-5" />
                    Entity Research
                  </CardTitle>
                  <CardDescription>
                    Research a person, organization, or company using the Firecrawl AI agent
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid md:grid-cols-3 gap-4">
                    <div className="md:col-span-2">
                      <Input
                        placeholder="Enter entity name (e.g., John Smith, EPA, Acme Corp)"
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
                    onClick={() => entityResearchMutation.mutate({ entityName, entityType })}
                    disabled={!entityName || entityResearchMutation.isPending}
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
            </TabsContent>

            <TabsContent value="query">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bot className="w-5 h-5" />
                    Custom Research Query
                  </CardTitle>
                  <CardDescription>
                    Run a custom web research query using the AI agent
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Textarea
                    placeholder="Enter your research query (e.g., 'Find recent lobbying activities related to renewable energy legislation')"
                    value={customQuery}
                    onChange={(e) => setCustomQuery(e.target.value)}
                    className="min-h-[100px]"
                    data-testid="input-custom-query"
                  />
                  <Button
                    onClick={() => agentQueryMutation.mutate(customQuery)}
                    disabled={!customQuery || agentQueryMutation.isPending}
                    data-testid="button-run-query"
                  >
                    {agentQueryMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Running Query...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        Run Query
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="documents">
              <Card>
                <CardHeader>
                  <CardTitle>Research Documents</CardTitle>
                  <CardDescription>
                    Documents extracted for {selectedMatter?.name}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {documents.length === 0 ? (
                    <div className="text-center py-12">
                      <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                      <p className="text-muted-foreground">No documents yet</p>
                      <p className="text-sm text-muted-foreground">
                        Extract content from URLs or run research queries to add documents
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {documents.map((doc) => (
                        <div key={doc.id} className="flex items-start gap-3 p-3 border rounded-lg" data-testid={`document-${doc.id}`}>
                          {doc.type === "youtube" ? (
                            <Youtube className="w-5 h-5 text-red-500 mt-1" />
                          ) : doc.type === "agent_query" || doc.type === "entity_research" ? (
                            <Bot className="w-5 h-5 text-primary mt-1" />
                          ) : (
                            <Globe className="w-5 h-5 text-blue-500 mt-1" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{doc.title}</p>
                            {doc.summary && (
                              <p className="text-sm text-muted-foreground line-clamp-2">{doc.summary}</p>
                            )}
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="secondary" className="text-xs">{doc.type}</Badge>
                              {doc.sourceUrl && (
                                <a 
                                  href={doc.sourceUrl} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-xs text-primary hover:underline truncate max-w-xs"
                                >
                                  {doc.sourceUrl}
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <Card>
            <CardHeader>
              <CardTitle>Chat with Documents</CardTitle>
              <CardDescription>
                Ask questions about your research documents in the full matter view
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <a href={`/matters/${selectedMatterId}`} data-testid="link-open-matter">
                  Open Full Matter View
                </a>
              </Button>
            </CardContent>
          </Card>
        </>
      )}

      {!selectedMatterId && (
        <Card>
          <CardContent className="py-12 text-center">
            <Bot className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-lg font-medium">Select a matter to get started</p>
            <p className="text-muted-foreground">
              The AI Research Agent helps you extract and analyze political intelligence
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
