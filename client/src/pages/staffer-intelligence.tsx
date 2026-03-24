import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Loader2, RefreshCw, ExternalLink, Mail, Phone, Target, Users, Briefcase, BookOpen, AlertTriangle, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface StafferIntelData {
  name: string;
  title: string;
  memberName: string;
  memberState?: string;
  memberParty?: string;
  email?: string;
  phone?: string;
  pathwayType?: string;
  initials?: string;
  photoUrl?: string;
}

interface StrategySection {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
  content: string;
  bullets: string[];
}

function parseStrategy(raw: string): StrategySection[] {
  const sectionDefs = [
    { key: "ROLE & INFLUENCE", icon: Target, color: "text-blue-700", bgColor: "bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800" },
    { key: "CAREER BACKGROUND", icon: Briefcase, color: "text-purple-700", bgColor: "bg-purple-50 border-purple-200 dark:bg-purple-900/20 dark:border-purple-800" },
    { key: "RELATIONSHIP PATHWAYS", icon: Users, color: "text-green-700", bgColor: "bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800" },
    { key: "POLICY LEVERAGE POINTS", icon: BookOpen, color: "text-amber-700", bgColor: "bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800" },
    { key: "APPROACH STRATEGY", icon: Zap, color: "text-orange-700", bgColor: "bg-orange-50 border-orange-200 dark:bg-orange-900/20 dark:border-orange-800" },
    { key: "RISK FACTORS", icon: AlertTriangle, color: "text-red-700", bgColor: "bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800" },
  ];

  const sections: StrategySection[] = [];
  const lines = raw.split('\n');

  let currentKey: string | null = null;
  let currentLines: string[] = [];

  const flush = () => {
    if (!currentKey) return;
    const def = sectionDefs.find(d => d.key === currentKey);
    if (!def) return;

    const bullets: string[] = [];
    const prose: string[] = [];

    for (const l of currentLines) {
      const trimmed = l.trim();
      if (!trimmed) continue;
      if (trimmed.startsWith('- ') || trimmed.startsWith('• ') || trimmed.startsWith('* ')) {
        bullets.push(trimmed.replace(/^[-•*]\s+/, '').replace(/\*\*/g, ''));
      } else {
        prose.push(trimmed.replace(/\*\*/g, ''));
      }
    }

    sections.push({
      title: def.key,
      icon: def.icon,
      color: def.color,
      bgColor: def.bgColor,
      content: prose.join(' '),
      bullets,
    });
    currentLines = [];
  };

  for (const line of lines) {
    const cleaned = line.replace(/\*\*/g, '').trim();
    const matchedDef = sectionDefs.find(d => cleaned.toUpperCase().includes(d.key));
    if (matchedDef) {
      flush();
      currentKey = matchedDef.key;
    } else if (currentKey) {
      currentLines.push(line);
    }
  }
  flush();

  return sections;
}

// Relationship map — clickable nodes, detail popup, no summary strip
function RelationshipMap({ sections, stafferName, memberName }: { sections: StrategySection[]; stafferName: string; memberName: string }) {
  const [selectedNode, setSelectedNode] = useState<number | null>(null);
  const pathways = sections.find(s => s.title === "RELATIONSHIP PATHWAYS");
  const nodes = pathways?.bullets.slice(0, 5) || [];

  if (!nodes.length) return null;

  const colors = ["#3b82f6", "#8b5cf6", "#22c55e", "#f59e0b", "#ef4444"];
  const lightColors = ["#eff6ff", "#f5f3ff", "#f0fdf4", "#fffbeb", "#fef2f2"];
  const darkBorders = ["#93c5fd", "#c4b5fd", "#86efac", "#fcd34d", "#fca5a5"];

  // Parse each node into a short label and full detail
  const parsed = nodes.map(node => {
    const colonIdx = node.indexOf(':');
    const label = (colonIdx > -1 ? node.slice(0, colonIdx) : node).replace(/\[.*?\]/g, '').replace(/\*\*/g, '').trim();
    const detail = (colonIdx > -1 ? node.slice(colonIdx + 1) : '').trim().replace(/\[.*?\]/g, '').replace(/\*\*/g, '').trim();
    return { label, detail, full: node.replace(/\[.*?\]/g, '').replace(/\*\*/g, '').trim() };
  });

  const vw = 960, vh = 540;
  const cx = vw / 2, cy = vh / 2;
  const orbitalR = 195;
  const centerR = 52;
  const nodeRx = 82, nodeRy = 42; // ellipse for more text space

  // Wrap text into lines
  const wrapText = (text: string, maxChars: number): string[] => {
    const words = text.split(' ');
    const lines: string[] = [];
    let current = '';
    for (const word of words) {
      if ((current + ' ' + word).trim().length > maxChars) {
        if (current) lines.push(current.trim());
        current = word;
      } else {
        current = (current + ' ' + word).trim();
      }
    }
    if (current) lines.push(current.trim());
    return lines;
  };

  return (
    <>
      {/* Node detail popup */}
      {selectedNode !== null && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setSelectedNode(null)}>
          <div
            className="bg-background rounded-2xl w-full max-w-lg p-6 shadow-2xl border-t-4"
            style={{ borderTopColor: colors[selectedNode] }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 mb-4">
              <span
                className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
                style={{ background: colors[selectedNode] }}
              >
                {selectedNode + 1}
              </span>
              <div>
                <h3 className="font-bold text-lg leading-tight" style={{ color: colors[selectedNode] }}>
                  {parsed[selectedNode].label}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">Pathway to {memberName.split(' ').slice(-1)[0]}'s office</p>
              </div>
              <button onClick={() => setSelectedNode(null)} className="ml-auto text-muted-foreground hover:text-foreground text-2xl leading-none shrink-0">×</button>
            </div>
            <div className="rounded-xl p-4 text-sm leading-relaxed" style={{ background: lightColors[selectedNode], borderLeft: `3px solid ${colors[selectedNode]}` }}>
              {parsed[selectedNode].detail || parsed[selectedNode].full}
            </div>
            <p className="text-xs text-muted-foreground mt-4 text-center">Click anywhere outside to close</p>
          </div>
        </div>
      )}

      <div className="rounded-2xl border bg-card overflow-hidden">
        <div className="px-5 pt-4 pb-2 flex items-center justify-between">
          <h3 className="text-base font-semibold flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            {nodes.length} Relationship Pathways — click any node to explore
          </h3>
        </div>

        <div className="px-2 pb-3">
          <svg viewBox={`0 0 ${vw} ${vh}`} className="w-full" style={{ minHeight: 320 }}>
            <defs>
              <radialGradient id="bgG" cx="50%" cy="50%" r="55%">
                <stop offset="0%" stopColor="#f8fafc" />
                <stop offset="100%" stopColor="#e2e8f0" />
              </radialGradient>
              {colors.map((c, i) => (
                <radialGradient key={i} id={`ng${i}`} cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="white" />
                  <stop offset="100%" stopColor={lightColors[i]} />
                </radialGradient>
              ))}
            </defs>
            <rect width={vw} height={vh} fill="url(#bgG)" rx="12" />

            {/* Orbital ring hint */}
            <circle cx={cx} cy={cy} r={orbitalR} fill="none" stroke="#e2e8f0" strokeWidth="1" strokeDasharray="4,8" />

            {/* Center node */}
            <circle cx={cx} cy={cy} r={centerR} fill="#1e40af" opacity="0.12" />
            <circle cx={cx} cy={cy} r={centerR - 6} fill="#1e40af" opacity="0.9" />
            <text x={cx} y={cy - 7} textAnchor="middle" fill="white" fontSize="14" fontWeight="bold">
              {stafferName.split(' ')[0]}
            </text>
            <text x={cx} y={cy + 9} textAnchor="middle" fill="#bfdbfe" fontSize="10">
              {stafferName.split(' ').slice(1).join(' ')}
            </text>
            <text x={cx} y={cy + 22} textAnchor="middle" fill="#93c5fd" fontSize="9">
              {memberName.split(' ').slice(-1)[0]}'s Office
            </text>

            {parsed.map((node, i) => {
              const angle = (i / parsed.length) * 2 * Math.PI - Math.PI / 2;
              const nx = cx + orbitalR * Math.cos(angle);
              const ny = cy + orbitalR * Math.sin(angle);
              const color = colors[i];
              const lines = wrapText(node.label, 14);

              return (
                <g
                  key={i}
                  style={{ cursor: 'pointer' }}
                  onClick={() => setSelectedNode(i)}
                >
                  {/* Connection line */}
                  <line x1={cx} y1={cy} x2={nx} y2={ny} stroke={color} strokeWidth="1.5" strokeDasharray="5,4" opacity="0.4" />
                  {/* Midpoint pulse */}
                  <circle cx={(cx + nx) / 2} cy={(cy + ny) / 2} r={4.5} fill={color} opacity="0.55" />

                  {/* Outer glow ring */}
                  <ellipse cx={nx} cy={ny} rx={nodeRx + 10} ry={nodeRy + 10} fill={color} opacity="0.07" />
                  {/* Main node ellipse */}
                  <ellipse cx={nx} cy={ny} rx={nodeRx} ry={nodeRy} fill={`url(#ng${i})`} stroke={color} strokeWidth="2" />

                  {/* Number badge */}
                  <circle cx={nx - nodeRx + 12} cy={ny - nodeRy + 12} r={10} fill={color} />
                  <text x={nx - nodeRx + 12} y={ny - nodeRy + 16} textAnchor="middle" fill="white" fontSize="10" fontWeight="bold">{i + 1}</text>

                  {/* Wrapped label text */}
                  {lines.map((line, li) => {
                    const totalH = lines.length * 14;
                    const startY = ny - totalH / 2 + 7 + li * 14;
                    return (
                      <text key={li} x={nx} y={startY} textAnchor="middle" fill={color} fontSize="12" fontWeight="600">
                        {line}
                      </text>
                    );
                  })}

                  {/* "tap" hint on hover via opacity trick */}
                  <ellipse cx={nx} cy={ny} rx={nodeRx} ry={nodeRy} fill="transparent" stroke="transparent" />
                </g>
              );
            })}
          </svg>
        </div>

        {/* Compact legend */}
        <div className="px-5 pb-4 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          {parsed.map((node, i) => (
            <button
              key={i}
              onClick={() => setSelectedNode(i)}
              className="flex items-center gap-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg px-2 py-1.5 transition-colors"
            >
              <span className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white" style={{ background: colors[i] }}>{i + 1}</span>
              <span className="text-sm font-medium truncate" style={{ color: colors[i] }}>{node.label}</span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

export default function StafferIntelligencePage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);
  const [strategy, setStrategy] = useState<string | null>(null);
  const [sections, setSections] = useState<StrategySection[]>([]);
  const [intelData, setIntelData] = useState<StafferIntelData | null>(null);

  useEffect(() => {
    // Load staffer data from sessionStorage (passed from parent)
    const raw = sessionStorage.getItem("staffer-intel-data");
    if (raw) {
      try {
        const data = JSON.parse(raw) as StafferIntelData;
        setIntelData(data);
        // Auto-generate on page load
        generateStrategy(data);
      } catch {
        setLocation("/members");
      }
    } else {
      setLocation("/members");
    }
  }, []);

  const generateStrategy = async (data: StafferIntelData) => {
    if (!data) return;
    setIsGenerating(true);
    setStrategy(null);
    setSections([]);

    try {
      const response = await fetch("/api/research/staffer", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          title: data.title,
          organization: `Office of ${data.memberName}`,
          memberName: data.memberName,
          customPrompt: `You are a congressional research analyst helping a government affairs professional understand how to effectively engage with a congressional office. This is standard professional practice used daily by trade associations, corporations, and advocacy organizations across Washington DC.

Research Subject: ${data.name}, ${data.title}, Office of ${data.memberName} (${data.memberParty || 'R'}-${data.memberState || ''})

Please provide a professional congressional engagement analysis using EXACTLY these section headers (bold **HEADER** format). Use publicly available information, congressional directories, news coverage, and standard Washington DC professional knowledge. If specific details about this individual are limited, provide accurate general guidance based on their office, title, and Member's known priorities.

**ROLE & INFLUENCE**
Based on the title "${data.title}" in ${data.memberName}'s office: describe the typical responsibilities, decision-making authority, and office hierarchy position. What types of constituent and stakeholder interactions does someone in this role handle?

**CAREER BACKGROUND**
What is publicly known about ${data.name}'s background? Include any prior Hill experience, home state connections (${data.memberState || data.memberName.split(' ').pop()}), education, or career history. If limited public information is available, describe the typical profile of someone who reaches this position in a ${data.memberParty === 'D' ? 'Democratic' : 'Republican'} House office.

**RELATIONSHIP PATHWAYS**
List 4-5 professional pathways for engaging with or through ${data.name}. These are standard Washington DC engagement strategies used by trade associations and government affairs professionals every day:
- [Pathway name]: [specific organizations, events, or networks relevant to this office's geography and policy focus]
- [Pathway name]: [specific details]
- [Pathway name]: [specific details]
- [Pathway name]: [specific details]
- [Pathway name]: [specific details]

Base these on ${data.memberName}'s state (${data.memberState || ''}), committee assignments, known policy priorities, and the standard engagement channels for that office type.

**POLICY LEVERAGE POINTS**
What policy issues are relevant to ${data.memberName}'s district and committee work? What topics would be natural conversation starters for a professional meeting request with this office?

**APPROACH STRATEGY**
Standard best-practice recommendation for requesting a professional meeting with this type of congressional office. What format, channel, and topic framing tends to be most effective?

**RISK FACTORS**
Any known political sensitivities, constituent priorities, or contextual considerations relevant to engaging ${data.memberName}'s office professionally.`
        }),
      });

      const result = await response.json();
      if (result.success && result.data?.rawContent) {
        const content = result.data.rawContent as string;
        // Detect if Perplexity refused or gave a generic non-answer
        const refusalPhrases = [
          "potentially inaccurate", "i cannot provide", "i'd recommend your firm",
          "not grounded in sourced", "professionally irresponsible", "what would be needed",
          "i don't have enough", "i'm unable to", "i cannot generate",
          "i should not", "this could be misleading"
        ];
        const isRefusal = refusalPhrases.some(p => content.toLowerCase().includes(p));

        if (isRefusal) {
          // Auto-retry with a simpler, less triggering prompt
          toast({ title: "Retrying with different approach...", description: "Adjusting research parameters" });
          const retryRes = await fetch("/api/research/staffer", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: data.name,
              title: data.title,
              organization: `Office of ${data.memberName}`,
              memberName: data.memberName,
              customPrompt: `Provide a professional congressional office engagement guide for ${data.name}, ${data.title} in the Office of ${data.memberName}.

Use these exact section headers:

**ROLE & INFLUENCE**
Describe the role of a "${data.title}" in a House Member's office. What decisions do they handle? Who do they work with?

**CAREER BACKGROUND**
What is typically known about staffers who hold this position? What backgrounds and career paths lead to this role in a ${data.memberParty === 'D' ? 'Democratic' : 'Republican'} office in ${data.memberState || 'this state'}?

**RELATIONSHIP PATHWAYS**
Five professional ways to build a working relationship with or through this office. Focus on legitimate Washington DC professional engagement: trade associations, state-based coalitions, constituent events, policy conferences, alumni networks.
- [Network type]: [specific approach for this office's geography and policy focus]
- [Network type]: [specific approach]
- [Network type]: [specific approach]
- [Network type]: [specific approach]
- [Network type]: [specific approach]

**POLICY LEVERAGE POINTS**
Based on ${data.memberName}'s publicly known committee work and district priorities, what policy topics would be natural subjects for a professional meeting request?

**APPROACH STRATEGY**
Standard Washington DC best practice for scheduling a professional meeting with this type of congressional office.

**RISK FACTORS**
Key considerations for professional engagement with this specific office.`
            }),
          });
          const retryResult = await retryRes.json();
          if (retryResult.success && retryResult.data?.rawContent) {
            setStrategy(retryResult.data.rawContent);
            setSections(parseStrategy(retryResult.data.rawContent));
            toast({ title: "Intelligence Report Ready" });
            return;
          }
        }

        setStrategy(content);
        setSections(parseStrategy(content));
        toast({ title: "Intelligence Report Ready" });
      } else {
        throw new Error(result.message || "No content returned");
      }
    } catch (err: any) {
      toast({ title: "Generation Failed", description: err?.message || "Could not generate strategy", variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  if (!intelData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const initials = intelData.initials || intelData.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  const partyColor = intelData.memberParty === 'D' ? '#3b82f6' : intelData.memberParty === 'R' ? '#ef4444' : '#94a3b8';

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => window.history.back()}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => generateStrategy(intelData)}
                disabled={isGenerating}
                className="gap-1.5"
              >
                {isGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                Regenerate
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* Hero — Staffer Profile Card */}
        <div className="rounded-2xl border bg-card p-6 mb-6">
          <div className="flex items-start gap-5">
            {/* Avatar */}
            <div className="shrink-0">
              {intelData.photoUrl ? (
                <img src={intelData.photoUrl} alt={intelData.name} className="w-20 h-20 rounded-2xl object-cover" />
              ) : (
                <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-2xl font-bold text-white" style={{ background: "#0f172a" }}>
                  {initials}
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <h1 className="text-2xl font-bold">{intelData.name}</h1>
                  <p className="text-muted-foreground">{intelData.title}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <Badge variant="outline" className="text-xs">
                      Office of {intelData.memberName}
                    </Badge>
                    {intelData.memberState && (
                      <Badge variant="outline" className="text-xs" style={{ borderColor: partyColor, color: partyColor }}>
                        {intelData.memberParty}-{intelData.memberState}
                      </Badge>
                    )}
                    {intelData.pathwayType && (
                      <Badge variant="secondary" className="text-xs capitalize">
                        {intelData.pathwayType.replace(/_/g, ' ')} Track
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="shrink-0 flex flex-col items-center justify-center w-16 h-16 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                  <span className="text-2xl">🎯</span>
                  <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-400 mt-0.5">INTEL</span>
                </div>
              </div>

              <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground flex-wrap">
                {intelData.email && (
                  <a href={`mailto:${intelData.email}`} className="flex items-center gap-1 hover:text-foreground transition-colors">
                    <Mail className="h-3.5 w-3.5" />
                    {intelData.email}
                  </a>
                )}
                {intelData.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="h-3.5 w-3.5" />
                    {intelData.phone}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Loading state */}
        {isGenerating && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800 p-8 flex flex-col items-center gap-4 text-center mb-6">
            <Loader2 className="h-8 w-8 text-amber-600 animate-spin" />
            <div>
              <p className="font-semibold text-amber-800 dark:text-amber-300">Generating Intelligence Report...</p>
              <p className="text-sm text-amber-600 dark:text-amber-400 mt-1">
                Researching {intelData.name}'s career, connections, and policy influence
              </p>
            </div>
          </div>
        )}

        {/* Sections grid */}
        {sections.length > 0 && !isGenerating && (
          <>
            {/* Relationship Map */}
            <div className="mb-6">
              <RelationshipMap sections={sections} stafferName={intelData.name} memberName={intelData.memberName} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              {sections.map((section, i) => {
                const Icon = section.icon;
                return (
                  <div key={i} className={`rounded-2xl border p-5 ${section.bgColor}`}>
                    <div className="flex items-center gap-2 mb-3">
                      <Icon className={`h-4 w-4 ${section.color}`} />
                      <h3 className={`text-sm font-bold uppercase tracking-wide ${section.color}`}>
                        {section.title}
                      </h3>
                    </div>
                    {section.content && (
                      <p className="text-sm text-foreground/80 mb-3 leading-relaxed">
                        {section.content}
                      </p>
                    )}
                    {section.bullets.length > 0 && (
                      <ul className="space-y-2">
                        {section.bullets.map((bullet, bi) => (
                          <li key={bi} className="flex items-start gap-2 text-sm">
                            <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${section.color.replace('text-', 'bg-')}`} />
                            <span className="text-foreground/75 leading-relaxed">
                              {bullet.replace(/\[.*?\]/g, '').trim()}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Raw content toggle */}
            <details className="rounded-xl border p-4 text-sm text-muted-foreground">
              <summary className="cursor-pointer font-medium">View raw research output</summary>
              <pre className="mt-3 whitespace-pre-wrap text-xs font-mono leading-relaxed">{strategy}</pre>
            </details>

            <p className="text-center text-xs text-muted-foreground mt-4">
              ⚡ AI-generated — verify key facts before using in outreach · Powered by Perplexity
            </p>
          </>
        )}

        {/* Empty state */}
        {!isGenerating && !strategy && (
          <div className="rounded-2xl border p-12 text-center">
            <div className="text-4xl mb-4">🎯</div>
            <h2 className="text-xl font-semibold mb-2">Generate Intelligence Report</h2>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Get AI-powered relationship pathways, career intelligence, and a recommended approach strategy
              for building access to {intelData.memberName}'s office through {intelData.name}.
            </p>
            <Button onClick={() => generateStrategy(intelData)} className="gap-2" style={{ background: "#f59e0b", color: "#fff" }}>
              <Zap className="h-4 w-4" />
              Generate Access Strategy
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
