import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  ExternalLink,
  RefreshCw,
  Gavel,
  FileText,
  Search,
  CalendarDays,
  Plane,
  Building,
  Info,
  CalendarRange,
  X,
  Share2,
  MoreVertical,
  Check,
} from "lucide-react";
import { format, parseISO, isWithinInterval, addDays } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { ClientPortal } from "@shared/schema";
import { PageHeader, PageShell } from "@/components/page-header";

interface CommitteeMeeting {
  eventId: number;
  updateDate: string;
  chamber: string;
  congress: number;
  type: string;
  meetingStatus: string;
  date: string;
  url?: string;
  location?: {
    room?: string;
    building?: string;
    address?: string;
  };
  committees?: Array<{
    systemCode: string;
    name: string;
    url: string;
  }>;
  title?: string;
  witnesses?: Array<{
    name: string;
    position?: string;
    organization?: string;
  }>;
}

interface FloorActivity {
  source: string;
  items: Array<{
    title: string;
    link: string;
    pubDate: string;
    content?: string;
  }>;
  error?: string;
}

interface CalendarPeriod {
  start: string;
  end: string;
  type: "session" | "recess";
  description: string;
}

interface CongressionalCalendar {
  congress: number;
  session: number;
  year: number;
  periods: CalendarPeriod[];
  notes: string[];
  currentPeriod: CalendarPeriod | null;
  nextPeriod: CalendarPeriod | null;
  today: string;
}

export default function CongressionalSchedules() {
  const [chamber, setChamber] = useState<string>("house");
  const [activeTab, setActiveTab] = useState("calendar");
  const [searchText, setSearchText] = useState("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  const { data: calendarData, isLoading: calendarLoading, refetch: refetchCalendar } = useQuery<CongressionalCalendar>({
    queryKey: ["/api/congress/schedule/calendar"],
  });

  const { data: committeeMeetings, isLoading: meetingsLoading, error: meetingsError, refetch: refetchMeetings } = useQuery<CommitteeMeeting[]>({
    queryKey: ["/api/congress/schedule/committee-meetings", chamber, searchText, startDate, endDate],
    queryFn: async () => {
      const params = new URLSearchParams({
        chamber,
        limit: "30",
      });
      if (searchText) {
        params.set("search", searchText);
      }
      if (startDate) {
        params.set("startDate", startDate);
      }
      if (endDate) {
        params.set("endDate", endDate);
      }
      const res = await fetch(`/api/congress/schedule/committee-meetings?${params}`);
      if (!res.ok) throw new Error("Failed to fetch committee meetings");
      return res.json();
    },
  });

  const { data: floorActivity, isLoading: floorLoading, error: floorError, refetch: refetchFloor } = useQuery<FloorActivity[]>({
    queryKey: ["/api/congress/schedule/leadership"],
  });

  const { data: portals } = useQuery<ClientPortal[]>({
    queryKey: ["/api/portals"],
  });

  const { data: meetingAssignments, refetch: refetchAssignments } = useQuery<any[]>({
    queryKey: ["/api/congress/meetings/assignments"],
  });

  const { toast } = useToast();

  const assignToPortalMutation = useMutation({
    mutationFn: async ({ meeting, portalId }: { meeting: CommitteeMeeting; portalId: string }) => {
      const committees = meeting.committees?.map(c => c.name).join(", ") || "";
      const location = meeting.location ? 
        `${meeting.location.room || ""} ${meeting.location.building || ""}`.trim() : "";
      const meetingChamber = (meeting.chamber || chamber).toLowerCase();
      
      return apiRequest("POST", `/api/congress/meetings/${meeting.eventId}/${meetingChamber}/assign-portal`, {
        portalId,
        congress: meeting.congress || 119,
        title: meeting.title || "",
        meetingDate: meeting.date || "",
        committees,
        location,
      });
    },
    onSuccess: () => {
      toast({ title: "Meeting assigned to portal" });
      refetchAssignments();
    },
    onError: (error: Error) => {
      toast({ title: "Error assigning meeting", description: error.message, variant: "destructive" });
    },
  });

  const isMeetingAssigned = (eventId: number, portalId: string, meetingChamber?: string) => {
    const chamberToCheck = (meetingChamber || chamber).toLowerCase();
    return meetingAssignments?.some(a => 
      a.eventId === eventId && 
      a.portalId === portalId && 
      a.chamber?.toLowerCase() === chamberToCheck
    );
  };
  
  const clearDateRange = () => {
    setStartDate("");
    setEndDate("");
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "scheduled":
        return "border-primary/20 bg-primary/5 text-primary";
      case "canceled":
        return "border-transparent bg-muted text-muted-foreground line-through decoration-muted-foreground/60";
      case "postponed":
      case "rescheduled":
        return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400";
      default:
        return "border-transparent bg-muted text-muted-foreground";
    }
  };

  const formatMeetingDate = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), "EEEE, MMMM d, yyyy");
    } catch {
      return dateStr;
    }
  };

  const formatMeetingTime = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), "h:mm a");
    } catch {
      return "";
    }
  };

  const getMeetingUrl = (meeting: CommitteeMeeting) => {
    const congressNum = meeting.congress || 119;
    const chamberName = meeting.chamber?.toLowerCase() || chamber;
    return `https://www.congress.gov/event/${congressNum}th-congress/${chamberName}-event/${meeting.eventId}`;
  };

  const isPeriodCurrent = (period: CalendarPeriod) => {
    if (!calendarData?.today) return false;
    const today = new Date(calendarData.today);
    const start = new Date(period.start);
    const end = new Date(period.end);
    return isWithinInterval(today, { start, end });
  };

  const isPeriodUpcoming = (period: CalendarPeriod) => {
    if (!calendarData?.today) return false;
    const today = new Date(calendarData.today);
    const start = new Date(period.start);
    const soon = addDays(today, 14);
    return start > today && start <= soon;
  };

  return (
    <PageShell className="space-y-6">
      <PageHeader
        eyebrow="Monitor"
        title="Hearings & Schedules"
        description="Monitor the session calendar, committee hearings and floor activity to plan when to reach members."
        className="mb-0"
        actions={
          <>
            <Select value={chamber} onValueChange={(val) => {
              setChamber(val);
              setSearchText("");
            }}>
              <SelectTrigger className="w-[130px]" data-testid="select-chamber">
                <SelectValue placeholder="Chamber" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="house">House</SelectItem>
                <SelectItem value="senate">Senate</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              onClick={() => {
                refetchCalendar();
                refetchMeetings();
                refetchFloor();
              }}
              data-testid="button-refresh-schedule"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </>
        }
      />

      {/* Current Status Banner */}
      {calendarData?.currentPeriod && (
        <Card className={calendarData.currentPeriod.type === "session"
          ? "border-primary/20 bg-primary/5 shadow-none"
          : "bg-muted/40 shadow-none"
        }>
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${calendarData.currentPeriod.type === "session" ? "bg-primary/10" : "bg-muted"}`}>
                {calendarData.currentPeriod.type === "session" ? (
                  <Building className="h-4 w-4 text-primary" />
                ) : (
                  <Plane className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">
                  Congress is currently {calendarData.currentPeriod.type === "session" ? "in session" : "in recess"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {calendarData.currentPeriod.description} ({format(parseISO(calendarData.currentPeriod.start), "MMM d")} – {format(parseISO(calendarData.currentPeriod.end), "MMM d, yyyy")})
                </p>
              </div>
              <Badge
                variant="outline"
                className={calendarData.currentPeriod.type === "session"
                  ? "border-primary/20 bg-card text-primary"
                  : "bg-card text-muted-foreground"
                }
              >
                {calendarData.currentPeriod.type === "session" ? "Members in DC" : "Members in Districts"}
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <TabsList>
            <TabsTrigger value="calendar" className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4" />
              Session Calendar
            </TabsTrigger>
            <TabsTrigger value="committee" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Committee Meetings
            </TabsTrigger>
            <TabsTrigger value="floor" className="flex items-center gap-2">
              <Gavel className="h-4 w-4" />
              Floor Activity
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="calendar" className="mt-4">
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader className="p-5">
                <CardTitle className="text-base">
                  2026 Congressional Calendar
                </CardTitle>
                <CardDescription>
                  119th Congress, 2nd Session — session weeks and district work periods
                </CardDescription>
              </CardHeader>
              <CardContent className="p-5 pt-0">
                {calendarLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div key={i} className="flex items-center gap-3 rounded-lg border p-3">
                        <Skeleton className="h-4 w-4 rounded" />
                        <div className="flex-1 space-y-1.5">
                          <Skeleton className="h-4 w-1/3" />
                          <Skeleton className="h-3 w-1/4" />
                        </div>
                        <Skeleton className="h-5 w-14 rounded-full" />
                      </div>
                    ))}
                  </div>
                ) : calendarData?.periods ? (
                  <ScrollArea className="h-[500px]">
                    <div className="space-y-2 pr-4">
                      {calendarData.periods.map((period, idx) => {
                        const isCurrent = isPeriodCurrent(period);
                        const isUpcoming = isPeriodUpcoming(period);
                        return (
                          <div
                            key={idx}
                            className={`p-3 rounded-lg border flex items-center gap-3 ${
                              isCurrent
                                ? "border-primary/30 bg-primary/5"
                                : isUpcoming
                                  ? "bg-muted/40"
                                  : ""
                            }`}
                            data-testid={`calendar-period-${idx}`}
                          >
                            {period.type === "session" ? (
                              <Building className="h-4 w-4 text-primary flex-shrink-0" />
                            ) : (
                              <Plane className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-medium">{period.description}</span>
                                {isCurrent && (
                                  <Badge variant="outline" className="border-primary/30 text-xs text-primary">Current</Badge>
                                )}
                                {isUpcoming && !isCurrent && (
                                  <Badge variant="outline" className="text-xs text-muted-foreground">Upcoming</Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {format(parseISO(period.start), "MMM d")} – {format(parseISO(period.end), "MMM d, yyyy")}
                              </p>
                            </div>
                            <Badge
                              variant="outline"
                              className={period.type === "session"
                                ? "shrink-0 border-primary/20 bg-primary/5 text-primary"
                                : "shrink-0 border-transparent bg-muted text-muted-foreground"
                              }
                            >
                              {period.type === "session" ? "In DC" : "District"}
                            </Badge>
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                      <CalendarDays className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <p className="mt-4 text-sm font-semibold">Calendar data not available</p>
                    <p className="mt-1 text-sm text-muted-foreground">Try refreshing in a moment.</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="space-y-4">
              <Card>
                <CardHeader className="p-5">
                  <CardTitle className="text-base">
                    Meeting Planning Tips
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-5 pt-0">
                  <div className="space-y-3">
                    <div className="flex items-start gap-2.5">
                      <Building className="h-4 w-4 shrink-0 text-primary mt-0.5" />
                      <div>
                        <p className="font-medium text-sm">During Session</p>
                        <p className="text-sm text-muted-foreground">
                          Members are in Washington, D.C. Best for meetings at Capitol Hill offices. Tuesday–Thursday are typically busiest.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <Plane className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="font-medium text-sm">During Recess</p>
                        <p className="text-sm text-muted-foreground">
                          Members return to home districts. Ideal for local meetings and town halls.
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {calendarData?.nextPeriod && (
                <Card>
                  <CardHeader className="p-5">
                    <CardTitle className="text-base">
                      Coming Up
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-5 pt-0">
                    <div className="flex items-center gap-3">
                      {calendarData.nextPeriod.type === "session" ? (
                        <Building className="h-4 w-4 shrink-0 text-primary" />
                      ) : (
                        <Plane className="h-4 w-4 shrink-0 text-muted-foreground" />
                      )}
                      <div>
                        <p className="text-sm font-medium">{calendarData.nextPeriod.description}</p>
                        <p className="text-sm text-muted-foreground">
                          Starts {format(parseISO(calendarData.nextPeriod.start), "MMMM d, yyyy")}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="committee" className="mt-4">
          <Card>
            <CardHeader className="p-5 space-y-0">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <CardTitle className="text-base">
                  {chamber === "house" ? "House" : "Senate"} Committee Meetings
                </CardTitle>
                <div className="relative w-full lg:w-[300px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by title, committee, witness..."
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    className="pl-9 w-full"
                    data-testid="input-meeting-search"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mt-4 pt-4 border-t">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CalendarRange className="h-4 w-4" />
                  <span className="font-medium">Date range</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div>
                    <Label htmlFor="start-date" className="sr-only">Start Date</Label>
                    <Input
                      id="start-date"
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-[150px]"
                      data-testid="input-start-date"
                    />
                  </div>
                  <span className="text-sm text-muted-foreground">to</span>
                  <div>
                    <Label htmlFor="end-date" className="sr-only">End Date</Label>
                    <Input
                      id="end-date"
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-[150px]"
                      data-testid="input-end-date"
                    />
                  </div>
                  {(startDate || endDate) && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={clearDateRange}
                      aria-label="Clear date range"
                      data-testid="button-clear-dates"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>

              <p className="text-sm text-muted-foreground mt-3">
                {startDate || endDate
                  ? `Showing meetings ${startDate ? `from ${format(parseISO(startDate), "MMM d, yyyy")}` : ""} ${endDate ? `to ${format(parseISO(endDate), "MMM d, yyyy")}` : ""}`
                  : "Showing up to 30 most recent meetings with full details"
                }
              </p>
            </CardHeader>
            <CardContent className="p-5 pt-0">
              {meetingsLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="p-4 border rounded-lg space-y-2">
                      <div className="flex gap-2">
                        <Skeleton className="h-5 w-20 rounded-full" />
                        <Skeleton className="h-5 w-16 rounded-full" />
                      </div>
                      <Skeleton className="h-5 w-3/4" />
                      <Skeleton className="h-4 w-1/2" />
                      <Skeleton className="h-4 w-1/3" />
                    </div>
                  ))}
                </div>
              ) : committeeMeetings && committeeMeetings.length > 0 ? (
                <ScrollArea className="h-[600px]">
                  <div className="space-y-3 pr-4">
                    {committeeMeetings.map((meeting) => (
                      <Card
                        key={meeting.eventId}
                        className="hover-elevate shadow-none"
                        data-testid={`meeting-card-${meeting.eventId}`}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2 flex-wrap">
                                {meeting.meetingStatus && (
                                  <Badge variant="outline" className={`text-xs font-medium ${getStatusColor(meeting.meetingStatus)}`}>
                                    {meeting.meetingStatus}
                                  </Badge>
                                )}
                                {meeting.type && (
                                  <Badge variant="outline" className="text-xs font-normal text-muted-foreground">
                                    {meeting.type}
                                  </Badge>
                                )}
                              </div>

                              {meeting.committees && meeting.committees.length > 0 && (
                                <h3 className="font-semibold text-base leading-snug mb-1">
                                  {meeting.committees[0].name}
                                </h3>
                              )}

                              {meeting.title && (
                                <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                                  {meeting.title}
                                </p>
                              )}

                              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                                {meeting.date && (
                                  <span className="flex items-center gap-1.5">
                                    <Calendar className="h-3.5 w-3.5" />
                                    {formatMeetingDate(meeting.date)}
                                  </span>
                                )}
                                {meeting.date && (
                                  <span className="flex items-center gap-1.5">
                                    <Clock className="h-3.5 w-3.5" />
                                    {formatMeetingTime(meeting.date)}
                                  </span>
                                )}
                                {meeting.location && (meeting.location.room || meeting.location.building) && (
                                  <span className="flex items-center gap-1.5">
                                    <MapPin className="h-3.5 w-3.5" />
                                    {meeting.location.room && `Room ${meeting.location.room}`}
                                    {meeting.location.room && meeting.location.building && ", "}
                                    {meeting.location.building}
                                  </span>
                                )}
                              </div>

                              {meeting.witnesses && meeting.witnesses.length > 0 && (
                                <div className="mt-3 pt-3 border-t">
                                  <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                                    <Users className="h-3 w-3" />
                                    Witnesses ({meeting.witnesses.length})
                                  </p>
                                  <div className="flex flex-wrap gap-1">
                                    {meeting.witnesses.slice(0, 4).map((witness, idx) => (
                                      <Badge key={idx} variant="secondary" className="max-w-full text-xs font-normal">
                                        <span className="truncate">
                                          {witness.name}
                                          {witness.position && ` - ${witness.position}`}
                                        </span>
                                      </Badge>
                                    ))}
                                    {meeting.witnesses.length > 4 && (
                                      <Badge variant="outline" className="text-xs font-normal text-muted-foreground">
                                        +{meeting.witnesses.length - 4} more
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <Button variant="ghost" size="icon" asChild>
                                <a
                                  href={getMeetingUrl(meeting)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  aria-label="Open on Congress.gov"
                                  data-testid={`link-meeting-${meeting.eventId}`}
                                >
                                  <ExternalLink className="h-4 w-4" />
                                </a>
                              </Button>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    aria-label="Meeting actions"
                                    data-testid={`button-meeting-actions-${meeting.eventId}`}
                                  >
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  {portals && portals.length > 0 && (
                                    <>
                                      <DropdownMenuLabel className="flex items-center gap-2">
                                        <Share2 className="h-4 w-4" />
                                        Assign to Portal
                                      </DropdownMenuLabel>
                                      <DropdownMenuSeparator />
                                      {portals.map((portal) => (
                                        <DropdownMenuItem
                                          key={portal.id}
                                          onClick={() => assignToPortalMutation.mutate({ meeting, portalId: portal.id })}
                                          data-testid={`menu-assign-meeting-portal-${portal.id}`}
                                          className="flex items-center justify-between"
                                        >
                                          <span>{portal.name}</span>
                                          {isMeetingAssigned(meeting.eventId, portal.id, meeting.chamber) && (
                                            <Check className="h-4 w-4 text-primary" />
                                          )}
                                        </DropdownMenuItem>
                                      ))}
                                    </>
                                  )}
                                  {(!portals || portals.length === 0) && (
                                    <DropdownMenuItem disabled>
                                      No portals available
                                    </DropdownMenuItem>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              ) : meetingsError ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
                    <Calendar className="h-5 w-5 text-destructive" />
                  </div>
                  <p className="mt-4 text-sm font-semibold">Failed to load committee meetings</p>
                  <p className="mt-1 text-sm text-muted-foreground">Please try again in a moment.</p>
                  <Button variant="outline" size="sm" className="mt-4" onClick={() => refetchMeetings()}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Retry
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                    <Calendar className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <p className="mt-4 text-sm font-semibold">No committee meetings found</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {searchText ? "Try a different search term." : "Check back later for updates."}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="floor" className="mt-4">
          {/* Session Status Context */}
          {calendarData?.currentPeriod && calendarData.currentPeriod.type === "recess" && (
            <div className="mb-4 flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4">
              <Info className="h-4 w-4 shrink-0 text-primary mt-0.5" />
              <div>
                <p className="text-sm font-semibold">
                  Congress is currently in recess
                </p>
                <p className="text-sm text-muted-foreground">
                  Floor activity is typically paused during {calendarData.currentPeriod.description}.
                  Members return on {calendarData.nextPeriod ? format(parseISO(calendarData.nextPeriod.start), "MMMM d, yyyy") : "their next scheduled session"}.
                </p>
              </div>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            {floorLoading ? (
              <>
                {[1, 2].map((i) => (
                  <Card key={i}>
                    <CardHeader className="p-5">
                      <Skeleton className="h-5 w-1/2" />
                      <Skeleton className="h-4 w-2/3" />
                    </CardHeader>
                    <CardContent className="p-5 pt-0 space-y-3">
                      {[1, 2, 3].map((j) => (
                        <div key={j} className="p-3 border rounded-lg space-y-2">
                          <Skeleton className="h-4 w-full" />
                          <Skeleton className="h-3 w-1/3" />
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                ))}
              </>
            ) : floorActivity && floorActivity.length > 0 ? (
              floorActivity.map((feed, idx) => (
                <Card key={idx}>
                  <CardHeader className="p-5">
                    <CardTitle className="text-base">
                      {feed.source}
                    </CardTitle>
                    <CardDescription>
                      Latest updates from congressional RSS feeds
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-5 pt-0">
                    {feed.error ? (
                      <div className="flex flex-col items-center justify-center py-8 text-center">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
                          <FileText className="h-5 w-5 text-destructive" />
                        </div>
                        <p className="mt-4 text-sm font-semibold">Failed to load feed</p>
                        <p className="mt-1 text-sm text-muted-foreground">Try refreshing in a moment.</p>
                      </div>
                    ) : feed.items && feed.items.length > 0 ? (
                      <ScrollArea className="h-[400px]">
                        <div className="space-y-2 pr-4">
                          {feed.items.map((item, itemIdx) => (
                            <div
                              key={itemIdx}
                              className="p-3 border rounded-lg hover-elevate"
                              data-testid={`floor-item-${idx}-${itemIdx}`}
                            >
                              <a
                                href={item.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm font-medium hover:text-primary line-clamp-2"
                              >
                                {item.title}
                              </a>
                              {item.pubDate && (
                                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {format(new Date(item.pubDate), "MMM d, yyyy h:mm a")}
                                </p>
                              )}
                              {item.content && (
                                <p className="text-sm text-muted-foreground mt-2 line-clamp-3">
                                  {item.content}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-8 text-center">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                          <Gavel className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <p className="mt-4 text-sm font-semibold">No recent floor activity</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {calendarData?.currentPeriod?.type === "recess"
                            ? "Activity resumes when Congress returns to session."
                            : "Check back for updates during session."}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            ) : floorError ? (
              <Card className="md:col-span-2">
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
                    <FileText className="h-5 w-5 text-destructive" />
                  </div>
                  <p className="mt-4 text-sm font-semibold">Failed to load floor activity</p>
                  <p className="mt-1 text-sm text-muted-foreground">Please try again in a moment.</p>
                  <Button variant="outline" size="sm" className="mt-4" onClick={() => refetchFloor()}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Retry
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card className="md:col-span-2">
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <p className="mt-4 text-sm font-semibold">No floor activity data available</p>
                  <p className="mt-1 text-sm text-muted-foreground">Floor updates will appear here as the chambers post them.</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}
