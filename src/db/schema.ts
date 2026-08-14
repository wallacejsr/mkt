import { relations } from 'drizzle-orm';
import { boolean, integer, jsonb, pgTable, serial, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash'),
  name: text('name'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const organizations = pgTable('organizations', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const organizationMembers = pgTable('organization_members', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  organizationId: uuid('organization_id').references(() => organizations.id).notNull(),
  role: text('role').notNull().default('owner'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const businesses = pgTable('businesses', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').references(() => organizations.id).notNull(),
  name: text('name').notNull(),
  segment: text('segment'),
  description: text('description'),
  
  // Onboarding Phase 1 details
  city: text('city'),
  state: text('state'),
  country: text('country').default('Brasil'),
  website: text('website'),
  instagram: text('instagram'),
  whatsapp: text('whatsapp'),
  serviceArea: text('service_area'),
  serviceType: text('service_type'),
  
  // Control flow
  onboardingCompleted: boolean('onboarding_completed').default(false),
  onboardingCompletedAt: timestamp('onboarding_completed_at'),
  
  createdAt: timestamp('created_at').defaultNow(),
});

export const products = pgTable('products', {
  id: uuid('id').defaultRandom().primaryKey(),
  businessId: uuid('business_id').references(() => businesses.id).notNull(),
  name: text('name').notNull(),
  type: text('type').notNull(), // 'produto' ou 'serviço'
  description: text('description'),
  price: text('price'),
  ticketValue: text('ticket_value'),
  mainBenefit: text('main_benefit'),
  differentiators: text('differentiators'),
  idealCustomer: text('ideal_customer'),
  isMain: boolean('is_main').default(false),
  createdAt: timestamp('created_at').defaultNow(),
});

export const targetAudiences = pgTable('target_audiences', {
  id: uuid('id').defaultRandom().primaryKey(),
  businessId: uuid('business_id').references(() => businesses.id).notNull(),
  description: text('description'),
  ageRange: text('age_range'),
  location: text('location'),
  profile: text('profile'),
  pains: jsonb('pains').default([]),
  desires: jsonb('desires').default([]),
  objections: jsonb('objections').default([]),
  decisionFactors: text('decision_factors'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const marketingProfiles = pgTable('marketing_profiles', {
  id: uuid('id').defaultRandom().primaryKey(),
  businessId: uuid('business_id').references(() => businesses.id).notNull(),
  channels: jsonb('channels').default([]),
  postFrequency: text('post_frequency'),
  monthlyInvestment: text('monthly_investment'),
  monthlyLeads: text('monthly_leads'),
  monthlySales: text('monthly_sales'),
  mainDifficulty: text('main_difficulty'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const goals = pgTable('goals', {
  id: uuid('id').defaultRandom().primaryKey(),
  businessId: uuid('business_id').references(() => businesses.id).notNull(),
  goalType: text('goal_type').notNull(),
  specificProductId: uuid('specific_product_id').references(() => products.id),
  targetMetric: text('target_metric'),
  timeframe: text('timeframe'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Generated Strategy tables
export const strategies = pgTable('strategies', {
  id: uuid('id').defaultRandom().primaryKey(),
  businessId: uuid('business_id').references(() => businesses.id).notNull(),
  businessSummary: text('business_summary'),
  idealCustomerDesc: text('ideal_customer_desc'),
  idealCustomerPains: jsonb('ideal_customer_pains').default([]),
  idealCustomerDesires: jsonb('ideal_customer_desires').default([]),
  idealCustomerObjections: jsonb('ideal_customer_objections').default([]),
  positioningStatement: text('positioning_statement'),
  valueProposition: text('value_proposition'),
  differentiators: jsonb('differentiators').default([]),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
});

export const strategyChannels = pgTable('strategy_channels', {
  id: uuid('id').defaultRandom().primaryKey(),
  strategyId: uuid('strategy_id').references(() => strategies.id).notNull(),
  channel: text('channel').notNull(),
  priority: integer('priority'),
  reason: text('reason'),
});

export const strategyPlanWeeks = pgTable('strategy_plan_weeks', {
  id: uuid('id').defaultRandom().primaryKey(),
  strategyId: uuid('strategy_id').references(() => strategies.id).notNull(),
  week: integer('week').notNull(),
  objective: text('objective'),
  actions: jsonb('actions').default([]),
});

export const opportunities = pgTable('opportunities', {
  id: uuid('id').defaultRandom().primaryKey(),
  businessId: uuid('business_id').references(() => businesses.id).notNull(),
  title: text('title').notNull(),
  description: text('description'),
  impact: text('impact'), // high, medium, low
  effort: text('effort'), // high, medium, low
  status: text('status').default('open'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const aiGenerations = pgTable('ai_generations', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').references(() => organizations.id),
  businessId: uuid('business_id').references(() => businesses.id),
  type: text('type').notNull(), // e.g. 'initial_strategy', 'post'
  provider: text('provider'),
  model: text('model'),
  inputHash: text('input_hash'), // we can store stringified context briefly
  output: jsonb('output'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const contentItems = pgTable('content_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').references(() => organizations.id).notNull(),
  businessId: uuid('business_id').references(() => businesses.id).notNull(),
  strategyId: uuid('strategy_id').references(() => strategies.id),
  title: text('title').notNull(),
  topic: text('topic'),
  channel: text('channel'),
  format: text('format'),
  funnelStage: text('funnel_stage'),
  objective: text('objective'),
  scheduledDate: text('scheduled_date'),
  status: text('status').default('idea'), // idea, draft, ready, published
  hook: text('hook'),
  body: text('body'),
  caption: text('caption'),
  cta: text('cta'),
  hashtags: jsonb('hashtags').default([]),
  visualDirection: text('visual_direction'),
  videoScript: text('video_script'),
  generationContext: jsonb('generation_context'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  publishedAt: timestamp('published_at'),
  campaignId: uuid('campaign_id'),
});

export const campaigns = pgTable('campaigns', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').references(() => organizations.id).notNull(),
  businessId: uuid('business_id').references(() => businesses.id).notNull(),
  strategyId: uuid('strategy_id').references(() => strategies.id),
  productId: uuid('product_id').references(() => products.id),
  name: text('name').notNull(),
  objective: text('objective'),
  description: text('description'),
  targetAudience: jsonb('target_audience'), // custom audience mapping
  offer: jsonb('offer'), // value_proposition, description, urgency
  mainArgument: text('main_argument'),
  messaging: jsonb('messaging'), // main_message, supporting_arguments
  budget: text('budget'),
  startDate: text('start_date'),
  endDate: text('end_date'),
  status: text('status').default('draft'), // draft, ready, active, paused, completed, archived
  primaryMetric: text('primary_metric'),
  impressions: integer('impressions').default(0),
  clicks: integer('clicks').default(0),
  leads: integer('leads').default(0),
  sales: integer('sales').default(0),
  investmentSpent: integer('investment_spent').default(0),
  revenueGenerated: integer('revenue_generated').default(0),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const campaignChannels = pgTable('campaign_channels', {
  id: uuid('id').defaultRandom().primaryKey(),
  campaignId: uuid('campaign_id').references(() => campaigns.id).notNull(),
  channel: text('channel').notNull(),
  objective: text('objective'),
  budget: text('budget'),
  status: text('status').default('planned'),
});

export const campaignAssets = pgTable('campaign_assets', {
  id: uuid('id').defaultRandom().primaryKey(),
  campaignId: uuid('campaign_id').references(() => campaigns.id).notNull(),
  type: text('type').notNull(), // ad, social_post, landing_page, whatsapp, email, creative_brief
  channel: text('channel'),
  title: text('title').notNull(),
  content: jsonb('content'), // structured content based on type
  metadata: jsonb('metadata'),
  status: text('status').default('draft'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const campaignTasks = pgTable('campaign_tasks', {
  id: uuid('id').defaultRandom().primaryKey(),
  campaignId: uuid('campaign_id').references(() => campaigns.id).notNull(),
  title: text('title').notNull(),
  description: text('description'),
  dueDate: text('due_date'),
  status: text('status').default('todo'), // todo, doing, done
  priority: text('priority').default('medium'),
});

export const leads = pgTable('leads', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').references(() => organizations.id).notNull(),
  businessId: uuid('business_id').references(() => businesses.id).notNull(),
  campaignId: uuid('campaign_id').references(() => campaigns.id),
  productId: uuid('product_id').references(() => products.id),
  name: text('name').notNull(),
  companyName: text('company_name'),
  email: text('email'),
  phone: text('phone'),
  source: text('source').notNull().default('Manual'), // Instagram, Facebook, Google, WhatsApp, LinkedIn, Site, Indicação, Campanha, Manual, Outro
  status: text('status').notNull().default('new'), // new, contacted, interested, proposal, customer, lost
  potentialValue: integer('potential_value'), // em reais/inteiro
  actualValue: integer('actual_value'), // em reais/inteiro para vendas realizadas
  responsibleUserId: uuid('responsible_user_id').references(() => users.id),
  notes: text('notes'),
  lastContactAt: timestamp('last_contact_at'),
  nextAction: text('next_action'),
  nextActionAt: timestamp('next_action_at'),
  convertedAt: timestamp('converted_at'),
  lostAt: timestamp('lost_at'),
  lostReason: text('lost_reason'), // Preço, Sem interesse, Concorrente, Sem resposta, Momento inadequado, Produto não adequado, Outro
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const leadActivities = pgTable('lead_activities', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').references(() => organizations.id).notNull(),
  businessId: uuid('business_id').references(() => businesses.id).notNull(),
  leadId: uuid('lead_id').references(() => leads.id).notNull(),
  userId: uuid('user_id').references(() => users.id),
  type: text('type').notNull(), // created, note, contact, status_change, follow_up, proposal, conversion, lost
  description: text('description').notNull(),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const recommendations = pgTable('recommendations', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').references(() => organizations.id).notNull(),
  businessId: uuid('business_id').references(() => businesses.id).notNull(),
  fingerprint: text('fingerprint').notNull(),
  type: text('type').notNull(),
  category: text('category').notNull(), // sales, content, campaign, strategy, opportunity
  title: text('title').notNull(),
  description: text('description').notNull(),
  reason: text('reason'),
  priority: text('priority').notNull(), // low, medium, high, critical
  priorityScore: integer('priority_score').notNull(), // 0 - 100
  impact: text('impact').notNull(), // low, medium, high
  sourceType: text('source_type').notNull(), // lead, campaign, content, strategy, pipeline, goal
  sourceId: text('source_id'),
  actionType: text('action_type'),
  actionUrl: text('action_url'),
  status: text('status').notNull().default('active'), // active, completed, dismissed, expired
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  resolvedAt: timestamp('resolved_at'),
  dismissedAt: timestamp('dismissed_at'),
});

export const usersRelations = relations(users, ({ many }) => ({
  memberships: many(organizationMembers),
}));

export const organizationsRelations = relations(organizations, ({ many }) => ({
  members: many(organizationMembers),
  businesses: many(businesses),
}));

export const organizationMembersRelations = relations(organizationMembers, ({ one }) => ({
  user: one(users, { fields: [organizationMembers.userId], references: [users.id] }),
  organization: one(organizations, { fields: [organizationMembers.organizationId], references: [organizations.id] }),
}));

export const businessesRelations = relations(businesses, ({ one, many }) => ({
  organization: one(organizations, { fields: [businesses.organizationId], references: [organizations.id] }),
  products: many(products),
  targetAudiences: many(targetAudiences),
  marketingProfiles: many(marketingProfiles),
  goals: many(goals),
  strategies: many(strategies),
  opportunities: many(opportunities),
  contentItems: many(contentItems),
  campaigns: many(campaigns),
  leads: many(leads),
  leadActivities: many(leadActivities),
  recommendations: many(recommendations),
}));

export const contentItemsRelations = relations(contentItems, ({ one }) => ({
  organization: one(organizations, { fields: [contentItems.organizationId], references: [organizations.id] }),
  business: one(businesses, { fields: [contentItems.businessId], references: [businesses.id] }),
  strategy: one(strategies, { fields: [contentItems.strategyId], references: [strategies.id] }),
  campaign: one(campaigns, { fields: [contentItems.campaignId], references: [campaigns.id] }),
}));

export const campaignsRelations = relations(campaigns, ({ one, many }) => ({
  organization: one(organizations, { fields: [campaigns.organizationId], references: [organizations.id] }),
  business: one(businesses, { fields: [campaigns.businessId], references: [businesses.id] }),
  strategy: one(strategies, { fields: [campaigns.strategyId], references: [strategies.id] }),
  product: one(products, { fields: [campaigns.productId], references: [products.id] }),
  channels: many(campaignChannels),
  assets: many(campaignAssets),
  tasks: many(campaignTasks),
  contentItems: many(contentItems),
}));

export const campaignChannelsRelations = relations(campaignChannels, ({ one }) => ({
  campaign: one(campaigns, { fields: [campaignChannels.campaignId], references: [campaigns.id] }),
}));

export const campaignAssetsRelations = relations(campaignAssets, ({ one }) => ({
  campaign: one(campaigns, { fields: [campaignAssets.campaignId], references: [campaigns.id] }),
}));

export const campaignTasksRelations = relations(campaignTasks, ({ one }) => ({
  campaign: one(campaigns, { fields: [campaignTasks.campaignId], references: [campaigns.id] }),
}));

export const productsRelations = relations(products, ({ one }) => ({
  business: one(businesses, { fields: [products.businessId], references: [businesses.id] }),
}));

export const targetAudiencesRelations = relations(targetAudiences, ({ one }) => ({
  business: one(businesses, { fields: [targetAudiences.businessId], references: [businesses.id] }),
}));

export const marketingProfilesRelations = relations(marketingProfiles, ({ one }) => ({
  business: one(businesses, { fields: [marketingProfiles.businessId], references: [businesses.id] }),
}));

export const goalsRelations = relations(goals, ({ one }) => ({
  business: one(businesses, { fields: [goals.businessId], references: [businesses.id] }),
}));

export const strategiesRelations = relations(strategies, ({ one }) => ({
  business: one(businesses, { fields: [strategies.businessId], references: [businesses.id] }),
}));

export const opportunitiesRelations = relations(opportunities, ({ one }) => ({
  business: one(businesses, { fields: [opportunities.businessId], references: [businesses.id] }),
}));

export const leadsRelations = relations(leads, ({ one, many }) => ({
  organization: one(organizations, { fields: [leads.organizationId], references: [organizations.id] }),
  business: one(businesses, { fields: [leads.businessId], references: [businesses.id] }),
  campaign: one(campaigns, { fields: [leads.campaignId], references: [campaigns.id] }),
  product: one(products, { fields: [leads.productId], references: [products.id] }),
  responsibleUser: one(users, { fields: [leads.responsibleUserId], references: [users.id] }),
  activities: many(leadActivities),
}));

export const leadActivitiesRelations = relations(leadActivities, ({ one }) => ({
  organization: one(organizations, { fields: [leadActivities.organizationId], references: [organizations.id] }),
  business: one(businesses, { fields: [leadActivities.businessId], references: [businesses.id] }),
  lead: one(leads, { fields: [leadActivities.leadId], references: [leads.id] }),
  user: one(users, { fields: [leadActivities.userId], references: [users.id] }),
}));

export const recommendationsRelations = relations(recommendations, ({ one }) => ({
  organization: one(organizations, { fields: [recommendations.organizationId], references: [organizations.id] }),
  business: one(businesses, { fields: [recommendations.businessId], references: [businesses.id] }),
}));

// --- PROSPECTING MODULE TABLES ---

export const prospectingSearches = pgTable('prospecting_searches', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').references(() => organizations.id).notNull(),
  businessId: uuid('business_id').references(() => businesses.id).notNull(),
  userId: uuid('user_id').references(() => users.id),
  segment: text('segment').notNull(),
  city: text('city'),
  state: text('state'),
  country: text('country'),
  radiusKm: integer('radius_km'),
  keywords: text('keywords'),
  requestedLimit: integer('requested_limit').default(25).notNull(),
  status: text('status').notNull().default('pending'), // pending, running, completed, failed
  totalFound: integer('total_found').default(0),
  totalWithEmail: integer('total_with_email').default(0),
  totalWithPhone: integer('total_with_phone').default(0),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  completedAt: timestamp('completed_at'),
});

export const prospects = pgTable('prospects', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').references(() => organizations.id).notNull(),
  businessId: uuid('business_id').references(() => businesses.id).notNull(),
  searchId: uuid('search_id').references(() => prospectingSearches.id),
  companyName: text('company_name').notNull(),
  legalName: text('legal_name'),
  segment: text('segment'),
  description: text('description'),
  city: text('city'),
  state: text('state'),
  country: text('country'),
  website: text('website'),
  domain: text('domain'),
  phone: text('phone'),
  email: text('email'),
  emailType: text('email_type'), // commercial, support, general, personal, unknown
  websiteStatus: text('website_status').default('no_website_found'), // no_website_found, website_found_no_contact, contact_found, fetch_failed, blocked_by_site
  sourceUrl: text('source_url'),
  contactSource: text('contact_source'),
  confidence: text('confidence').default('medium'), // high, medium, low
  qualificationScore: integer('qualification_score'), // 0-100
  qualificationReason: text('qualification_reason'),
  qualificationFit: text('qualification_fit'), // high, medium, low
  possibleNeed: text('possible_need'),
  status: text('status').notNull().default('new'), // new, reviewed, qualified, disqualified, imported, blocked
  crmLeadId: uuid('crm_lead_id').references(() => leads.id),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const prospectContacts = pgTable('prospect_contacts', {
  id: uuid('id').defaultRandom().primaryKey(),
  prospectId: uuid('prospect_id').references(() => prospects.id, { onDelete: 'cascade' }).notNull(),
  type: text('type').notNull(), // email, phone, whatsapp, other
  value: text('value').notNull(),
  label: text('label'),
  sourceUrl: text('source_url'),
  confidence: text('confidence').default('medium'), // high, medium, low
  isPrimary: boolean('is_primary').default(false),
  createdAt: timestamp('created_at').defaultNow(),
});

export const prospectingSearchesRelations = relations(prospectingSearches, ({ one, many }) => ({
  organization: one(organizations, { fields: [prospectingSearches.organizationId], references: [organizations.id] }),
  business: one(businesses, { fields: [prospectingSearches.businessId], references: [businesses.id] }),
  user: one(users, { fields: [prospectingSearches.userId], references: [users.id] }),
  prospects: many(prospects),
}));

export const prospectsRelations = relations(prospects, ({ one, many }) => ({
  organization: one(organizations, { fields: [prospects.organizationId], references: [organizations.id] }),
  business: one(businesses, { fields: [prospects.businessId], references: [businesses.id] }),
  search: one(prospectingSearches, { fields: [prospects.searchId], references: [prospectingSearches.id] }),
  crmLead: one(leads, { fields: [prospects.crmLeadId], references: [leads.id] }),
  contacts: many(prospectContacts),
}));

export const prospectContactsRelations = relations(prospectContacts, ({ one }) => ({
  prospect: one(prospects, { fields: [prospectContacts.prospectId], references: [prospects.id] }),
}));
