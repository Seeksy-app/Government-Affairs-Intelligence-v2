import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Link } from "wouter";

export default function TermsPage() {
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
            <CardTitle className="text-2xl" data-testid="text-terms-title">Terms and Conditions</CardTitle>
            <p className="text-muted-foreground text-sm">Last updated: August 12, 2026</p>
          </CardHeader>
          <CardContent className="prose prose-sm dark:prose-invert max-w-none space-y-6">
            <section>
              <h2 className="text-lg font-semibold">1. Acceptance of Terms</h2>
              <p className="text-muted-foreground">
                By accessing and using GovernmentAffairs.io (the "Service"), you accept and agree to be bound by the terms and provisions of this agreement. If you do not agree to abide by these terms, please do not use this Service.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">2. Description of Service</h2>
              <p className="text-muted-foreground">
                GovernmentAffairs.io is a multi-tenant SaaS platform designed for government affairs and lobbying firms and in-house government relations teams. The Service provides tools for tracking legislative activity and political contacts, monitoring congressional staff, aggregating news and government press releases, generating AI-assisted research briefs, managing client relationships, and conducting research.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">3. User Accounts</h2>
              <p className="text-muted-foreground">
                To access certain features of the Service, you must register for an account. You agree to provide accurate, current, and complete information during the registration process and to update such information to keep it accurate, current, and complete. You are responsible for safeguarding your password and for all activities that occur under your account.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">4. Acceptable Use</h2>
              <p className="text-muted-foreground">
                You agree not to use the Service to:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-1">
                <li>Violate any applicable laws or regulations</li>
                <li>Infringe upon the rights of others</li>
                <li>Transmit any harmful, threatening, or offensive content</li>
                <li>Attempt to gain unauthorized access to the Service or its related systems</li>
                <li>Interfere with or disrupt the integrity or performance of the Service</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold">5. Intellectual Property</h2>
              <p className="text-muted-foreground">
                The Service and its original content, features, and functionality are owned by the platform operator and are protected by international copyright, trademark, patent, trade secret, and other intellectual property laws.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">6. Data and Privacy</h2>
              <p className="text-muted-foreground">
                Your use of the Service is also governed by our Privacy Policy. Please review our Privacy Policy to understand our practices regarding the collection, use, and disclosure of your information.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">7. Third-Party Integrations and Content</h2>
              <p className="text-muted-foreground">
                The Service integrates with third-party services including but not limited to Congress.gov, LegiStorm, Kalshi, AI providers (such as Anthropic, Perplexity, and Parallel.ai), People Data Labs, and identity providers such as LinkedIn. Your use of these integrations is subject to the respective third-party terms of service and privacy policies.
              </p>
              <p className="text-muted-foreground mt-2">
                Portions of the Service's output — including briefs, summaries, relevance scores, and research answers — are generated with the assistance of artificial intelligence. This content is provided for informational purposes only, may contain errors or omissions, and should be independently verified before you rely on it. It does not constitute legal, financial, or investment advice.
              </p>
              <p className="text-muted-foreground mt-2">
                Prediction market data displayed in the Service is provided for informational purposes only. The Service does not facilitate trading, wagering, or the purchase or sale of any contract or financial instrument.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">8. Limitation of Liability</h2>
              <p className="text-muted-foreground">
                In no event shall the platform operator be liable for any indirect, incidental, special, consequential, or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses, resulting from your access to or use of or inability to access or use the Service.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">9. Termination</h2>
              <p className="text-muted-foreground">
                We may terminate or suspend your account and bar access to the Service immediately, without prior notice or liability, under our sole discretion, for any reason whatsoever, including without limitation if you breach the Terms.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">10. Changes to Terms</h2>
              <p className="text-muted-foreground">
                We reserve the right to modify or replace these Terms at any time. If a revision is material, we will provide at least 30 days' notice prior to any new terms taking effect. What constitutes a material change will be determined at our sole discretion.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">11. Contact Us</h2>
              <p className="text-muted-foreground">
                If you have any questions about these Terms, contact us at support@governmentaffairs.io.
              </p>
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
