import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Shield, ShieldCheck, ShieldAlert, Lock, Eye, FileCheck } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { SecurityStatus, SecurityControl } from "@shared/schema";

const securityLevels = {
  basic: { label: "Basic", color: "bg-yellow-500", icon: Shield },
  standard: { label: "Standard", color: "bg-blue-500", icon: ShieldCheck },
  enhanced: { label: "Enhanced", color: "bg-green-500", icon: ShieldCheck },
  enterprise: { label: "Enterprise", color: "bg-purple-500", icon: ShieldAlert },
};

const controlCategories = ["access", "encryption", "audit", "compliance"];

export default function AdminSecurity() {
  const { toast } = useToast();
  const [isControlDialogOpen, setIsControlDialogOpen] = useState(false);

  const { data } = useQuery<{ status: SecurityStatus; controls: SecurityControl[] }>({
    queryKey: ["/api/admin/security"],
  });

  const status = data?.status;
  const controls = data?.controls || [];

  const controlForm = useForm({
    defaultValues: { name: "", category: "access", status: "enabled", description: "" },
  });

  const updateStatusMutation = useMutation({
    mutationFn: (updateData: Partial<SecurityStatus>) =>
      apiRequest("PATCH", `/api/admin/security/${status?.id}`, updateData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/security"] });
      toast({ title: "Security status updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const createControlMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/admin/security/controls", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/security"] });
      toast({ title: "Security control added" });
      setIsControlDialogOpen(false);
      controlForm.reset();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateControlMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      apiRequest("PATCH", `/api/admin/security/controls/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/security"] });
      toast({ title: "Control updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteControlMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/admin/security/controls/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/security"] });
      toast({ title: "Control removed" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const currentLevel = status?.level as keyof typeof securityLevels || "standard";
  const LevelIcon = securityLevels[currentLevel]?.icon || Shield;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Platform Security</h1>
          <p className="text-muted-foreground">Monitor and manage platform security controls</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LevelIcon className="w-5 h-5" />
              Security Level
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${securityLevels[currentLevel]?.color}`} />
              <span className="font-medium">{securityLevels[currentLevel]?.label}</span>
            </div>
            <Select 
              value={currentLevel} 
              onValueChange={(value) => updateStatusMutation.mutate({ level: value })}
            >
              <SelectTrigger data-testid="select-security-level">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(securityLevels).map(([key, { label }]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Textarea
              placeholder="Security notes..."
              value={status?.notes || ""}
              onChange={(e) => updateStatusMutation.mutate({ notes: e.target.value })}
              className="min-h-[100px]"
              data-testid="input-security-notes"
            />
          </CardContent>
        </Card>

        <Card className="col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Security Controls</CardTitle>
              <CardDescription>Active security measures and configurations</CardDescription>
            </div>
            <Dialog open={isControlDialogOpen} onOpenChange={setIsControlDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" data-testid="button-add-control">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Control
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Security Control</DialogTitle>
                </DialogHeader>
                <Form {...controlForm}>
                  <form onSubmit={controlForm.handleSubmit((data) => createControlMutation.mutate(data))} className="space-y-4">
                    <FormField
                      control={controlForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Control Name</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Two-Factor Authentication" data-testid="input-control-name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={controlForm.control}
                      name="category"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Category</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-control-category">
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {controlCategories.map((cat) => (
                                <SelectItem key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={controlForm.control}
                      name="status"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Status</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-control-status">
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="enabled">Enabled</SelectItem>
                              <SelectItem value="disabled">Disabled</SelectItem>
                              <SelectItem value="pending">Pending</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={controlForm.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description</FormLabel>
                          <FormControl>
                            <Textarea {...field} placeholder="Control description" data-testid="input-control-description" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button type="submit" disabled={createControlMutation.isPending} data-testid="button-save-control">
                      Add Control
                    </Button>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            {controls.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Lock className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No security controls configured</p>
              </div>
            ) : (
              <div className="space-y-3">
                {controls.map((control) => (
                  <div key={control.id} className="flex items-center justify-between p-3 border rounded-lg" data-testid={`control-${control.id}`}>
                    <div className="flex items-center gap-3">
                      {control.category === "access" && <Lock className="w-4 h-4 text-blue-500" />}
                      {control.category === "encryption" && <Shield className="w-4 h-4 text-green-500" />}
                      {control.category === "audit" && <Eye className="w-4 h-4 text-orange-500" />}
                      {control.category === "compliance" && <FileCheck className="w-4 h-4 text-purple-500" />}
                      <div>
                        <p className="font-medium">{control.name}</p>
                        {control.description && <p className="text-sm text-muted-foreground">{control.description}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={control.status === "enabled" ? "default" : control.status === "disabled" ? "secondary" : "outline"}>
                        {control.status}
                      </Badge>
                      <Select 
                        value={control.status} 
                        onValueChange={(value) => updateControlMutation.mutate({ id: control.id, data: { status: value } })}
                      >
                        <SelectTrigger className="w-28" data-testid={`select-control-status-${control.id}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="enabled">Enabled</SelectItem>
                          <SelectItem value="disabled">Disabled</SelectItem>
                          <SelectItem value="pending">Pending</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Security Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4">
            <div className="p-4 border rounded-lg text-center">
              <p className="text-2xl font-bold text-green-500">{controls.filter(c => c.status === "enabled").length}</p>
              <p className="text-sm text-muted-foreground">Active Controls</p>
            </div>
            <div className="p-4 border rounded-lg text-center">
              <p className="text-2xl font-bold text-yellow-500">{controls.filter(c => c.status === "pending").length}</p>
              <p className="text-sm text-muted-foreground">Pending</p>
            </div>
            <div className="p-4 border rounded-lg text-center">
              <p className="text-2xl font-bold text-gray-500">{controls.filter(c => c.status === "disabled").length}</p>
              <p className="text-sm text-muted-foreground">Disabled</p>
            </div>
            <div className="p-4 border rounded-lg text-center">
              <p className="text-2xl font-bold">{controls.length}</p>
              <p className="text-sm text-muted-foreground">Total Controls</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
