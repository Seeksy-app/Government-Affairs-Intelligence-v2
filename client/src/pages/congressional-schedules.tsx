import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  Calendar,
  Building2,
  Clock,
  MapPin,
  Users,
  ExternalLink,
  RefreshCw,
  Gavel,
  FileText,
} from "lucide-react";
import { format, parseISO } from "date-fns";

interface CommitteeMeeting {
  eventId: number;
  updateDate: string;
  chamber: string;
  congress: number;
  type: string;
  meetingStatus: string;
  date: string;
  time?: string;
  room?: string;
  building?: string;
  address?: string;
  committees?: Array<{
    systemCode: string;
    name: string;
    url: string;
  }>;
  title?: string;
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

export default function CongressionalSchedules() {
  const [chamber, setChamber] = useState<string>("house");
  const [activeTab, setActiveTab] = useState("committee");

  const { data: committeeMeetings, isLoading: meetingsLoading, error: meetingsError, refetch: refetchMeetings } = useQuery<CommitteeMeeting[]>({
    queryKey: ["/api/congress/schedule/committee-meetings", chamber],
    queryFn: async () => {
      const res = await fetch(`/api/congress/schedule/committee-meetings?chamber=${chamber}&limit=50`);
      if (!res.ok) throw new Error("Failed to fetch committee meetings");
      return res.json();
    },
  });

  const { data: floorActivity, isLoading: floorLoading, error: floorError, refetch: refetchFloor } = useQuery<FloorActivity[]>({
    queryKey: ["/api/congress/schedule/leadership"],
  });

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

  const formatMeetingTime = (timeStr?: string) => {
    if (!timeStr) return "";
    try {
      const [hours, minutes] = timeStr.split(":");
      const hour = parseInt(hours);
      const ampm = hour >= 12 ? "PM" : "AM";
      const hour12 = hour % 12 || 12;
      return `${hour12}:${minutes} ${ampm}`;
    } catch {
      return timeStr;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Calendar className="h-6 w-6" />
            Congressional Schedules
          </h1>
          <p className="text-muted-foreground mt-1">
            Track committee meetings and floor activity
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={chamber} onValueChange={setChamber}>
            <SelectTrigger className="w-[150px]" data-testid="select-chamber">
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

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="committee" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Committee Meetings
          </TabsTrigger>
          <TabsTrigger value="floor" className="flex items-center gap-2">
            <Gavel className="h-4 w-4" />
            Floor Activity
          </TabsTrigger>
        </TabsList>

        <TabsContent value="committee" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                {chamber === "house" ? "House" : "Senate"} Committee Meetings
              </CardTitle>
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
                                <Badge className={getStatusColor(meeting.meetingStatus)}>
                                  {meeting.meetingStatus}
                                </Badge>
                                <Badge variant="outline">
                                  {meeting.type || "Meeting"}
                                </Badge>
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
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-4 w-4" />
                                  {formatMeetingDate(meeting.date)}
                                </span>
                                {meeting.time && (
                                  <span className="flex items-center gap-1">
                                    <Clock className="h-4 w-4" />
                                    {formatMeetingTime(meeting.time)}
                                  </span>
                                )}
                                {(meeting.room || meeting.building) && (
                                  <span className="flex items-center gap-1">
                                    <MapPin className="h-4 w-4" />
                                    {meeting.room && `Room ${meeting.room}`}
                                    {meeting.room && meeting.building && ", "}
                                    {meeting.building}
                                  </span>
                                )}
                              </div>
                            </div>
                            {meeting.committees && meeting.committees[0]?.url && (
                              <Button variant="ghost" size="icon" asChild>
                                <a
                                  href={meeting.committees[0].url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  <ExternalLink className="h-4 w-4" />
                                </a>
                              </Button>
                            )}
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
                  <p className="text-sm">Check back later for updates</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="floor" className="mt-4">
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
                  </CardHeader>
                  <CardContent>
                    {feed.error ? (
                      <p className="text-muted-foreground text-sm">Failed to load</p>
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
                      <p className="text-muted-foreground text-sm text-center py-6">
                        No recent floor activity
                      </p>
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
