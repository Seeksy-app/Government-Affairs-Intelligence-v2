import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Folder, FileText, ArrowLeft, Building2, Calendar, MapPin, Phone } from "lucide-react";

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

export default function PublicPortal() {
  const params = useParams<{ clientSlug: string; portalSlug: string }>();
  const [selectedMatter, setSelectedMatter] = useState<PortalMatter | null>(null);

  const { data: portal, isLoading: portalLoading, error: portalError } = useQuery<PortalInfo>({
    queryKey: ["/api/public/portal", params.clientSlug, params.portalSlug],
    queryFn: async () => {
      const res = await fetch(`/api/public/portal/${params.clientSlug}/${params.portalSlug}`);
      if (!res.ok) throw new Error("Portal not found");
      return res.json();
    },
  });

  const { data: matters = [] } = useQuery<PortalMatter[]>({
    queryKey: ["/api/public/portal", params.clientSlug, params.portalSlug, "matters"],
    queryFn: async () => {
      const res = await fetch(`/api/public/portal/${params.clientSlug}/${params.portalSlug}/matters`);
      if (!res.ok) throw new Error("Failed to load matters");
      return res.json();
    },
    enabled: !!portal,
  });

  const { data: documents = [] } = useQuery<PortalDocument[]>({
    queryKey: ["/api/public/portal", params.clientSlug, params.portalSlug, "matters", selectedMatter?.id, "documents"],
    queryFn: async () => {
      const res = await fetch(`/api/public/portal/${params.clientSlug}/${params.portalSlug}/matters/${selectedMatter!.id}/documents`);
      if (!res.ok) throw new Error("Failed to load documents");
      return res.json();
    },
    enabled: !!selectedMatter,
  });

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
    </div>
  );
}
