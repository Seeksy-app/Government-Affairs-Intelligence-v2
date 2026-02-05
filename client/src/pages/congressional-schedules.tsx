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
  Building2,
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
    queryKey: ["/api/client/portals"],
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
        return "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300";
      case "canceled":
        return "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300";
      case "postponed":
        return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300";
      case "rescheduled":
        return "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300";
      default:
        return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
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
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Calendar className="h-6 w-6 flex-shrink-0" />
            Congressional Schedules
          </h1>
          <p className="text-muted-foreground mt-1">
            Track session calendar, committee meetings, and floor activity
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
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
        </div>
      </div>

      {/* Current Status Banner */}
      {calendarData?.currentPeriod && (
        <Card className={calendarData.currentPeriod.type === "session" 
          ? "border-green-500 bg-green-50 dark:bg-green-950/30" 
          : "border-blue-500 bg-blue-50 dark:bg-blue-950/30"
        }>
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              {calendarData.currentPeriod.type === "session" ? (
                <Building className="h-5 w-5 text-green-600 dark:text-green-400" />
              ) : (
                <Plane className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              )}
              <div>
                <p className="font-medium">
                  Congress is currently {calendarData.currentPeriod.type === "session" ? "IN SESSION" : "IN RECESS"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {calendarData.currentPeriod.description} ({format(parseISO(calendarData.currentPeriod.start), "MMM d")} - {format(parseISO(calendarData.currentPeriod.end), "MMM d, yyyy")})
                </p>
              </div>
              <Badge className={`ml-auto ${calendarData.currentPeriod.type === "session" 
                ? "bg-green-600" 
                : "bg-blue-600"
              }`}>
                {calendarData.currentPeriod.type === "session" ? "Members in DC" : "Members in Districts"}
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
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

        <TabsContent value="calendar" className="mt-4">
          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarDays className="h-5 w-5" />
                  2026 Congressional Calendar
                </CardTitle>
                <CardDescription>
                  119th Congress, 2nd Session - Session periods vs. District Work Periods
                </CardDescription>
              </CardHeader>
              <CardContent>
                {calendarLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Skeleton key={i} className="h-12 w-full" />
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
                                ? period.type === "session"
                                  ? "bg-green-100 border-green-300 dark:bg-green-950 dark:border-green-700"
                                  : "bg-blue-100 border-blue-300 dark:bg-blue-950 dark:border-blue-700"
                                : isUpcoming
                                  ? "bg-yellow-50 border-yellow-200 dark:bg-yellow-950/30 dark:border-yellow-800"
                                  : ""
                            }`}
                            data-testid={`calendar-period-${idx}`}
                          >
                            {period.type === "session" ? (
                              <Building className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                            ) : (
                              <Plane className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium">{period.description}</span>
                                {isCurrent && (
                                  <Badge variant="outline" className="text-xs">Current</Badge>
                                )}
                                {isUpcoming && !isCurrent && (
                                  <Badge variant="outline" className="text-xs bg-yellow-100 dark:bg-yellow-900">Upcoming</Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {format(parseISO(period.start), "MMM d")} - {format(parseISO(period.end), "MMM d, yyyy")}
                              </p>
                            </div>
                            <Badge className={period.type === "session" 
                              ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" 
                              : "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                            }>
                              {period.type === "session" ? "In DC" : "District"}
                            </Badge>
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                ) : (
                  <p className="text-muted-foreground text-center py-8">
                    Calendar data not available
                  </p>
                )}
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Info className="h-4 w-4" />
                    Meeting Planning Tips
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-start gap-2">
                      <Building className="h-4 w-4 text-green-600 mt-0.5" />
                      <div>
                        <p className="font-medium text-sm">During Session</p>
                        <p className="text-xs text-muted-foreground">
                          Members are in Washington, D.C. Best for meetings at Capitol Hill offices. Tuesday-Thursday are typically busiest.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <Plane className="h-4 w-4 text-blue-600 mt-0.5" />
                      <div>
                        <p className="font-medium text-sm">During Recess</p>
                        <p className="text-xs text-muted-foreground">
                          Members return to home districts. Ideal for local meetings and town halls.
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {calendarData?.nextPeriod && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Clock className="h-4 w-4" />
                      Coming Up
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-3">
                      {calendarData.nextPeriod.type === "session" ? (
                        <Building className="h-5 w-5 text-green-600" />
                      ) : (
                        <Plane className="h-5 w-5 text-blue-600" />
                      )}
                      <div>
                        <p className="font-medium">{calendarData.nextPeriod.description}</p>
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
            <CardHeader className="pb-4">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  {chamber === "house" ? "House" : "Senate"} Committee Meetings
                </CardTitle>
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by title, committee, witness..."
                      value={searchText}
                      onChange={(e) => setSearchText(e.target.value)}
                      className="pl-9 w-[250px]"
                      data-testid="input-meeting-search"
                    />
                  </div>
                </div>
              </div>
              
              <div className="flex flex-wrap items-end gap-3 mt-3 pt-3 border-t">
                <div className="flex items-center gap-2">
                  <CalendarRange className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Date Range:</span>
                </div>
                <div className="flex items-center gap-2">
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
                  <span className="text-muted-foreground">to</span>
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
                      data-testid="button-clear-dates"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
              
              <p className="text-sm text-muted-foreground mt-2">
                {startDate || endDate 
                  ? `Showing meetings ${startDate ? `from ${format(parseISO(startDate), "MMM d, yyyy")}` : ""} ${endDate ? `to ${format(parseISO(endDate), "MMM d, yyyy")}` : ""}`
                  : "Showing up to 30 most recent meetings with full details"
                }
              </p>
            </CardHeader>
            <CardContent>
              {meetingsLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="p-4 border rounded-lg space-y-2">
                      <Skeleton className="h-5 w-3/4" />
                      <Skeleton className="h-4 w-1/2" />
                      <Skeleton className="h-4 w-1/3" />
                    </div>
                  ))}
                </div>
              ) : committeeMeetings && committeeMeetings.length > 0 ? (
                <ScrollArea className="h-[600px]">
                  <div className="space-y-4 pr-4">
                    {committeeMeetings.map((meeting) => (
                      <Card
                        key={meeting.eventId}
                        className="hover-elevate"
                        data-testid={`meeting-card-${meeting.eventId}`}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2 flex-wrap">
                                {meeting.meetingStatus && (
                                  <Badge className={getStatusColor(meeting.meetingStatus)}>
                                    {meeting.meetingStatus}
                                  </Badge>
                                )}
                                {meeting.type && (
                                  <Badge variant="outline">
                                    {meeting.type}
                                  </Badge>
                                )}
                              </div>
                              
                              {meeting.committees && meeting.committees.length > 0 && (
                                <h3 className="font-semibold text-lg mb-1">
                                  {meeting.committees[0].name}
                                </h3>
                              )}
                              
                              {meeting.title && (
                                <p className="text-muted-foreground mb-2 line-clamp-2">
                                  {meeting.title}
                                </p>
                              )}

                              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                                {meeting.date && (
                                  <span className="flex items-center gap-1">
                                    <Calendar className="h-4 w-4" />
                                    {formatMeetingDate(meeting.date)}
                                  </span>
                                )}
                                {meeting.date && (
                                  <span className="flex items-center gap-1">
                                    <Clock className="h-4 w-4" />
                                    {formatMeetingTime(meeting.date)}
                                  </span>
                                )}
                                {meeting.location && (meeting.location.room || meeting.location.building) && (
                                  <span className="flex items-center gap-1">
                                    <MapPin className="h-4 w-4" />
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
                                      <Badge key={idx} variant="secondary" className="text-xs">
                                        {witness.name}
                                        {witness.position && ` - ${witness.position}`}
                                      </Badge>
                                    ))}
                                    {meeting.witnesses.length > 4 && (
                                      <Badge variant="outline" className="text-xs">
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
                                            <Check className="h-4 w-4 text-green-500" />
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
                <div className="text-center py-12 text-muted-foreground">
                  <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50 text-destructive" />
                  <p className="font-medium text-destructive">Failed to load committee meetings</p>
                  <p className="text-sm mb-4">Please try again later</p>
                  <Button variant="outline" onClick={() => refetchMeetings()}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Retry
                  </Button>
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p className="font-medium">No committee meetings found</p>
                  <p className="text-sm">
                    {searchText ? "Try a different search term" : "Check back later for updates"}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="floor" className="mt-4">
          {/* Session Status Context */}
          {calendarData?.currentPeriod && calendarData.currentPeriod.type === "recess" && (
            <Card className="mb-4 border-blue-500 bg-blue-50 dark:bg-blue-950/30">
              <CardContent className="py-4">
                <div className="flex items-center gap-3">
                  <Info className="h-5 w-5 text-blue-600" />
                  <div>
                    <p className="font-medium text-blue-900 dark:text-blue-100">
                      Congress is currently in recess
                    </p>
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      Floor activity is typically paused during {calendarData.currentPeriod.description}. 
                      Members return on {calendarData.nextPeriod ? format(parseISO(calendarData.nextPeriod.start), "MMMM d, yyyy") : "their next scheduled session"}.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          
          <div className="grid gap-6 md:grid-cols-2">
            {floorLoading ? (
              <>
                {[1, 2].map((i) => (
                  <Card key={i}>
                    <CardHeader>
                      <Skeleton className="h-6 w-1/2" />
                    </CardHeader>
                    <CardContent className="space-y-3">
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
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Gavel className="h-5 w-5" />
                      {feed.source}
                    </CardTitle>
                    <CardDescription>
                      Real-time updates from congressional RSS feeds
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {feed.error ? (
                      <div className="text-center py-6">
                        <FileText className="h-8 w-8 mx-auto mb-2 opacity-50 text-destructive" />
                        <p className="text-muted-foreground text-sm">Failed to load feed</p>
                      </div>
                    ) : feed.items && feed.items.length > 0 ? (
                      <ScrollArea className="h-[400px]">
                        <div className="space-y-3 pr-4">
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
                                className="font-medium hover:text-primary hover:underline line-clamp-2"
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
                      <div className="text-center py-6">
                        <Gavel className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-muted-foreground text-sm">No recent floor activity</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {calendarData?.currentPeriod?.type === "recess" 
                            ? "Activity resumes when Congress returns to session" 
                            : "Check back for updates during session"}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            ) : floorError ? (
              <Card className="col-span-2">
                <CardContent className="py-12 text-center text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-3 opacity-50 text-destructive" />
                  <p className="font-medium text-destructive">Failed to load floor activity</p>
                  <p className="text-sm mb-4">Please try again later</p>
                  <Button variant="outline" onClick={() => refetchFloor()}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Retry
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card className="col-span-2">
                <CardContent className="py-12 text-center text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p className="font-medium">No floor activity data available</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
