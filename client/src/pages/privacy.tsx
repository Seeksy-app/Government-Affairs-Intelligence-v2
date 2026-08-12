import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Link } from "wouter";

export default function PrivacyPage() {
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

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl" data-testid="text-privacy-title">Privacy Policy</CardTitle>
            <p className="text-muted-foreground text-sm">Last updated: August 12, 2026</p>
          </CardHeader>
          <CardContent className="prose prose-sm dark:prose-invert max-w-none space-y-6">
            <section>
              <h2 className="text-lg font-semibold">1. Introduction</h2>
              <p className="text-muted-foreground">
                This Privacy Policy describes how GovernmentAffairs.co ("we", "us", or "our") collects, uses, and shares information about you when you use our government affairs intelligence platform and related services (the "Service"). We are committed to protecting your privacy and ensuring the security of your personal information.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">2. Information We Collect</h2>
              <p className="text-muted-foreground">We collect the following types of information:</p>
              <h3 className="text-base font-medium mt-4">2.1 Information You Provide</h3>
              <ul className="list-disc pl-6 text-muted-foreground space-y-1">
                <li>Account information (name, email address, password)</li>
                <li>Organization/firm information</li>
                <li>Contact data you enter into the platform</li>
                <li>Research documents and notes</li>
                <li>Communications with our support team</li>
              </ul>
              <h3 className="text-base font-medium mt-4">2.2 Information Collected Automatically</h3>
              <ul className="list-disc pl-6 text-muted-foreground space-y-1">
                <li>Log data (IP address, browser type, pages visited)</li>
                <li>Device information</li>
                <li>Usage data and analytics</li>
                <li>Cookies and similar tracking technologies</li>
              </ul>
              <h3 className="text-base font-medium mt-4">2.3 Information from Third-Party Sign-In</h3>
              <p className="text-muted-foreground">
                If you choose to sign in using a third-party identity provider such as LinkedIn, we receive, with your consent, the basic profile information that provider shares — your name, email address, and profile photo. We do not receive your password for that service, we do not access your connections or contacts on that service, and we do not post on your behalf. Your use of the identity provider is governed by its own privacy policy.
              </p>
              <h3 className="text-base font-medium mt-4">2.4 Publicly Available Professional Information</h3>
              <p className="text-muted-foreground">
                The Service aggregates professional information about government officials, legislative staff, and other public-sector personnel — such as names, titles, office affiliations, committee assignments, and official contact details — from public and licensed sources, including Congress.gov and LegiStorm. This information relates to individuals in their professional, public-facing capacities.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">3. How We Use Your Information</h2>
              <p className="text-muted-foreground">We use the information we collect to:</p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-1">
                <li>Provide, maintain, and improve our services</li>
                <li>Process transactions and manage your account</li>
                <li>Send you technical notices, updates, and support messages</li>
                <li>Respond to your comments and questions</li>
                <li>Monitor and analyze trends, usage, and activities</li>
                <li>Detect, investigate, and prevent fraudulent transactions and other illegal activities</li>
                <li>Personalize and improve your experience</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold">4. Data Sharing and Disclosure</h2>
              <p className="text-muted-foreground">We may share your information in the following circumstances:</p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-1">
                <li><strong>With your organization:</strong> Information is shared within your organization/firm as part of the multi-tenant platform functionality</li>
                <li><strong>Service providers:</strong> We may share data with third-party vendors who assist in providing our services</li>
                <li><strong>Legal requirements:</strong> We may disclose information if required by law or in response to valid legal requests</li>
                <li><strong>Business transfers:</strong> In connection with any merger, sale, or acquisition</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold">5. Third-Party Services</h2>
              <p className="text-muted-foreground">
                We rely on third-party services to operate the platform:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-1">
                <li><strong>Hosting and infrastructure:</strong> Render (application hosting) and Supabase (database hosting)</li>
                <li><strong>AI processing:</strong> Anthropic, Perplexity, and Parallel.ai, which process content you submit (such as research questions and documents) to power analysis, briefing, and research features</li>
                <li><strong>Government data sources:</strong> Congress.gov (legislative data) and LegiStorm (congressional staff directory data)</li>
                <li><strong>Market data:</strong> Kalshi (prediction market data display; no personal data is shared)</li>
                <li><strong>Contact enrichment:</strong> People Data Labs, used at your direction to enrich professional contact records</li>
                <li><strong>Web research:</strong> Firecrawl and search providers, for retrieving public web content you request</li>
                <li><strong>Email delivery:</strong> Resend, for transactional email such as password resets</li>
                <li><strong>Identity providers:</strong> LinkedIn, if you choose to sign in with LinkedIn</li>
              </ul>
              <p className="text-muted-foreground mt-2">
                Each of these services has its own privacy policy governing the use of your data.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">6. Data Security</h2>
              <p className="text-muted-foreground">
                We implement appropriate technical and organizational measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction. This includes encryption of data in transit and at rest, regular security assessments, and access controls.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">7. Data Retention</h2>
              <p className="text-muted-foreground">
                We retain your information for as long as your account is active or as needed to provide you services. We will retain and use your information as necessary to comply with our legal obligations, resolve disputes, and enforce our agreements.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">8. Your Rights</h2>
              <p className="text-muted-foreground">Depending on your location, you may have the following rights:</p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-1">
                <li>Access to your personal data</li>
                <li>Correction of inaccurate data</li>
                <li>Deletion of your data</li>
                <li>Data portability</li>
                <li>Objection to processing</li>
                <li>Withdrawal of consent</li>
              </ul>
              <p className="text-muted-foreground mt-2">
                To exercise these rights, contact us at support@governmentaffairs.co.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">9. Cookies</h2>
              <p className="text-muted-foreground">
                We use cookies and similar tracking technologies to collect and track information about your use of our services. You can control cookies through your browser settings, though some features may not function properly if cookies are disabled.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">10. Children's Privacy</h2>
              <p className="text-muted-foreground">
                Our services are not directed to children under 13. We do not knowingly collect personal information from children under 13. If we learn we have collected personal information from a child under 13, we will delete that information.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">11. Changes to This Policy</h2>
              <p className="text-muted-foreground">
                We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last updated" date.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">12. Contact Us</h2>
              <p className="text-muted-foreground">
                If you have any questions about this Privacy Policy or our data practices, contact us at support@governmentaffairs.co.
              </p>
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
