import { relations } from 'drizzle-orm';
import { boolean, index, integer, jsonb, pgTable, serial, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

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
  taxId: text('tax_id'),
  address: text('address'),
  neighborhood: text('neighborhood'),
  postalCode: text('postal_code'),
  notes: text('notes'),
  sourceType: text('source_type').default('search'), // search, spreadsheet
  importBatchKey: text('import_batch_key'),
  importFileName: text('import_file_name'),
  importedAt: timestamp('imported_at'),
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

// --- PROSPECTING EMAIL CAMPAIGNS ---

export const emailSenderDomains = pgTable('email_sender_domains', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').references(() => organizations.id).notNull(),
  businessId: uuid('business_id').references(() => businesses.id).notNull(),
  createdByUserId: uuid('created_by_user_id').references(() => users.id),
  provider: text('provider').notNull().default('resend'),
  domain: text('domain').notNull(),
  providerDomainId: text('provider_domain_id').notNull(),
  region: text('region').notNull().default('sa-east-1'),
  status: text('status').notNull().default('not_started'),
  dnsRecords: jsonb('dns_records').notNull().default([]),
  spfStatus: text('spf_status').notNull().default('not_started'),
  dkimStatus: text('dkim_status').notNull().default('not_started'),
  dmarcStatus: text('dmarc_status').notNull().default('missing'),
  dmarcRecord: text('dmarc_record'),
  lastCheckedAt: timestamp('last_checked_at'),
  verifiedAt: timestamp('verified_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, table => ({
  businessDomainUnique: uniqueIndex('email_sender_domains_business_domain_uidx').on(table.businessId, table.domain),
  providerDomainUnique: uniqueIndex('email_sender_domains_provider_domain_uidx').on(table.provider, table.providerDomainId),
  businessStatusIdx: index('email_sender_domains_business_status_idx').on(table.businessId, table.status),
}));

export const emailCampaigns = pgTable('email_campaigns', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').references(() => organizations.id).notNull(),
  businessId: uuid('business_id').references(() => businesses.id).notNull(),
  createdByUserId: uuid('created_by_user_id').references(() => users.id),
  name: text('name').notNull(),
  status: text('status').notNull().default('draft'), // draft, scheduled, queued, sending, paused, completed, cancelled, failed
  subject: text('subject').notNull(),
  previewText: text('preview_text'),
  htmlBody: text('html_body'),
  textBody: text('text_body').notNull(),
  senderName: text('sender_name').notNull(),
  senderEmail: text('sender_email').notNull(),
  replyToEmail: text('reply_to_email'),
  audienceFilters: jsonb('audience_filters').default({}),
  templateVariables: jsonb('template_variables').default([]),
  legalBasis: text('legal_basis'),
  processingPurpose: text('processing_purpose'),
  balanceTestReference: text('balance_test_reference'),
  includeUnsubscribe: boolean('include_unsubscribe').notNull().default(true),
  provider: text('provider'),
  providerBatchId: text('provider_batch_id'),
  totalRecipients: integer('total_recipients').notNull().default(0),
  queuedCount: integer('queued_count').notNull().default(0),
  sentCount: integer('sent_count').notNull().default(0),
  deliveredCount: integer('delivered_count').notNull().default(0),
  openedCount: integer('opened_count').notNull().default(0),
  clickedCount: integer('clicked_count').notNull().default(0),
  bouncedCount: integer('bounced_count').notNull().default(0),
  complainedCount: integer('complained_count').notNull().default(0),
  unsubscribedCount: integer('unsubscribed_count').notNull().default(0),
  failedCount: integer('failed_count').notNull().default(0),
  sendRatePerMinute: integer('send_rate_per_minute').notNull().default(30),
  dailyLimit: integer('daily_limit').notNull().default(500),
  batchSize: integer('batch_size').notNull().default(10),
  scheduledAt: timestamp('scheduled_at'),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  lastDispatchAt: timestamp('last_dispatch_at'),
  pausedAt: timestamp('paused_at'),
  cancelledAt: timestamp('cancelled_at'),
  lastError: text('last_error'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, table => ({
  businessStatusIdx: index('email_campaigns_business_status_idx').on(table.businessId, table.status),
  scheduledIdx: index('email_campaigns_scheduled_idx').on(table.status, table.scheduledAt),
}));

export const emailCampaignRecipients = pgTable('email_campaign_recipients', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').references(() => organizations.id).notNull(),
  businessId: uuid('business_id').references(() => businesses.id).notNull(),
  campaignId: uuid('campaign_id').references(() => emailCampaigns.id, { onDelete: 'cascade' }).notNull(),
  prospectId: uuid('prospect_id').references(() => prospects.id, { onDelete: 'set null' }),
  leadId: uuid('lead_id').references(() => leads.id, { onDelete: 'set null' }),
  email: text('email').notNull(),
  normalizedEmail: text('normalized_email').notNull(),
  recipientName: text('recipient_name'),
  companyName: text('company_name'),
  personalization: jsonb('personalization').default({}),
  status: text('status').notNull().default('queued'), // queued, processing, sent, delivered, opened, clicked, bounced, complained, unsubscribed, failed, suppressed, cancelled
  providerMessageId: text('provider_message_id'),
  lastError: text('last_error'),
  attemptCount: integer('attempt_count').notNull().default(0),
  unsubscribeToken: uuid('unsubscribe_token').defaultRandom().notNull(),
  scheduledAt: timestamp('scheduled_at'),
  lastAttemptAt: timestamp('last_attempt_at'),
  sentAt: timestamp('sent_at'),
  deliveredAt: timestamp('delivered_at'),
  openedAt: timestamp('opened_at'),
  clickedAt: timestamp('clicked_at'),
  bouncedAt: timestamp('bounced_at'),
  complainedAt: timestamp('complained_at'),
  unsubscribedAt: timestamp('unsubscribed_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, table => ({
  campaignEmailUnique: uniqueIndex('email_recipients_campaign_email_uidx').on(table.campaignId, table.normalizedEmail),
  unsubscribeTokenUnique: uniqueIndex('email_recipients_unsubscribe_token_uidx').on(table.unsubscribeToken),
  dispatchIdx: index('email_recipients_dispatch_idx').on(table.campaignId, table.status, table.scheduledAt),
  providerMessageIdx: index('email_recipients_provider_message_idx').on(table.providerMessageId),
  businessEmailIdx: index('email_recipients_business_email_idx').on(table.businessId, table.normalizedEmail),
}));

export const emailCampaignEvents = pgTable('email_campaign_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').references(() => organizations.id).notNull(),
  businessId: uuid('business_id').references(() => businesses.id).notNull(),
  campaignId: uuid('campaign_id').references(() => emailCampaigns.id, { onDelete: 'cascade' }).notNull(),
  recipientId: uuid('recipient_id').references(() => emailCampaignRecipients.id, { onDelete: 'cascade' }),
  provider: text('provider').notNull(),
  providerEventId: text('provider_event_id'),
  eventType: text('event_type').notNull(), // queued, sent, delivered, opened, clicked, bounced, complained, unsubscribed, failed
  payload: jsonb('payload').default({}),
  occurredAt: timestamp('occurred_at').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
}, table => ({
  providerEventUnique: uniqueIndex('email_events_provider_event_uidx').on(table.provider, table.providerEventId),
  campaignOccurredIdx: index('email_events_campaign_occurred_idx').on(table.campaignId, table.occurredAt),
  recipientIdx: index('email_events_recipient_idx').on(table.recipientId),
}));

export const emailUnsubscribes = pgTable('email_unsubscribes', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').references(() => organizations.id).notNull(),
  businessId: uuid('business_id').references(() => businesses.id).notNull(),
  campaignId: uuid('campaign_id').references(() => emailCampaigns.id, { onDelete: 'set null' }),
  recipientId: uuid('recipient_id').references(() => emailCampaignRecipients.id, { onDelete: 'set null' }),
  email: text('email').notNull(),
  normalizedEmail: text('normalized_email').notNull(),
  reason: text('reason'),
  source: text('source').notNull().default('link'), // link, one_click, complaint, manual, provider
  unsubscribedAt: timestamp('unsubscribed_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow(),
}, table => ({
  businessEmailUnique: uniqueIndex('email_unsubscribes_business_email_uidx').on(table.businessId, table.normalizedEmail),
  campaignIdx: index('email_unsubscribes_campaign_idx').on(table.campaignId),
}));

export const emailSuppressions = pgTable('email_suppressions', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').references(() => organizations.id).notNull(),
  businessId: uuid('business_id').references(() => businesses.id).notNull(),
  sourceCampaignId: uuid('source_campaign_id').references(() => emailCampaigns.id, { onDelete: 'set null' }),
  sourceRecipientId: uuid('source_recipient_id').references(() => emailCampaignRecipients.id, { onDelete: 'set null' }),
  email: text('email').notNull(),
  normalizedEmail: text('normalized_email').notNull(),
  reason: text('reason').notNull(), // bounce, complaint, unsubscribe, invalid, manual
  provider: text('provider'),
  providerReference: text('provider_reference'),
  details: jsonb('details').default({}),
  active: boolean('active').notNull().default(true),
  suppressedAt: timestamp('suppressed_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, table => ({
  businessEmailUnique: uniqueIndex('email_suppressions_business_email_uidx').on(table.businessId, table.normalizedEmail),
  activeReasonIdx: index('email_suppressions_active_reason_idx').on(table.businessId, table.active, table.reason),
}));

export const emailDispatchWorkerState = pgTable('email_dispatch_worker_state', {
  id: text('id').primaryKey().default('main'),
  status: text('status').notNull().default('idle'),
  lastStartedAt: timestamp('last_started_at'),
  lastCompletedAt: timestamp('last_completed_at'),
  lastError: text('last_error'),
  campaignsProcessed: integer('campaigns_processed').notNull().default(0),
  recipientsProcessed: integer('recipients_processed').notNull().default(0),
  sentCount: integer('sent_count').notNull().default(0),
  failedCount: integer('failed_count').notNull().default(0),
  updatedAt: timestamp('updated_at').defaultNow(),
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

export const emailCampaignsRelations = relations(emailCampaigns, ({ one, many }) => ({
  organization: one(organizations, { fields: [emailCampaigns.organizationId], references: [organizations.id] }),
  business: one(businesses, { fields: [emailCampaigns.businessId], references: [businesses.id] }),
  createdBy: one(users, { fields: [emailCampaigns.createdByUserId], references: [users.id] }),
  recipients: many(emailCampaignRecipients),
  events: many(emailCampaignEvents),
  unsubscribes: many(emailUnsubscribes),
  suppressions: many(emailSuppressions),
}));

export const emailSenderDomainsRelations = relations(emailSenderDomains, ({ one }) => ({
  organization: one(organizations, { fields: [emailSenderDomains.organizationId], references: [organizations.id] }),
  business: one(businesses, { fields: [emailSenderDomains.businessId], references: [businesses.id] }),
  createdBy: one(users, { fields: [emailSenderDomains.createdByUserId], references: [users.id] }),
}));

export const emailCampaignRecipientsRelations = relations(emailCampaignRecipients, ({ one, many }) => ({
  organization: one(organizations, { fields: [emailCampaignRecipients.organizationId], references: [organizations.id] }),
  business: one(businesses, { fields: [emailCampaignRecipients.businessId], references: [businesses.id] }),
  campaign: one(emailCampaigns, { fields: [emailCampaignRecipients.campaignId], references: [emailCampaigns.id] }),
  prospect: one(prospects, { fields: [emailCampaignRecipients.prospectId], references: [prospects.id] }),
  lead: one(leads, { fields: [emailCampaignRecipients.leadId], references: [leads.id] }),
  events: many(emailCampaignEvents),
  unsubscribes: many(emailUnsubscribes),
  suppressions: many(emailSuppressions),
}));

export const emailCampaignEventsRelations = relations(emailCampaignEvents, ({ one }) => ({
  organization: one(organizations, { fields: [emailCampaignEvents.organizationId], references: [organizations.id] }),
  business: one(businesses, { fields: [emailCampaignEvents.businessId], references: [businesses.id] }),
  campaign: one(emailCampaigns, { fields: [emailCampaignEvents.campaignId], references: [emailCampaigns.id] }),
  recipient: one(emailCampaignRecipients, { fields: [emailCampaignEvents.recipientId], references: [emailCampaignRecipients.id] }),
}));

export const emailUnsubscribesRelations = relations(emailUnsubscribes, ({ one }) => ({
  organization: one(organizations, { fields: [emailUnsubscribes.organizationId], references: [organizations.id] }),
  business: one(businesses, { fields: [emailUnsubscribes.businessId], references: [businesses.id] }),
  campaign: one(emailCampaigns, { fields: [emailUnsubscribes.campaignId], references: [emailCampaigns.id] }),
  recipient: one(emailCampaignRecipients, { fields: [emailUnsubscribes.recipientId], references: [emailCampaignRecipients.id] }),
}));

export const emailSuppressionsRelations = relations(emailSuppressions, ({ one }) => ({
  organization: one(organizations, { fields: [emailSuppressions.organizationId], references: [organizations.id] }),
  business: one(businesses, { fields: [emailSuppressions.businessId], references: [businesses.id] }),
  sourceCampaign: one(emailCampaigns, { fields: [emailSuppressions.sourceCampaignId], references: [emailCampaigns.id] }),
  sourceRecipient: one(emailCampaignRecipients, { fields: [emailSuppressions.sourceRecipientId], references: [emailCampaignRecipients.id] }),
}));
