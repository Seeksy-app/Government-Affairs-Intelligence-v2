import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { CheckCircle2, XCircle, Clock, Mail, Building2, User, Phone, Globe, Calendar, Loader2 } from "lucide-react";

interface ClientApplication {
  id: string;
  companyName: string;
  contactName: string;
  email: string;
  phone: string | null;
  industry: string | null;
  companySize: string | null;
  website: string | null;
  message: string | null;
  status: string;
  emailVerified: boolean;
  createdAt: string;
}

export default function AdminApplications() {
  const { toast } = useToast();
  const [selectedApp, setSelectedApp] = useState<ClientApplication | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectDialog, setShowRejectDialog] = useState(false);

  const { data: applications = [], isLoading } = useQuery<ClientApplication[]>({
    queryKey: ["/api/admin/applications"],
  });

  const approveMutation = useMutation({
    mutationFn: async (applicationId: string) => {
      const res = await apiRequest("POST", `/api/admin/applications/${applicationId}/approve`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/applications"] });
      toast({ title: "Application Approved", description: "Client account has been created and notification sent." });
      setSelectedApp(null);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ applicationId, reason }: { applicationId: string; reason: string }) => {
      const res = await apiRequest("POST", `/api/admin/applications/${applicationId}/reject`, { reason });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/applications"] });
      toast({ title: "Application Rejected", description: "Rejection notification sent to applicant." });
      setShowRejectDialog(false);
      setSelectedApp(null);
      setRejectReason("");
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const pendingApps = applications.filter(a => a.status === "pending");
  const approvedApps = applications.filter(a => a.status === "approved");
  const rejectedApps = applications.filter(a => a.status === "rejected");

  const getStatusBadge = (status: string, emailVerified: boolean) => {
    if (status === "pending" && !emailVerified) {
      return <Badge variant="outline" className="text-amber-600">Awaiting Verification</Badge>;
    }
    switch (status) {
      case "pending":
        return <Badge variant="secondary">Pending Review</Badge>;
      case "approved":
        return <Badge className="bg-green-600">Approved</Badge>;
      case "rejected":
        return <Badge variant="destructive">Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-6 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Client Applications</h1>
        <p className="text-muted-foreground mt-1">
          Review and manage client signup requests
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-500" />
              <div>
                <p className="text-2xl font-bold">{pendingApps.length}</p>
                <p className="text-sm text-muted-foreground">Pending Review</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{approvedApps.length}</p>
                <p className="text-sm text-muted-foreground">Approved</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <XCircle className="w-5 h-5 text-red-500" />
              <div>
                <p className="text-2xl font-bold">{rejectedApps.length}</p>
                <p className="text-sm text-muted-foreground">Rejected</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pending Applications</CardTitle>
          <CardDescription>Applications awaiting review or email verification</CardDescription>
        </CardHeader>
        <CardContent>
          {pendingApps.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No pending applications</p>
          ) : (
            <div className="space-y-4">
              {pendingApps.map((app) => (
                <div
                  key={app.id}
                  className="flex items-start justify-between p-4 border rounded-lg hover-elevate cursor-pointer"
                  onClick={() => setSelectedApp(app)}
                  data-testid={`application-${app.id}`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4" />
                      <span className="font-medium">{app.companyName}</span>
                      {getStatusBadge(app.status, app.emailVerified)}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" /> {app.contactName}
                      </span>
                      <span className="flex items-center gap-1">
                        <Mail className="w-3 h-3" /> {app.email}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Calendar className="w-3 h-3" /> Applied {formatDate(app.createdAt)}
                    </div>
                  </div>
                  {app.emailVerified && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          approveMutation.mutate(app.id);
                        }}
                        disabled={approveMutation.isPending}
                        data-testid={`button-approve-${app.id}`}
                      >
                        <CheckCircle2 className="w-4 h-4 mr-1" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedApp(app);
                          setShowRejectDialog(true);
                        }}
                        data-testid={`button-reject-${app.id}`}
                      >
                        <XCircle className="w-4 h-4 mr-1" />
                        Reject
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {approvedApps.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recently Approved</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {approvedApps.slice(0, 5).map((app) => (
                <div key={app.id} className="flex items-center justify-between p-3 border rounded-md">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4" />
                    <span>{app.companyName}</span>
                    <span className="text-sm text-muted-foreground">({app.contactName})</span>
                  </div>
                  {getStatusBadge(app.status, app.emailVerified)}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={!!selectedApp && !showRejectDialog} onOpenChange={() => setSelectedApp(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Application Details</DialogTitle>
          </DialogHeader>
          {selectedApp && (
            <div className="space-y-4">
              <div className="grid gap-3">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium">{selectedApp.companyName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-muted-foreground" />
                  <span>{selectedApp.contactName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <span>{selectedApp.email}</span>
                  {selectedApp.emailVerified && (
                    <Badge variant="outline" className="text-green-600 text-xs">Verified</Badge>
                  )}
                </div>
                {selectedApp.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    <span>{selectedApp.phone}</span>
                  </div>
                )}
                {selectedApp.website && (
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-muted-foreground" />
                    <a href={selectedApp.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                      {selectedApp.website}
                    </a>
                  </div>
                )}
                {selectedApp.industry && (
                  <div>
                    <span className="text-sm text-muted-foreground">Industry:</span>
                    <span className="ml-2">{selectedApp.industry}</span>
                  </div>
                )}
                {selectedApp.companySize && (
                  <div>
                    <span className="text-sm text-muted-foreground">Size:</span>
                    <span className="ml-2">{selectedApp.companySize}</span>
                  </div>
                )}
                {selectedApp.message && (
                  <div>
                    <span className="text-sm text-muted-foreground block mb-1">Message:</span>
                    <p className="text-sm bg-muted p-3 rounded-md">{selectedApp.message}</p>
                  </div>
                )}
              </div>
              {selectedApp.status === "pending" && selectedApp.emailVerified && (
                <DialogFooter>
                  <Button
                    variant="destructive"
                    onClick={() => setShowRejectDialog(true)}
                  >
                    Reject
                  </Button>
                  <Button
                    onClick={() => approveMutation.mutate(selectedApp.id)}
                    disabled={approveMutation.isPending}
                  >
                    {approveMutation.isPending ? "Approving..." : "Approve Application"}
                  </Button>
                </DialogFooter>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Application</DialogTitle>
            <DialogDescription>
              Provide a reason for rejection (optional). This will be sent to the applicant.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Reason for rejection..."
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            data-testid="textarea-reject-reason"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (selectedApp) {
                  rejectMutation.mutate({ applicationId: selectedApp.id, reason: rejectReason });
                }
              }}
              disabled={rejectMutation.isPending}
              data-testid="button-confirm-reject"
            >
              {rejectMutation.isPending ? "Rejecting..." : "Reject Application"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
