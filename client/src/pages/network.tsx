import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Network, Users, Building2, ArrowRight, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Contact, CareerHistory } from "@shared/schema";

interface ContactWithHistory extends Contact {
  careerHistory?: CareerHistory[];
}

export default function NetworkPage() {
  const [searchQuery, setSearchQuery] = useState("");
  
  const { data: contacts, isLoading } = useQuery<ContactWithHistory[]>({
    queryKey: ["/api/contacts/with-history"],
  });

  const searchResults = useMemo(() => {
    if (!searchQuery.trim() || !contacts) return [];
    const query = searchQuery.toLowerCase();
    return contacts.filter(c => 
      c.firstName.toLowerCase().includes(query) ||
      c.lastName.toLowerCase().includes(query) ||
      (c.organization && c.organization.toLowerCase().includes(query)) ||
      (c.title && c.title.toLowerCase().includes(query))
    );
  }, [searchQuery, contacts]);

  const highPriorityContacts = contacts?.filter(c => c.priority && c.priority >= 4) || [];
  const recentContacts = contacts?.slice(0, 10) || [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-serif" data-testid="text-network-title">
            Network
          </h1>
          <p className="text-muted-foreground mt-1">
            Visualize career paths and connections
          </p>
        </div>
        
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search staffers by name, title, or org..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-9"
            data-testid="input-search-staffers"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
              onClick={() => setSearchQuery("")}
              data-testid="button-clear-search"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {searchQuery.trim() && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Search Results ({searchResults.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {searchResults.length > 0 ? (
              <div className="space-y-4">
                {searchResults.map((contact) => (
                  <div
                    key={contact.id}
                    className="p-4 rounded-lg border hover-elevate"
                    data-testid={`search-result-${contact.id}`}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium text-primary">
                        {contact.firstName[0]}{contact.lastName[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium">
                          {contact.firstName} {contact.lastName}
                        </p>
                        <p className="text-sm text-muted-foreground truncate">
                          {contact.title} {contact.organization ? `at ${contact.organization}` : ""}
                        </p>
                      </div>
                      {contact.priority && contact.priority >= 4 && (
                        <Badge variant="outline">Priority {contact.priority}</Badge>
                      )}
                    </div>
                    
                    {contact.careerHistory && contact.careerHistory.length > 0 ? (
                      <div className="relative pl-4 border-l-2 border-primary/30 space-y-3 ml-6">
                        {contact.careerHistory.map((career) => (
                          <div key={career.id} className="relative">
                            <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-background border-2 border-primary" />
                            <div className="pl-3">
                              <p className="text-sm font-medium">{career.title}</p>
                              <p className="text-xs text-muted-foreground">
                                {career.organization}
                                {career.startYear && ` (${career.startYear}${career.endYear ? `-${career.endYear}` : "-present"})`}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground ml-6">No career history recorded</p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Search className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No staffers found for "{searchQuery}"</p>
                <p className="text-sm">Try a different name, title, or organization</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Key Contacts */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Key Contacts
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton className="h-12 w-12 rounded-full" />
                    <div className="flex-1">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-24 mt-1" />
                    </div>
                  </div>
                ))}
              </div>
            ) : highPriorityContacts.length > 0 ? (
              <div className="space-y-4">
                {highPriorityContacts.map((contact) => (
                  <div
                    key={contact.id}
                    className="p-3 rounded-lg border hover-elevate"
                    data-testid={`key-contact-${contact.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium text-primary">
                        {contact.firstName[0]}{contact.lastName[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium">
                          {contact.firstName} {contact.lastName}
                        </p>
                        <p className="text-sm text-muted-foreground truncate">
                          {contact.title} {contact.organization ? `at ${contact.organization}` : ""}
                        </p>
                      </div>
                      <Badge variant="outline">Priority {contact.priority}</Badge>
                    </div>
                    {contact.careerHistory && contact.careerHistory.length > 0 && (
                      <div className="mt-3 pl-15">
                        <p className="text-xs text-muted-foreground mb-2">Career Path</p>
                        <div className="flex items-center gap-2 flex-wrap">
                          {contact.careerHistory.slice(0, 3).map((career, idx) => (
                            <div key={career.id} className="flex items-center gap-1">
                              <span className="text-xs bg-muted px-2 py-1 rounded">
                                {career.organization} ({career.startYear})
                              </span>
                              {idx < Math.min(contact.careerHistory!.length - 1, 2) && (
                                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No high-priority contacts</p>
                <p className="text-sm">Mark contacts as priority 4-5 to see them here</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Career Patterns */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Network className="h-5 w-5" />
              Career Patterns
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-3 w-2/3" />
                  </div>
                ))}
              </div>
            ) : recentContacts.length > 0 ? (
              <div className="space-y-4">
                {recentContacts.filter(c => c.careerHistory && c.careerHistory.length > 0).slice(0, 5).map((contact) => (
                  <div
                    key={contact.id}
                    className="p-3 rounded-lg border space-y-2"
                    data-testid={`career-pattern-${contact.id}`}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                        {contact.firstName[0]}{contact.lastName[0]}
                      </div>
                      <span className="font-medium text-sm">
                        {contact.firstName} {contact.lastName}
                      </span>
                    </div>
                    {contact.careerHistory && (
                      <div className="relative pl-4 border-l-2 border-muted space-y-2">
                        {contact.careerHistory.map((career) => (
                          <div key={career.id} className="relative">
                            <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-background border-2 border-primary" />
                            <div className="pl-3">
                              <p className="text-sm font-medium">{career.title}</p>
                              <p className="text-xs text-muted-foreground">
                                {career.organization}
                                {career.startYear && ` (${career.startYear}${career.endYear ? `-${career.endYear}` : "-present"})`}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                {recentContacts.filter(c => c.careerHistory && c.careerHistory.length > 0).length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Network className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No career history recorded</p>
                    <p className="text-sm">Add career history to contacts to see patterns</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Network className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No contacts with career history</p>
                <p className="text-sm">Add career history to see patterns</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Organizations Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Organizations
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-24" />
              ))}
            </div>
          ) : contacts && contacts.length > 0 ? (
            <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-4">
              {Object.entries(
                contacts.reduce((acc, contact) => {
                  const org = contact.organization || "Unknown";
                  acc[org] = (acc[org] || 0) + 1;
                  return acc;
                }, {} as Record<string, number>)
              )
                .sort((a, b) => b[1] - a[1])
                .slice(0, 8)
                .map(([org, count]) => (
                  <Card key={org} className="hover-elevate">
                    <CardContent className="p-4">
                      <p className="font-medium text-sm truncate">{org}</p>
                      <p className="text-2xl font-bold mt-1">{count}</p>
                      <p className="text-xs text-muted-foreground">contact{count !== 1 ? "s" : ""}</p>
                    </CardContent>
                  </Card>
                ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Building2 className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No organizations yet</p>
              <p className="text-sm">Add contacts with organizations to see them here</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
