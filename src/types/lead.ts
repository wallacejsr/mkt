export type LeadStatus = 'new' | 'contacted' | 'interested' | 'proposal' | 'customer' | 'lost';

export type LeadSource = 
  | 'Instagram'
  | 'Facebook'
  | 'Google'
  | 'WhatsApp'
  | 'LinkedIn'
  | 'Site'
  | 'Indicação'
  | 'Campanha'
  | 'Manual'
  | 'Outro';

export interface Lead {
  id: string;
  organizationId: string;
  businessId: string;
  campaignId?: string | null;
  productId?: string | null;
  name: string;
  companyName?: string | null;
  email?: string | null;
  phone?: string | null;
  source: LeadSource | string;
  status: LeadStatus;
  potentialValue?: number | null;
  actualValue?: number | null;
  responsibleUserId?: string | null;
  notes?: string | null;
  lastContactAt?: string | null;
  nextAction?: string | null;
  nextActionAt?: string | null;
  convertedAt?: string | null;
  lostAt?: string | null;
  lostReason?: string | null;
  createdAt: string;
  updatedAt: string;
  campaign?: {
    id: string;
    name: string;
  } | null;
  product?: {
    id: string;
    name: string;
  } | null;
  responsibleUser?: {
    id: string;
    email: string;
  } | null;
}

export type ActivityType = 
  | 'created'
  | 'note'
  | 'contact'
  | 'status_change'
  | 'follow_up'
  | 'proposal'
  | 'conversion'
  | 'lost';

export interface LeadActivity {
  id: string;
  organizationId: string;
  businessId: string;
  leadId: string;
  userId?: string | null;
  type: ActivityType;
  description: string;
  metadata?: any;
  createdAt: string;
  user?: {
    id: string;
    email: string;
  } | null;
}

export interface LeadSummary {
  total: number;
  newCount: number;
  contactedCount: number;
  interestedCount: number;
  proposalCount: number;
  inNegotiationCount: number;
  customerCount: number;
  lostCount: number;
  totalPotentialValue: number;
  totalActualValue: number;
}

export interface LeadRecommendation {
  id: string;
  leadId: string;
  leadName: string;
  companyName?: string | null;
  ruleType: 'new_lead_uncontacted' | 'lead_stagnant' | 'next_action_overdue' | 'proposal_stagnant';
  title: string;
  description: string;
  priority: 'alta' | 'media' | 'baixa';
  score: number;
  nextAction?: string | null;
  nextActionAt?: string | null;
  createdAt: string;
}
