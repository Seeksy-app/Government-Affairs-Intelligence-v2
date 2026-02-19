import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Shield, Lock, Server, Database, Eye, FileCheck, Globe, Key, Users, RefreshCw, ExternalLink } from "lucide-react";
import { Link } from "wouter";

const infrastructure = [
  {
    icon: Server,
    title: "Google Cloud Platform (GCP)",
    description: "Our platform is hosted on Google Cloud Platform data centers in the United States, providing enterprise-grade infrastructure with 99.9% uptime SLA, automatic failover, and geographic redundancy.",
  },
  {
    icon: Database,
    title: "PostgreSQL on Google Cloud SQL",
    description: "All data is stored in fully managed PostgreSQL databases via Google Cloud SQL with automated backups, point-in-time recovery, and high-availability configurations.",
  },
  {
    icon: Globe,
    title: "Replit Deployments",
    description: "Application deployments are managed through Replit's infrastructure with automatic TLS certificate provisioning, health checks, and zero-downtime deployments.",
  },
];

const encryption = [
  {
    icon: Lock,
    title: "AES-256 Encryption at Rest",
    description: "All stored data is encrypted using AES-256 server-side encryption, the same standard used by banks and government agencies.",
  },
  {
    icon: Shield,
    title: "TLS 1.2+ Encryption in Transit",
    description: "All data transmitted between your browser and our servers is protected with TLS 1.2 or higher, ensuring end-to-end encrypted communication.",
  },
  {
    icon: Key,
    title: "Secure Key Management",
    description: "Encryption keys are managed through Google Cloud KMS with automatic rotation, hardware-backed security modules, and strict access controls.",
  },
];

const accessControls = [
  {
    icon: Users,
    title: "Multi-Tenant Data Isolation",
    description: "Each client firm's data is fully isolated. Users can only access data belonging to their assigned organization, enforced at the database query level.",
  },
  {
    icon: Lock,
    title: "Password Security",
    description: "All passwords are hashed using bcrypt with industry-standard salt rounds. Plaintext passwords are never stored or logged.",
  },
  {
    icon: Key,
    title: "Session-Based Authentication",
    description: "Secure session cookies with HTTP-only and secure flags prevent cross-site scripting (XSS) and session hijacking attacks.",
  },
  {
    icon: Eye,
    title: "Role-Based Access Control",
    description: "Granular permission system with distinct roles (Super Admin, Client Admin, User) ensures users only access features appropriate to their role.",
  },
];

const compliance = [
  {
    title: "SOC 2 Type II",
    description: "Our infrastructure provider (Replit / GCP) maintains SOC 2 Type II certification, demonstrating ongoing adherence to security, availability, and confidentiality controls.",
  },
  {
    title: "Vendor Security Assessments",
    description: "All third-party integrations undergo rigorous security review. API keys and credentials are stored as encrypted secrets, never in source code.",
  },
  {
    title: "Data Minimization",
    description: "We collect only the data necessary to provide our services. Personal information is processed in accordance with our Privacy Policy.",
  },
  {
    title: "Regular Security Reviews",
    description: "Our security posture is continuously evaluated with automated vulnerability scanning, dependency auditing, and code review processes.",
  },
];

const dataHandling = [
  {
    icon: Database,
    title: "Automated Backups",
    description: "Database backups run automatically with point-in-time recovery capability, ensuring your data can be restored in the event of any incident.",
  },
  {
    icon: RefreshCw,
    title: "Disaster Recovery",
    description: "GCP's built-in redundancy and backup tools enable rapid recovery with minimal data loss, maintaining business continuity for your operations.",
  },
  {
    icon: FileCheck,
    title: "Audit Logging",
    description: "Key actions are logged for accountability and troubleshooting, providing a clear trail of system activity.",
  },
  {
    icon: Shield,
    title: "Secrets Management",
    description: "All API keys, tokens, and sensitive configuration values are stored using Replit's encrypted secrets management system, separate from application code.",
  },
];

const thirdPartyProcessors = [
  {
    name: "LegiStorm",
    purpose: "Congressional staff directory data. API requests include staffer names and search queries to retrieve directory information.",
    privacyUrl: "https://www.legistorm.com/index/privacy.html",
    privacyLabel: "LegiStorm Privacy Policy",
  },
  {
    name: "People Data Labs (PDL)",
    purpose: "Contact enrichment and career data. Search queries include names, emails, or company names to retrieve professional profiles and career histories.",
    privacyUrl: "https://www.peopledatalabs.com/privacy-policy",
    privacyLabel: "PDL Privacy Policy",
  },
  {
    name: "Perplexity AI",
    purpose: "AI-powered research and analysis. Research questions and staffer names are sent as prompts to generate intelligence reports and career research.",
    privacyUrl: "https://www.perplexity.ai/hub/legal/privacy-policy",
    privacyLabel: "Perplexity Privacy Policy",
  },
  {
    name: "OpenAI",
    purpose: "AI chat and research capabilities. Queries are processed via the API platform. OpenAI does not train on API data by default and offers zero data retention for qualifying organizations.",
    privacyUrl: "https://openai.com/enterprise-privacy/",
    privacyLabel: "OpenAI Enterprise Privacy",
  },
  {
    name: "Firecrawl",
    purpose: "Web scraping and content extraction. URLs submitted for scraping are sent to Firecrawl's service for processing. SOC 2 Type II certified.",
    privacyUrl: "https://www.firecrawl.dev/privacy-policy",
    privacyLabel: "Firecrawl Privacy Policy",
  },
  {
    name: "Congress.gov API",
    purpose: "Public government data on Members of Congress, bills, and legislative activity. This is a publicly available government service.",
    privacyUrl: "https://www.congress.gov/privacy-policy",
    privacyLabel: "Congress.gov Privacy Policy",
  },
  {
    name: "Kalshi",
    purpose: "Prediction market data for political event forecasting. Market queries and event data are retrieved through their API.",
    privacyUrl: "https://kalshi.com/privacy-policy",
    privacyLabel: "Kalshi Privacy Policy",
  },
  {
    name: "Resend",
    purpose: "Transactional email delivery for account notifications, verification emails, and daily briefs. Recipient email addresses are shared for delivery.",
    privacyUrl: "https://resend.com/legal/privacy-policy",
    privacyLabel: "Resend Privacy Policy",
  },
];

export default function SecurityPrivacyPage() {
  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <Link href="/">
            <Button variant="ghost" size="sm" data-testid="button-back-home">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Button>
          </Link>
        </div>

        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Shield className="w-8 h-8 text-primary" />
            <h1 className="text-3xl font-bold" data-testid="text-security-title">Privacy & Security</h1>
          </div>
          <p className="text-muted-foreground text-lg">
            How we protect your data and keep your political intelligence secure.
          </p>
          <p className="text-muted-foreground text-sm mt-2">Last updated: February 19, 2026</p>
        </div>

        <div className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Server className="w-5 h-5" />
                Infrastructure & Hosting
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <p className="text-sm text-muted-foreground">
                Our platform is built on enterprise-grade cloud infrastructure designed for reliability, performance, and security.
              </p>
              <div className="grid gap-4">
                {infrastructure.map((item) => (
                  <div key={item.title} className="flex gap-3 p-3 border rounded-md" data-testid={`section-${item.title.toLowerCase().replace(/\s+/g, "-")}`}>
                    <item.icon className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-sm">{item.title}</p>
                      <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="w-5 h-5" />
                Encryption
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <p className="text-sm text-muted-foreground">
                Your data is encrypted both at rest and in transit using industry-leading standards.
              </p>
              <div className="grid gap-4">
                {encryption.map((item) => (
                  <div key={item.title} className="flex gap-3 p-3 border rounded-md">
                    <item.icon className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-sm">{item.title}</p>
                      <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Access Controls
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <p className="text-sm text-muted-foreground">
                Multiple layers of access control ensure only authorized users can reach your data.
              </p>
              <div className="grid gap-4">
                {accessControls.map((item) => (
                  <div key={item.title} className="flex gap-3 p-3 border rounded-md">
                    <item.icon className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-sm">{item.title}</p>
                      <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileCheck className="w-5 h-5" />
                Compliance & Standards
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex flex-wrap gap-2 mb-4">
                <Badge variant="secondary">SOC 2 Type II</Badge>
                <Badge variant="secondary">AES-256</Badge>
                <Badge variant="secondary">TLS 1.2+</Badge>
                <Badge variant="secondary">Google Cloud</Badge>
              </div>
              <div className="grid gap-4">
                {compliance.map((item) => (
                  <div key={item.title} className="p-3 border rounded-md">
                    <p className="font-medium text-sm">{item.title}</p>
                    <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="w-5 h-5" />
                Data Handling & Recovery
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <p className="text-sm text-muted-foreground">
                Robust data handling practices ensure your information is always safe and recoverable.
              </p>
              <div className="grid gap-4">
                {dataHandling.map((item) => (
                  <div key={item.title} className="flex gap-3 p-3 border rounded-md">
                    <item.icon className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-sm">{item.title}</p>
                      <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ExternalLink className="w-5 h-5" />
                Third-Party Data Processors
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <p className="text-sm text-muted-foreground">
                Our platform integrates with the following third-party services to provide its features. When you use these features, certain data (such as search queries, names, or URLs) is transmitted to these providers. Each provider has their own privacy policy governing how they handle that data.
              </p>
              <div className="grid gap-4">
                {thirdPartyProcessors.map((processor) => (
                  <div key={processor.name} className="p-3 border rounded-md" data-testid={`processor-${processor.name.toLowerCase().replace(/[\s()]/g, "-")}`}>
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <p className="font-medium text-sm">{processor.name}</p>
                      <a
                        href={processor.privacyUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline flex items-center gap-1"
                        data-testid={`link-privacy-${processor.name.toLowerCase().replace(/[\s()]/g, "-")}`}
                      >
                        {processor.privacyLabel}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{processor.purpose}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Technology Stack</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-4 text-sm">
                <div className="space-y-3">
                  <div>
                    <p className="font-medium">Application Framework</p>
                    <p className="text-muted-foreground">React + TypeScript (frontend), Express.js + TypeScript (backend)</p>
                  </div>
                  <div>
                    <p className="font-medium">Database</p>
                    <p className="text-muted-foreground">PostgreSQL (Neon-backed) via Google Cloud SQL with Drizzle ORM</p>
                  </div>
                  <div>
                    <p className="font-medium">Authentication</p>
                    <p className="text-muted-foreground">Session-based with bcrypt password hashing, secure HTTP-only cookies</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <div>
                    <p className="font-medium">Hosting</p>
                    <p className="text-muted-foreground">Replit Deployments on Google Cloud Platform (US data centers)</p>
                  </div>
                  <div>
                    <p className="font-medium">Email</p>
                    <p className="text-muted-foreground">Resend (transactional email with TLS encryption)</p>
                  </div>
                  <div>
                    <p className="font-medium">AI Services</p>
                    <p className="text-muted-foreground">OpenAI and Perplexity APIs with encrypted API key storage</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="text-center py-6 text-sm text-muted-foreground">
            <p>
              Questions about our security practices? Contact us at{" "}
              <a href="mailto:security@governmentaffairs.co" className="text-primary hover:underline">
                security@governmentaffairs.co
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
