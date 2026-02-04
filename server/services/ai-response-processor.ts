import { db } from "../db";
import { contacts, careerHistory, newsArticles } from "@shared/schema";
import { ilike, eq, desc, and, sql } from "drizzle-orm";

export interface Person {
  name: string;
  title?: string;
  organization?: string;
  linkedinUrl?: string;
  inDatabase?: boolean;
  contactId?: string;
  linkedinSearchUrl?: string;
  googleSearchUrl?: string;
}

export interface Firm {
  name: string;
  specialty?: string;
  website?: string;
  staffersInDatabase?: number;
  viewStaffersUrl?: string;
  googleSearchUrl?: string;
}

export interface Bill {
  number: string;
  title: string;
  congressUrl?: string;
  isTracked?: boolean;
  viewUrl?: string;
  trackUrl?: string;
}

export interface FollowUpSuggestion {
  text: string;
  query: string;
  icon: string;
}

export interface ActionableItem {
  type: string;
  label: string;
  count?: number;
  icon: string;
  data?: Record<string, unknown>;
}

export interface EnrichedEntities {
  people: Person[];
  firms: Firm[];
  bills: Bill[];
}

export interface ProcessedResponse {
  formattedText: string;
  entities: EnrichedEntities;
  followUps: FollowUpSuggestion[];
  actionableItems: ActionableItem[];
}

export class AIResponseProcessor {
  private linkedInSearchBase = 'https://www.linkedin.com/search/results/people/?keywords=';
  
  async processResponse(
    text: string, 
    clientId: string,
    originalQuery: string
  ): Promise<ProcessedResponse> {
    const extractedEntities = this.extractEntitiesFromText(text);
    const enrichedEntities = await this.enrichEntities(extractedEntities, clientId);
    const followUps = this.generateFollowUps(enrichedEntities, originalQuery);
    const actionableItems = this.generateActionableItems(enrichedEntities);
    const formattedText = this.formatText(text);
    
    return {
      formattedText,
      entities: enrichedEntities,
      followUps,
      actionableItems,
    };
  }
  
  private extractEntitiesFromText(text: string): { people: Person[]; firms: Firm[]; bills: Bill[] } {
    const people: Person[] = [];
    const firms: Firm[] = [];
    const bills: Bill[] = [];
    
    const personPattern = /\*\*([A-Za-z\s.'-]+)\*\*\s*[–-]\s*([^(\n]+?)(?:\s+at\s+|\s+@\s+)?([A-Za-z\s&,.']+)?(?:\n|$)/gi;
    let match;
    while ((match = personPattern.exec(text)) !== null) {
      const name = match[1].trim();
      const title = match[2].trim();
      const org = match[3]?.trim();
      
      if (name.length > 3 && name.length < 50 && !name.includes('Committee') && !name.includes('Summary')) {
        if (!people.some(p => p.name.toLowerCase() === name.toLowerCase())) {
          people.push({
            name,
            title: title || undefined,
            organization: org || undefined,
          });
        }
      }
    }
    
    const nameOnlyPattern = /\*\*([A-Z][a-z]+\s[A-Z][a-z]+(?:\s[A-Z][a-z]+)?)\*\*/g;
    while ((match = nameOnlyPattern.exec(text)) !== null) {
      const name = match[1].trim();
      if (name.length > 5 && name.length < 40 && !people.some(p => p.name.toLowerCase() === name.toLowerCase())) {
        people.push({ name });
      }
    }
    
    const firmPatterns = [
      /(?:represented by|lobbying firm|firm|agency)\s*[:\-]?\s*\*\*([A-Za-z\s&,.']+)\*\*/gi,
      /\*\*([A-Za-z]+\s*&\s*[A-Za-z]+)\*\*/g,
      /(Holland & Knight|K&L Gates|Akin Gump|Covington & Burling|WilmerHale|Squire Patton Boggs|BGR Group|Brownstein|Invariant|Capitol Counsel|Subject Matter|SKDK)/gi,
    ];
    
    for (const pattern of firmPatterns) {
      while ((match = pattern.exec(text)) !== null) {
        const firmName = match[1]?.trim();
        if (firmName && firmName.length > 3 && !firms.some(f => f.name.toLowerCase() === firmName.toLowerCase())) {
          firms.push({ name: firmName });
        }
      }
    }
    
    const billPattern = /(H\.R\.\s*\d+|S\.\s*\d+|H\.Res\.\s*\d+|S\.Res\.\s*\d+|H\.J\.Res\.\s*\d+|S\.J\.Res\.\s*\d+)/gi;
    while ((match = billPattern.exec(text)) !== null) {
      const billNumber = match[1].replace(/\s+/g, ' ').toUpperCase();
      if (!bills.some(b => b.number === billNumber)) {
        const titleMatch = text.slice(match.index).match(new RegExp(`${billNumber.replace(/\./g, '\\.')}[^:]*:\\s*([^\\n]+)`));
        bills.push({
          number: billNumber,
          title: titleMatch?.[1]?.slice(0, 100) || "Legislation",
        });
      }
    }
    
    return { people, firms, bills };
  }
  
  private async enrichEntities(
    extracted: { people: Person[]; firms: Firm[]; bills: Bill[] },
    clientId: string
  ): Promise<EnrichedEntities> {
    const enrichedPeople: Person[] = [];
    const enrichedFirms: Firm[] = [];
    const enrichedBills: Bill[] = [];
    
    for (const person of extracted.people) {
      const enriched = { ...person };
      
      try {
        const [contact] = await db
          .select()
          .from(contacts)
          .where(
            and(
              eq(contacts.clientId, clientId),
              ilike(contacts.firstName, `%${person.name.split(' ')[0]}%`)
            )
          )
          .limit(1);
        
        if (contact) {
          const fullName = `${contact.firstName} ${contact.lastName}`;
          if (fullName.toLowerCase().includes(person.name.toLowerCase()) || 
              person.name.toLowerCase().includes(fullName.toLowerCase())) {
            enriched.inDatabase = true;
            enriched.contactId = contact.id;
            enriched.organization = enriched.organization || contact.organization || undefined;
            enriched.title = enriched.title || contact.title || undefined;
          }
        }
      } catch (e) {
        console.log("Contact lookup failed:", e);
      }
      
      if (!enriched.inDatabase) {
        enriched.linkedinSearchUrl = this.getLinkedInSearchURL(person.name, person.organization);
        enriched.googleSearchUrl = this.getGoogleSearchURL(person.name, person.organization);
      }
      
      enrichedPeople.push(enriched);
    }
    
    for (const firm of extracted.firms) {
      const enriched = { ...firm };
      
      try {
        const staffersAtFirm = await db
          .select({ count: sql<number>`count(*)` })
          .from(careerHistory)
          .where(ilike(careerHistory.organization, `%${firm.name}%`));
        
        const count = Number(staffersAtFirm[0]?.count || 0);
        if (count > 0) {
          enriched.staffersInDatabase = count;
          enriched.viewStaffersUrl = `/contacts?org=${encodeURIComponent(firm.name)}`;
        }
      } catch (e) {
        console.log("Firm lookup failed:", e);
      }
      
      enriched.googleSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(firm.name + ' lobbying firm')}`;
      enrichedFirms.push(enriched);
    }
    
    for (const bill of extracted.bills) {
      const enriched = { ...bill };
      enriched.congressUrl = this.getCongressGovURL(bill.number);
      enriched.trackUrl = `/news?search=${encodeURIComponent(bill.number)}`;
      enrichedBills.push(enriched);
    }
    
    return {
      people: enrichedPeople,
      firms: enrichedFirms,
      bills: enrichedBills,
    };
  }
  
  private generateFollowUps(entities: EnrichedEntities, originalQuery: string): FollowUpSuggestion[] {
    const suggestions: FollowUpSuggestion[] = [];
    
    if (entities.people.length > 0) {
      const firstPerson = entities.people[0];
      suggestions.push({
        text: `Find recent articles mentioning ${firstPerson.name}`,
        query: `Find recent news articles about ${firstPerson.name}`,
        icon: 'newspaper',
      });
      
      suggestions.push({
        text: `Show ${firstPerson.name}'s career history`,
        query: `What is ${firstPerson.name}'s complete career history and previous positions?`,
        icon: 'briefcase',
      });
      
      if (entities.people.length > 1) {
        suggestions.push({
          text: `Map connections between these individuals`,
          query: `Create a network visualization showing connections between ${entities.people.slice(0, 3).map(p => p.name).join(', ')}`,
          icon: 'network',
        });
      }
    }
    
    if (entities.firms.length > 0) {
      const firstFirm = entities.firms[0];
      suggestions.push({
        text: `Find staffers who worked at ${firstFirm.name}`,
        query: `Show me all congressional staffers who previously worked at ${firstFirm.name}`,
        icon: 'users',
      });
    }
    
    if (entities.bills.length > 0) {
      const firstBill = entities.bills[0];
      suggestions.push({
        text: `Find key staffers working on ${firstBill.number}`,
        query: `Who are the key congressional staffers working on ${firstBill.number}?`,
        icon: 'users',
      });
      
      suggestions.push({
        text: `Show lobbying activity on ${firstBill.number}`,
        query: `What lobbying firms and lobbyists are working on ${firstBill.number}?`,
        icon: 'building',
      });
    }
    
    if (originalQuery.toLowerCase().includes('lobbyi')) {
      suggestions.push({
        text: 'Show recent lobbying disclosure filings',
        query: 'Show recent lobbying disclosure filings related to this topic',
        icon: 'file-text',
      });
    }
    
    const totalEntities = entities.people.length + entities.firms.length;
    if (totalEntities >= 3 && !suggestions.some(s => s.icon === 'network')) {
      suggestions.push({
        text: 'Create visual network map',
        query: 'Create a network visualization showing the relationships between these entities',
        icon: 'share-2',
      });
    }
    
    return suggestions.slice(0, 5);
  }
  
  private generateActionableItems(entities: EnrichedEntities): ActionableItem[] {
    const actions: ActionableItem[] = [];
    
    const newPeople = entities.people.filter(p => !p.inDatabase);
    if (newPeople.length > 0) {
      actions.push({
        type: 'add_to_contacts',
        label: `Add ${newPeople.length} ${newPeople.length === 1 ? 'person' : 'people'} to contacts`,
        count: newPeople.length,
        icon: 'user-plus',
        data: { people: newPeople },
      });
    }
    
    if (entities.bills.length > 0) {
      actions.push({
        type: 'track_bills',
        label: `Track ${entities.bills.length} ${entities.bills.length === 1 ? 'bill' : 'bills'}`,
        count: entities.bills.length,
        icon: 'bookmark',
        data: { bills: entities.bills.map(b => b.number) },
      });
    }
    
    if (entities.firms.length > 0) {
      actions.push({
        type: 'research_firms',
        label: `Research ${entities.firms.length} ${entities.firms.length === 1 ? 'firm' : 'firms'}`,
        count: entities.firms.length,
        icon: 'building',
        data: { firms: entities.firms.map(f => f.name) },
      });
    }
    
    return actions;
  }
  
  private formatText(text: string): string {
    let formatted = text;
    formatted = formatted.replace(/\*\*\*([^*]+)\*\*\*/g, '<strong class="highlight">$1</strong>');
    formatted = formatted.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    formatted = formatted.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    return formatted;
  }
  
  private getLinkedInSearchURL(name: string, organization?: string): string {
    const query = organization ? `${name} ${organization}` : name;
    return `${this.linkedInSearchBase}${encodeURIComponent(query)}`;
  }
  
  private getGoogleSearchURL(name: string, organization?: string): string {
    const query = organization 
      ? `${name} ${organization} government affairs`
      : `${name} government affairs lobbyist`;
    return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
  }
  
  private getCongressGovURL(billNumber: string): string {
    const match = billNumber.match(/(H\.R\.|S\.|H\.Res\.|S\.Res\.|H\.J\.Res\.|S\.J\.Res\.)?\s*(\d+)/i);
    if (!match) return `https://congress.gov/bill/search?q=${encodeURIComponent(billNumber)}`;
    
    const prefix = billNumber.toUpperCase();
    let chamber = 'house-bill';
    if (prefix.startsWith('S.') && !prefix.startsWith('S.RES') && !prefix.startsWith('S.J.RES')) {
      chamber = 'senate-bill';
    } else if (prefix.includes('H.RES')) {
      chamber = 'house-resolution';
    } else if (prefix.includes('S.RES')) {
      chamber = 'senate-resolution';
    } else if (prefix.includes('H.J.RES')) {
      chamber = 'house-joint-resolution';
    } else if (prefix.includes('S.J.RES')) {
      chamber = 'senate-joint-resolution';
    }
    
    const number = match[2];
    return `https://www.congress.gov/bill/119th-congress/${chamber}/${number}`;
  }
}

export const aiResponseProcessor = new AIResponseProcessor();
