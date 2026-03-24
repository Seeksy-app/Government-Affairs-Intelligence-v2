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

// Simple relationship map using SVG
function RelationshipMap({ sections, stafferName, memberName }: { sections: StrategySection[]; stafferName: string; memberName: string }) {
  const pathways = sections.find(s => s.title === "RELATIONSHIP PATHWAYS");
  const nodes = pathways?.bullets.slice(0, 5) || [];

  if (!nodes.length) return null;

  const cx = 400, cy = 220, r = 160;
  const colors = ["#3b82f6", "#8b5cf6", "#22c55e", "#f59e0b", "#ef4444"];

  return (
    <div className="rounded-2xl border bg-card p-6">
      <h3 className="text-base font-semibold mb-4 flex items-center gap-2">
        <Users className="h-4 w-4 text-muted-foreground" />
        Connection Map
      </h3>
      <div className="overflow-x-auto">
        <svg viewBox="0 0 800 440" className="w-full max-w-2xl mx-auto" style={{ minWidth: 500 }}>
          {/* Center node - staffer */}
          <circle cx={cx} cy={cy} r={48} fill="#0f172a" />
          <text x={cx} y={cy - 8} textAnchor="middle" fill="white" fontSize="13" fontWeight="bold">
            {stafferName.split(' ')[0]}
          </text>
          <text x={cx} y={cy + 10} textAnchor="middle" fill="#94a3b8" fontSize="10">
            {stafferName.split(' ').slice(1).join(' ')}
          </text>
          <text x={cx} y={cy + 24} textAnchor="middle" fill="#64748b" fontSize="9">
            via {memberName.split(' ').pop()}
          </text>

          {nodes.map((node, i) => {
            const angle = (i / nodes.length) * 2 * Math.PI - Math.PI / 2;
            const nx = cx + r * Math.cos(angle);
            const ny = cy + r * Math.sin(angle);
            const color = colors[i % colors.length];
            const label = node.split(':')[0].replace(/\[.*?\]/g, '').trim().slice(0, 35);
            const sub = (node.split(':')[1] || '').trim().replace(/\[.*?\]/g, '').slice(0, 45);

            return (
              <g key={i}>
                {/* Connection line */}
                <line
                  x1={cx} y1={cy}
                  x2={nx} y2={ny}
                  stroke={color}
                  strokeWidth="1.5"
                  strokeDasharray="5,3"
                  opacity="0.5"
                />
                {/* Dot at midpoint */}
                <circle
                  cx={(cx + nx) / 2}
                  cy={(cy + ny) / 2}
                  r={4}
                  fill={color}
                  opacity="0.7"
                />
                {/* Node bubble */}
                <circle cx={nx} cy={ny} r={32} fill={color} opacity="0.15" stroke={color} strokeWidth="1.5" />
                <text x={nx} y={ny - 4} textAnchor="middle" fill={color} fontSize="10" fontWeight="600">
                  {label.length > 18 ? label.slice(0, 16) + '…' : label}
                </text>
                {sub && (
                  <text x={nx} y={ny + 10} textAnchor="middle" fill="#64748b" fontSize="8">
                    {sub.length > 22 ? sub.slice(0, 20) + '…' : sub}
                  </text>
                )}
                <text x={nx} y={ny - 44} textAnchor="middle" fill={color} fontSize="18" fontWeight="bold">
                  {i + 1}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <div className="mt-3 space-y-2">
        {nodes.map((node, i) => (
          <div key={i} className="flex items-start gap-2 text-sm">
            <span className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white" style={{ background: colors[i % colors.length] }}>{i + 1}</span>
            <span className="text-muted-foreground text-xs leading-relaxed">{node.replace(/\[.*?\]/g, '').replace(/\*\*/g, '').trim()}</span>
          </div>
        ))}
      </div>
    </div>
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
          customPrompt: `You are a senior government affairs strategist. Provide a comprehensive relationship intelligence report for a lobbying firm seeking to build access to ${data.memberName}'s office through ${data.name}.

Staffer: ${data.name}
Title: ${data.title}
Office: ${data.memberName} (${data.memberParty || 'R'}-${data.memberState || 'Unknown'})

Provide a structured report with EXACTLY these section headers (use **HEADER** format):

**ROLE & INFLUENCE**
What decisions does this staffer actually control? What is their real influence vs their title? How do they fit in the office hierarchy?

**CAREER BACKGROUND**
Their career path, private sector experience, campaign work, other Hill offices, industries they've been adjacent to. What shaped their worldview?

**RELATIONSHIP PATHWAYS**
List exactly 4-5 specific, actionable pathways a lobbyist can use to build a relationship with or through this staffer. Format as bullet points. Be specific — name the types of organizations, alumni networks, events, or shared connections that would work:
- [Pathway 1]: [specific details]
- [Pathway 2]: [specific details]
- [Pathway 3]: [specific details]
- [Pathway 4]: [specific details]
- [Pathway 5]: [specific details]

**POLICY LEVERAGE POINTS**
What issues does this staffer own or influence? What topics would make them agree to a meeting? What client needs could align with their policy portfolio?

**APPROACH STRATEGY**
The single best recommended first move. Be specific and actionable — what exact type of outreach, through what channel, on what topic, would be most likely to get a response from this particular staffer given their background and role.

**RISK FACTORS**
Political sensitivities, office dynamics, landmines to avoid, or contextual factors that could undermine an outreach attempt.`
        }),
      });

      const result = await response.json();
      if (result.success && result.data?.rawContent) {
        setStrategy(result.data.rawContent);
        setSections(parseStrategy(result.data.rawContent));
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
