var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc7) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc7 = __getOwnPropDesc(from, key)) || desc7.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/vercel-handler.ts
var vercel_handler_exports = {};
__export(vercel_handler_exports, {
  default: () => vercel_handler_default
});
module.exports = __toCommonJS(vercel_handler_exports);
var import_express10 = __toESM(require("express"), 1);
var import_pg2 = require("pg");
var import_bcryptjs2 = __toESM(require("bcryptjs"), 1);
var import_jsonwebtoken3 = __toESM(require("jsonwebtoken"), 1);

// src/server/app.ts
var import_express9 = __toESM(require("express"), 1);
var dotenv2 = __toESM(require("dotenv"), 1);
var import_jsonwebtoken2 = __toESM(require("jsonwebtoken"), 1);

// src/middleware/auth.ts
var import_jsonwebtoken = __toESM(require("jsonwebtoken"), 1);
var JWT_SECRET_KEY = process.env.JWT_SECRET || "mkt-agro-bw-secret-key-2026";
var requireAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized: Missing token" });
  }
  const token = authHeader.split("Bearer ")[1];
  try {
    const decoded = import_jsonwebtoken.default.verify(token, JWT_SECRET_KEY);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({
      error: "Unauthorized: Token expired or invalid",
      code: "auth/invalid-token"
    });
  }
};

// src/db/index.ts
var import_node_postgres = require("drizzle-orm/node-postgres");
var import_pg = require("pg");
var dotenv = __toESM(require("dotenv"), 1);

// src/db/schema.ts
var schema_exports = {};
__export(schema_exports, {
  aiGenerations: () => aiGenerations,
  businesses: () => businesses,
  businessesRelations: () => businessesRelations,
  campaignAssets: () => campaignAssets,
  campaignAssetsRelations: () => campaignAssetsRelations,
  campaignChannels: () => campaignChannels,
  campaignChannelsRelations: () => campaignChannelsRelations,
  campaignTasks: () => campaignTasks,
  campaignTasksRelations: () => campaignTasksRelations,
  campaigns: () => campaigns,
  campaignsRelations: () => campaignsRelations,
  contentItems: () => contentItems,
  contentItemsRelations: () => contentItemsRelations,
  goals: () => goals,
  goalsRelations: () => goalsRelations,
  leadActivities: () => leadActivities,
  leadActivitiesRelations: () => leadActivitiesRelations,
  leads: () => leads,
  leadsRelations: () => leadsRelations,
  marketingProfiles: () => marketingProfiles,
  marketingProfilesRelations: () => marketingProfilesRelations,
  opportunities: () => opportunities,
  opportunitiesRelations: () => opportunitiesRelations,
  organizationMembers: () => organizationMembers,
  organizationMembersRelations: () => organizationMembersRelations,
  organizations: () => organizations,
  organizationsRelations: () => organizationsRelations,
  products: () => products,
  productsRelations: () => productsRelations,
  prospectContacts: () => prospectContacts,
  prospectContactsRelations: () => prospectContactsRelations,
  prospectingSearches: () => prospectingSearches,
  prospectingSearchesRelations: () => prospectingSearchesRelations,
  prospects: () => prospects,
  prospectsRelations: () => prospectsRelations,
  recommendations: () => recommendations,
  recommendationsRelations: () => recommendationsRelations,
  strategies: () => strategies,
  strategiesRelations: () => strategiesRelations,
  strategyChannels: () => strategyChannels,
  strategyPlanWeeks: () => strategyPlanWeeks,
  targetAudiences: () => targetAudiences,
  targetAudiencesRelations: () => targetAudiencesRelations,
  users: () => users,
  usersRelations: () => usersRelations
});
var import_drizzle_orm = require("drizzle-orm");
var import_pg_core = require("drizzle-orm/pg-core");
var users = (0, import_pg_core.pgTable)("users", {
  id: (0, import_pg_core.uuid)("id").defaultRandom().primaryKey(),
  uid: (0, import_pg_core.text)("uid").notNull().unique(),
  email: (0, import_pg_core.text)("email").notNull().unique(),
  passwordHash: (0, import_pg_core.text)("password_hash"),
  name: (0, import_pg_core.text)("name"),
  createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow()
});
var organizations = (0, import_pg_core.pgTable)("organizations", {
  id: (0, import_pg_core.uuid)("id").defaultRandom().primaryKey(),
  name: (0, import_pg_core.text)("name").notNull(),
  createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow()
});
var organizationMembers = (0, import_pg_core.pgTable)("organization_members", {
  id: (0, import_pg_core.uuid)("id").defaultRandom().primaryKey(),
  userId: (0, import_pg_core.uuid)("user_id").references(() => users.id).notNull(),
  organizationId: (0, import_pg_core.uuid)("organization_id").references(() => organizations.id).notNull(),
  role: (0, import_pg_core.text)("role").notNull().default("owner"),
  createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow()
});
var businesses = (0, import_pg_core.pgTable)("businesses", {
  id: (0, import_pg_core.uuid)("id").defaultRandom().primaryKey(),
  organizationId: (0, import_pg_core.uuid)("organization_id").references(() => organizations.id).notNull(),
  name: (0, import_pg_core.text)("name").notNull(),
  segment: (0, import_pg_core.text)("segment"),
  description: (0, import_pg_core.text)("description"),
  // Onboarding Phase 1 details
  city: (0, import_pg_core.text)("city"),
  state: (0, import_pg_core.text)("state"),
  country: (0, import_pg_core.text)("country").default("Brasil"),
  website: (0, import_pg_core.text)("website"),
  instagram: (0, import_pg_core.text)("instagram"),
  whatsapp: (0, import_pg_core.text)("whatsapp"),
  serviceArea: (0, import_pg_core.text)("service_area"),
  serviceType: (0, import_pg_core.text)("service_type"),
  // Control flow
  onboardingCompleted: (0, import_pg_core.boolean)("onboarding_completed").default(false),
  onboardingCompletedAt: (0, import_pg_core.timestamp)("onboarding_completed_at"),
  createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow()
});
var products = (0, import_pg_core.pgTable)("products", {
  id: (0, import_pg_core.uuid)("id").defaultRandom().primaryKey(),
  businessId: (0, import_pg_core.uuid)("business_id").references(() => businesses.id).notNull(),
  name: (0, import_pg_core.text)("name").notNull(),
  type: (0, import_pg_core.text)("type").notNull(),
  // 'produto' ou 'serviço'
  description: (0, import_pg_core.text)("description"),
  price: (0, import_pg_core.text)("price"),
  ticketValue: (0, import_pg_core.text)("ticket_value"),
  mainBenefit: (0, import_pg_core.text)("main_benefit"),
  differentiators: (0, import_pg_core.text)("differentiators"),
  idealCustomer: (0, import_pg_core.text)("ideal_customer"),
  isMain: (0, import_pg_core.boolean)("is_main").default(false),
  createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow()
});
var targetAudiences = (0, import_pg_core.pgTable)("target_audiences", {
  id: (0, import_pg_core.uuid)("id").defaultRandom().primaryKey(),
  businessId: (0, import_pg_core.uuid)("business_id").references(() => businesses.id).notNull(),
  description: (0, import_pg_core.text)("description"),
  ageRange: (0, import_pg_core.text)("age_range"),
  location: (0, import_pg_core.text)("location"),
  profile: (0, import_pg_core.text)("profile"),
  pains: (0, import_pg_core.jsonb)("pains").default([]),
  desires: (0, import_pg_core.jsonb)("desires").default([]),
  objections: (0, import_pg_core.jsonb)("objections").default([]),
  decisionFactors: (0, import_pg_core.text)("decision_factors"),
  createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow()
});
var marketingProfiles = (0, import_pg_core.pgTable)("marketing_profiles", {
  id: (0, import_pg_core.uuid)("id").defaultRandom().primaryKey(),
  businessId: (0, import_pg_core.uuid)("business_id").references(() => businesses.id).notNull(),
  channels: (0, import_pg_core.jsonb)("channels").default([]),
  postFrequency: (0, import_pg_core.text)("post_frequency"),
  monthlyInvestment: (0, import_pg_core.text)("monthly_investment"),
  monthlyLeads: (0, import_pg_core.text)("monthly_leads"),
  monthlySales: (0, import_pg_core.text)("monthly_sales"),
  mainDifficulty: (0, import_pg_core.text)("main_difficulty"),
  createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow()
});
var goals = (0, import_pg_core.pgTable)("goals", {
  id: (0, import_pg_core.uuid)("id").defaultRandom().primaryKey(),
  businessId: (0, import_pg_core.uuid)("business_id").references(() => businesses.id).notNull(),
  goalType: (0, import_pg_core.text)("goal_type").notNull(),
  specificProductId: (0, import_pg_core.uuid)("specific_product_id").references(() => products.id),
  targetMetric: (0, import_pg_core.text)("target_metric"),
  timeframe: (0, import_pg_core.text)("timeframe"),
  createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow()
});
var strategies = (0, import_pg_core.pgTable)("strategies", {
  id: (0, import_pg_core.uuid)("id").defaultRandom().primaryKey(),
  businessId: (0, import_pg_core.uuid)("business_id").references(() => businesses.id).notNull(),
  businessSummary: (0, import_pg_core.text)("business_summary"),
  idealCustomerDesc: (0, import_pg_core.text)("ideal_customer_desc"),
  idealCustomerPains: (0, import_pg_core.jsonb)("ideal_customer_pains").default([]),
  idealCustomerDesires: (0, import_pg_core.jsonb)("ideal_customer_desires").default([]),
  idealCustomerObjections: (0, import_pg_core.jsonb)("ideal_customer_objections").default([]),
  positioningStatement: (0, import_pg_core.text)("positioning_statement"),
  valueProposition: (0, import_pg_core.text)("value_proposition"),
  differentiators: (0, import_pg_core.jsonb)("differentiators").default([]),
  isActive: (0, import_pg_core.boolean)("is_active").default(true),
  createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow()
});
var strategyChannels = (0, import_pg_core.pgTable)("strategy_channels", {
  id: (0, import_pg_core.uuid)("id").defaultRandom().primaryKey(),
  strategyId: (0, import_pg_core.uuid)("strategy_id").references(() => strategies.id).notNull(),
  channel: (0, import_pg_core.text)("channel").notNull(),
  priority: (0, import_pg_core.integer)("priority"),
  reason: (0, import_pg_core.text)("reason")
});
var strategyPlanWeeks = (0, import_pg_core.pgTable)("strategy_plan_weeks", {
  id: (0, import_pg_core.uuid)("id").defaultRandom().primaryKey(),
  strategyId: (0, import_pg_core.uuid)("strategy_id").references(() => strategies.id).notNull(),
  week: (0, import_pg_core.integer)("week").notNull(),
  objective: (0, import_pg_core.text)("objective"),
  actions: (0, import_pg_core.jsonb)("actions").default([])
});
var opportunities = (0, import_pg_core.pgTable)("opportunities", {
  id: (0, import_pg_core.uuid)("id").defaultRandom().primaryKey(),
  businessId: (0, import_pg_core.uuid)("business_id").references(() => businesses.id).notNull(),
  title: (0, import_pg_core.text)("title").notNull(),
  description: (0, import_pg_core.text)("description"),
  impact: (0, import_pg_core.text)("impact"),
  // high, medium, low
  effort: (0, import_pg_core.text)("effort"),
  // high, medium, low
  status: (0, import_pg_core.text)("status").default("open"),
  createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow()
});
var aiGenerations = (0, import_pg_core.pgTable)("ai_generations", {
  id: (0, import_pg_core.uuid)("id").defaultRandom().primaryKey(),
  organizationId: (0, import_pg_core.uuid)("organization_id").references(() => organizations.id),
  businessId: (0, import_pg_core.uuid)("business_id").references(() => businesses.id),
  type: (0, import_pg_core.text)("type").notNull(),
  // e.g. 'initial_strategy', 'post'
  provider: (0, import_pg_core.text)("provider"),
  model: (0, import_pg_core.text)("model"),
  inputHash: (0, import_pg_core.text)("input_hash"),
  // we can store stringified context briefly
  output: (0, import_pg_core.jsonb)("output"),
  createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow()
});
var contentItems = (0, import_pg_core.pgTable)("content_items", {
  id: (0, import_pg_core.uuid)("id").defaultRandom().primaryKey(),
  organizationId: (0, import_pg_core.uuid)("organization_id").references(() => organizations.id).notNull(),
  businessId: (0, import_pg_core.uuid)("business_id").references(() => businesses.id).notNull(),
  strategyId: (0, import_pg_core.uuid)("strategy_id").references(() => strategies.id),
  title: (0, import_pg_core.text)("title").notNull(),
  topic: (0, import_pg_core.text)("topic"),
  channel: (0, import_pg_core.text)("channel"),
  format: (0, import_pg_core.text)("format"),
  funnelStage: (0, import_pg_core.text)("funnel_stage"),
  objective: (0, import_pg_core.text)("objective"),
  scheduledDate: (0, import_pg_core.text)("scheduled_date"),
  status: (0, import_pg_core.text)("status").default("idea"),
  // idea, draft, ready, published
  hook: (0, import_pg_core.text)("hook"),
  body: (0, import_pg_core.text)("body"),
  caption: (0, import_pg_core.text)("caption"),
  cta: (0, import_pg_core.text)("cta"),
  hashtags: (0, import_pg_core.jsonb)("hashtags").default([]),
  visualDirection: (0, import_pg_core.text)("visual_direction"),
  videoScript: (0, import_pg_core.text)("video_script"),
  generationContext: (0, import_pg_core.jsonb)("generation_context"),
  createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow(),
  updatedAt: (0, import_pg_core.timestamp)("updated_at").defaultNow(),
  publishedAt: (0, import_pg_core.timestamp)("published_at"),
  campaignId: (0, import_pg_core.uuid)("campaign_id")
});
var campaigns = (0, import_pg_core.pgTable)("campaigns", {
  id: (0, import_pg_core.uuid)("id").defaultRandom().primaryKey(),
  organizationId: (0, import_pg_core.uuid)("organization_id").references(() => organizations.id).notNull(),
  businessId: (0, import_pg_core.uuid)("business_id").references(() => businesses.id).notNull(),
  strategyId: (0, import_pg_core.uuid)("strategy_id").references(() => strategies.id),
  productId: (0, import_pg_core.uuid)("product_id").references(() => products.id),
  name: (0, import_pg_core.text)("name").notNull(),
  objective: (0, import_pg_core.text)("objective"),
  description: (0, import_pg_core.text)("description"),
  targetAudience: (0, import_pg_core.jsonb)("target_audience"),
  // custom audience mapping
  offer: (0, import_pg_core.jsonb)("offer"),
  // value_proposition, description, urgency
  mainArgument: (0, import_pg_core.text)("main_argument"),
  messaging: (0, import_pg_core.jsonb)("messaging"),
  // main_message, supporting_arguments
  budget: (0, import_pg_core.text)("budget"),
  startDate: (0, import_pg_core.text)("start_date"),
  endDate: (0, import_pg_core.text)("end_date"),
  status: (0, import_pg_core.text)("status").default("draft"),
  // draft, ready, active, paused, completed, archived
  primaryMetric: (0, import_pg_core.text)("primary_metric"),
  impressions: (0, import_pg_core.integer)("impressions").default(0),
  clicks: (0, import_pg_core.integer)("clicks").default(0),
  leads: (0, import_pg_core.integer)("leads").default(0),
  sales: (0, import_pg_core.integer)("sales").default(0),
  investmentSpent: (0, import_pg_core.integer)("investment_spent").default(0),
  revenueGenerated: (0, import_pg_core.integer)("revenue_generated").default(0),
  createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow(),
  updatedAt: (0, import_pg_core.timestamp)("updated_at").defaultNow()
});
var campaignChannels = (0, import_pg_core.pgTable)("campaign_channels", {
  id: (0, import_pg_core.uuid)("id").defaultRandom().primaryKey(),
  campaignId: (0, import_pg_core.uuid)("campaign_id").references(() => campaigns.id).notNull(),
  channel: (0, import_pg_core.text)("channel").notNull(),
  objective: (0, import_pg_core.text)("objective"),
  budget: (0, import_pg_core.text)("budget"),
  status: (0, import_pg_core.text)("status").default("planned")
});
var campaignAssets = (0, import_pg_core.pgTable)("campaign_assets", {
  id: (0, import_pg_core.uuid)("id").defaultRandom().primaryKey(),
  campaignId: (0, import_pg_core.uuid)("campaign_id").references(() => campaigns.id).notNull(),
  type: (0, import_pg_core.text)("type").notNull(),
  // ad, social_post, landing_page, whatsapp, email, creative_brief
  channel: (0, import_pg_core.text)("channel"),
  title: (0, import_pg_core.text)("title").notNull(),
  content: (0, import_pg_core.jsonb)("content"),
  // structured content based on type
  metadata: (0, import_pg_core.jsonb)("metadata"),
  status: (0, import_pg_core.text)("status").default("draft"),
  createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow(),
  updatedAt: (0, import_pg_core.timestamp)("updated_at").defaultNow()
});
var campaignTasks = (0, import_pg_core.pgTable)("campaign_tasks", {
  id: (0, import_pg_core.uuid)("id").defaultRandom().primaryKey(),
  campaignId: (0, import_pg_core.uuid)("campaign_id").references(() => campaigns.id).notNull(),
  title: (0, import_pg_core.text)("title").notNull(),
  description: (0, import_pg_core.text)("description"),
  dueDate: (0, import_pg_core.text)("due_date"),
  status: (0, import_pg_core.text)("status").default("todo"),
  // todo, doing, done
  priority: (0, import_pg_core.text)("priority").default("medium")
});
var leads = (0, import_pg_core.pgTable)("leads", {
  id: (0, import_pg_core.uuid)("id").defaultRandom().primaryKey(),
  organizationId: (0, import_pg_core.uuid)("organization_id").references(() => organizations.id).notNull(),
  businessId: (0, import_pg_core.uuid)("business_id").references(() => businesses.id).notNull(),
  campaignId: (0, import_pg_core.uuid)("campaign_id").references(() => campaigns.id),
  productId: (0, import_pg_core.uuid)("product_id").references(() => products.id),
  name: (0, import_pg_core.text)("name").notNull(),
  companyName: (0, import_pg_core.text)("company_name"),
  email: (0, import_pg_core.text)("email"),
  phone: (0, import_pg_core.text)("phone"),
  source: (0, import_pg_core.text)("source").notNull().default("Manual"),
  // Instagram, Facebook, Google, WhatsApp, LinkedIn, Site, Indicação, Campanha, Manual, Outro
  status: (0, import_pg_core.text)("status").notNull().default("new"),
  // new, contacted, interested, proposal, customer, lost
  potentialValue: (0, import_pg_core.integer)("potential_value"),
  // em reais/inteiro
  actualValue: (0, import_pg_core.integer)("actual_value"),
  // em reais/inteiro para vendas realizadas
  responsibleUserId: (0, import_pg_core.uuid)("responsible_user_id").references(() => users.id),
  notes: (0, import_pg_core.text)("notes"),
  lastContactAt: (0, import_pg_core.timestamp)("last_contact_at"),
  nextAction: (0, import_pg_core.text)("next_action"),
  nextActionAt: (0, import_pg_core.timestamp)("next_action_at"),
  convertedAt: (0, import_pg_core.timestamp)("converted_at"),
  lostAt: (0, import_pg_core.timestamp)("lost_at"),
  lostReason: (0, import_pg_core.text)("lost_reason"),
  // Preço, Sem interesse, Concorrente, Sem resposta, Momento inadequado, Produto não adequado, Outro
  createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow(),
  updatedAt: (0, import_pg_core.timestamp)("updated_at").defaultNow()
});
var leadActivities = (0, import_pg_core.pgTable)("lead_activities", {
  id: (0, import_pg_core.uuid)("id").defaultRandom().primaryKey(),
  organizationId: (0, import_pg_core.uuid)("organization_id").references(() => organizations.id).notNull(),
  businessId: (0, import_pg_core.uuid)("business_id").references(() => businesses.id).notNull(),
  leadId: (0, import_pg_core.uuid)("lead_id").references(() => leads.id).notNull(),
  userId: (0, import_pg_core.uuid)("user_id").references(() => users.id),
  type: (0, import_pg_core.text)("type").notNull(),
  // created, note, contact, status_change, follow_up, proposal, conversion, lost
  description: (0, import_pg_core.text)("description").notNull(),
  metadata: (0, import_pg_core.jsonb)("metadata"),
  createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow()
});
var recommendations = (0, import_pg_core.pgTable)("recommendations", {
  id: (0, import_pg_core.uuid)("id").defaultRandom().primaryKey(),
  organizationId: (0, import_pg_core.uuid)("organization_id").references(() => organizations.id).notNull(),
  businessId: (0, import_pg_core.uuid)("business_id").references(() => businesses.id).notNull(),
  fingerprint: (0, import_pg_core.text)("fingerprint").notNull(),
  type: (0, import_pg_core.text)("type").notNull(),
  category: (0, import_pg_core.text)("category").notNull(),
  // sales, content, campaign, strategy, opportunity
  title: (0, import_pg_core.text)("title").notNull(),
  description: (0, import_pg_core.text)("description").notNull(),
  reason: (0, import_pg_core.text)("reason"),
  priority: (0, import_pg_core.text)("priority").notNull(),
  // low, medium, high, critical
  priorityScore: (0, import_pg_core.integer)("priority_score").notNull(),
  // 0 - 100
  impact: (0, import_pg_core.text)("impact").notNull(),
  // low, medium, high
  sourceType: (0, import_pg_core.text)("source_type").notNull(),
  // lead, campaign, content, strategy, pipeline, goal
  sourceId: (0, import_pg_core.text)("source_id"),
  actionType: (0, import_pg_core.text)("action_type"),
  actionUrl: (0, import_pg_core.text)("action_url"),
  status: (0, import_pg_core.text)("status").notNull().default("active"),
  // active, completed, dismissed, expired
  metadata: (0, import_pg_core.jsonb)("metadata"),
  createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow(),
  updatedAt: (0, import_pg_core.timestamp)("updated_at").defaultNow(),
  resolvedAt: (0, import_pg_core.timestamp)("resolved_at"),
  dismissedAt: (0, import_pg_core.timestamp)("dismissed_at")
});
var usersRelations = (0, import_drizzle_orm.relations)(users, ({ many }) => ({
  memberships: many(organizationMembers)
}));
var organizationsRelations = (0, import_drizzle_orm.relations)(organizations, ({ many }) => ({
  members: many(organizationMembers),
  businesses: many(businesses)
}));
var organizationMembersRelations = (0, import_drizzle_orm.relations)(organizationMembers, ({ one }) => ({
  user: one(users, { fields: [organizationMembers.userId], references: [users.id] }),
  organization: one(organizations, { fields: [organizationMembers.organizationId], references: [organizations.id] })
}));
var businessesRelations = (0, import_drizzle_orm.relations)(businesses, ({ one, many }) => ({
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
  recommendations: many(recommendations)
}));
var contentItemsRelations = (0, import_drizzle_orm.relations)(contentItems, ({ one }) => ({
  organization: one(organizations, { fields: [contentItems.organizationId], references: [organizations.id] }),
  business: one(businesses, { fields: [contentItems.businessId], references: [businesses.id] }),
  strategy: one(strategies, { fields: [contentItems.strategyId], references: [strategies.id] }),
  campaign: one(campaigns, { fields: [contentItems.campaignId], references: [campaigns.id] })
}));
var campaignsRelations = (0, import_drizzle_orm.relations)(campaigns, ({ one, many }) => ({
  organization: one(organizations, { fields: [campaigns.organizationId], references: [organizations.id] }),
  business: one(businesses, { fields: [campaigns.businessId], references: [businesses.id] }),
  strategy: one(strategies, { fields: [campaigns.strategyId], references: [strategies.id] }),
  product: one(products, { fields: [campaigns.productId], references: [products.id] }),
  channels: many(campaignChannels),
  assets: many(campaignAssets),
  tasks: many(campaignTasks),
  contentItems: many(contentItems)
}));
var campaignChannelsRelations = (0, import_drizzle_orm.relations)(campaignChannels, ({ one }) => ({
  campaign: one(campaigns, { fields: [campaignChannels.campaignId], references: [campaigns.id] })
}));
var campaignAssetsRelations = (0, import_drizzle_orm.relations)(campaignAssets, ({ one }) => ({
  campaign: one(campaigns, { fields: [campaignAssets.campaignId], references: [campaigns.id] })
}));
var campaignTasksRelations = (0, import_drizzle_orm.relations)(campaignTasks, ({ one }) => ({
  campaign: one(campaigns, { fields: [campaignTasks.campaignId], references: [campaigns.id] })
}));
var productsRelations = (0, import_drizzle_orm.relations)(products, ({ one }) => ({
  business: one(businesses, { fields: [products.businessId], references: [businesses.id] })
}));
var targetAudiencesRelations = (0, import_drizzle_orm.relations)(targetAudiences, ({ one }) => ({
  business: one(businesses, { fields: [targetAudiences.businessId], references: [businesses.id] })
}));
var marketingProfilesRelations = (0, import_drizzle_orm.relations)(marketingProfiles, ({ one }) => ({
  business: one(businesses, { fields: [marketingProfiles.businessId], references: [businesses.id] })
}));
var goalsRelations = (0, import_drizzle_orm.relations)(goals, ({ one }) => ({
  business: one(businesses, { fields: [goals.businessId], references: [businesses.id] })
}));
var strategiesRelations = (0, import_drizzle_orm.relations)(strategies, ({ one }) => ({
  business: one(businesses, { fields: [strategies.businessId], references: [businesses.id] })
}));
var opportunitiesRelations = (0, import_drizzle_orm.relations)(opportunities, ({ one }) => ({
  business: one(businesses, { fields: [opportunities.businessId], references: [businesses.id] })
}));
var leadsRelations = (0, import_drizzle_orm.relations)(leads, ({ one, many }) => ({
  organization: one(organizations, { fields: [leads.organizationId], references: [organizations.id] }),
  business: one(businesses, { fields: [leads.businessId], references: [businesses.id] }),
  campaign: one(campaigns, { fields: [leads.campaignId], references: [campaigns.id] }),
  product: one(products, { fields: [leads.productId], references: [products.id] }),
  responsibleUser: one(users, { fields: [leads.responsibleUserId], references: [users.id] }),
  activities: many(leadActivities)
}));
var leadActivitiesRelations = (0, import_drizzle_orm.relations)(leadActivities, ({ one }) => ({
  organization: one(organizations, { fields: [leadActivities.organizationId], references: [organizations.id] }),
  business: one(businesses, { fields: [leadActivities.businessId], references: [businesses.id] }),
  lead: one(leads, { fields: [leadActivities.leadId], references: [leads.id] }),
  user: one(users, { fields: [leadActivities.userId], references: [users.id] })
}));
var recommendationsRelations = (0, import_drizzle_orm.relations)(recommendations, ({ one }) => ({
  organization: one(organizations, { fields: [recommendations.organizationId], references: [organizations.id] }),
  business: one(businesses, { fields: [recommendations.businessId], references: [businesses.id] })
}));
var prospectingSearches = (0, import_pg_core.pgTable)("prospecting_searches", {
  id: (0, import_pg_core.uuid)("id").defaultRandom().primaryKey(),
  organizationId: (0, import_pg_core.uuid)("organization_id").references(() => organizations.id).notNull(),
  businessId: (0, import_pg_core.uuid)("business_id").references(() => businesses.id).notNull(),
  userId: (0, import_pg_core.uuid)("user_id").references(() => users.id),
  segment: (0, import_pg_core.text)("segment").notNull(),
  city: (0, import_pg_core.text)("city"),
  state: (0, import_pg_core.text)("state"),
  country: (0, import_pg_core.text)("country"),
  radiusKm: (0, import_pg_core.integer)("radius_km"),
  keywords: (0, import_pg_core.text)("keywords"),
  requestedLimit: (0, import_pg_core.integer)("requested_limit").default(25).notNull(),
  status: (0, import_pg_core.text)("status").notNull().default("pending"),
  // pending, running, completed, failed
  totalFound: (0, import_pg_core.integer)("total_found").default(0),
  totalWithEmail: (0, import_pg_core.integer)("total_with_email").default(0),
  totalWithPhone: (0, import_pg_core.integer)("total_with_phone").default(0),
  createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow(),
  updatedAt: (0, import_pg_core.timestamp)("updated_at").defaultNow(),
  completedAt: (0, import_pg_core.timestamp)("completed_at")
});
var prospects = (0, import_pg_core.pgTable)("prospects", {
  id: (0, import_pg_core.uuid)("id").defaultRandom().primaryKey(),
  organizationId: (0, import_pg_core.uuid)("organization_id").references(() => organizations.id).notNull(),
  businessId: (0, import_pg_core.uuid)("business_id").references(() => businesses.id).notNull(),
  searchId: (0, import_pg_core.uuid)("search_id").references(() => prospectingSearches.id),
  companyName: (0, import_pg_core.text)("company_name").notNull(),
  legalName: (0, import_pg_core.text)("legal_name"),
  segment: (0, import_pg_core.text)("segment"),
  description: (0, import_pg_core.text)("description"),
  city: (0, import_pg_core.text)("city"),
  state: (0, import_pg_core.text)("state"),
  country: (0, import_pg_core.text)("country"),
  website: (0, import_pg_core.text)("website"),
  domain: (0, import_pg_core.text)("domain"),
  phone: (0, import_pg_core.text)("phone"),
  email: (0, import_pg_core.text)("email"),
  emailType: (0, import_pg_core.text)("email_type"),
  // commercial, support, general, personal, unknown
  websiteStatus: (0, import_pg_core.text)("website_status").default("no_website_found"),
  // no_website_found, website_found_no_contact, contact_found, fetch_failed, blocked_by_site
  sourceUrl: (0, import_pg_core.text)("source_url"),
  contactSource: (0, import_pg_core.text)("contact_source"),
  confidence: (0, import_pg_core.text)("confidence").default("medium"),
  // high, medium, low
  qualificationScore: (0, import_pg_core.integer)("qualification_score"),
  // 0-100
  qualificationReason: (0, import_pg_core.text)("qualification_reason"),
  qualificationFit: (0, import_pg_core.text)("qualification_fit"),
  // high, medium, low
  possibleNeed: (0, import_pg_core.text)("possible_need"),
  status: (0, import_pg_core.text)("status").notNull().default("new"),
  // new, reviewed, qualified, disqualified, imported, blocked
  crmLeadId: (0, import_pg_core.uuid)("crm_lead_id").references(() => leads.id),
  createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow(),
  updatedAt: (0, import_pg_core.timestamp)("updated_at").defaultNow()
});
var prospectContacts = (0, import_pg_core.pgTable)("prospect_contacts", {
  id: (0, import_pg_core.uuid)("id").defaultRandom().primaryKey(),
  prospectId: (0, import_pg_core.uuid)("prospect_id").references(() => prospects.id, { onDelete: "cascade" }).notNull(),
  type: (0, import_pg_core.text)("type").notNull(),
  // email, phone, whatsapp, other
  value: (0, import_pg_core.text)("value").notNull(),
  label: (0, import_pg_core.text)("label"),
  sourceUrl: (0, import_pg_core.text)("source_url"),
  confidence: (0, import_pg_core.text)("confidence").default("medium"),
  // high, medium, low
  isPrimary: (0, import_pg_core.boolean)("is_primary").default(false),
  createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow()
});
var prospectingSearchesRelations = (0, import_drizzle_orm.relations)(prospectingSearches, ({ one, many }) => ({
  organization: one(organizations, { fields: [prospectingSearches.organizationId], references: [organizations.id] }),
  business: one(businesses, { fields: [prospectingSearches.businessId], references: [businesses.id] }),
  user: one(users, { fields: [prospectingSearches.userId], references: [users.id] }),
  prospects: many(prospects)
}));
var prospectsRelations = (0, import_drizzle_orm.relations)(prospects, ({ one, many }) => ({
  organization: one(organizations, { fields: [prospects.organizationId], references: [organizations.id] }),
  business: one(businesses, { fields: [prospects.businessId], references: [businesses.id] }),
  search: one(prospectingSearches, { fields: [prospects.searchId], references: [prospectingSearches.id] }),
  crmLead: one(leads, { fields: [prospects.crmLeadId], references: [leads.id] }),
  contacts: many(prospectContacts)
}));
var prospectContactsRelations = (0, import_drizzle_orm.relations)(prospectContacts, ({ one }) => ({
  prospect: one(prospects, { fields: [prospectContacts.prospectId], references: [prospects.id] })
}));

// src/db/index.ts
dotenv.config();
var createPool = () => {
  if (!global._postgresPool) {
    const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
    const poolConfig = connectionString ? {
      connectionString,
      ssl: connectionString.includes("localhost") || connectionString.includes("127.0.0.1") ? false : { rejectUnauthorized: false },
      max: 10,
      connectionTimeoutMillis: 15e3
    } : {
      host: process.env.SQL_HOST,
      user: process.env.SQL_USER || process.env.SQL_ADMIN_USER,
      password: process.env.SQL_PASSWORD || process.env.SQL_ADMIN_PASSWORD,
      database: process.env.SQL_DB_NAME,
      ssl: false,
      max: 10,
      connectionTimeoutMillis: 15e3
    };
    global._postgresPool = new import_pg.Pool(poolConfig);
    global._postgresPool.on("error", (err) => {
      console.error("Unexpected error on idle SQL pool client:", err);
    });
  }
  return global._postgresPool;
};
var pool = createPool();
var db = (0, import_node_postgres.drizzle)(pool, { schema: schema_exports });

// src/db/users.ts
var import_drizzle_orm2 = require("drizzle-orm");
var import_bcryptjs = __toESM(require("bcryptjs"), 1);
async function registerUserInDB(name, email, password) {
  const normalizedEmail = email.trim().toLowerCase();
  const existingUser = await db.select().from(users).where((0, import_drizzle_orm2.eq)(users.email, normalizedEmail)).limit(1).then((res) => res[0]);
  if (existingUser) {
    throw new Error("J\xE1 existe um usu\xE1rio cadastrado com este e-mail.");
  }
  const passwordHash = await import_bcryptjs.default.hash(password, 10);
  const uid = `user_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  return await db.transaction(async (tx) => {
    const newUser = await tx.insert(users).values({
      uid,
      email: normalizedEmail,
      name,
      passwordHash
    }).returning().then((res) => res[0]);
    const orgName = name ? `Empresa de ${name}` : `Empresa de ${normalizedEmail.split("@")[0]}`;
    const org = await tx.insert(organizations).values({ name: orgName }).returning().then((res) => res[0]);
    await tx.insert(organizationMembers).values({
      userId: newUser.id,
      organizationId: org.id,
      role: "owner"
    });
    const business = await tx.insert(businesses).values({
      organizationId: org.id,
      name: `Neg\xF3cio Principal`
    }).returning().then((res) => res[0]);
    const { passwordHash: _, ...userWithoutPassword } = newUser;
    return { user: userWithoutPassword, business };
  });
}
async function loginUserInDB(email, password) {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await db.select().from(users).where((0, import_drizzle_orm2.eq)(users.email, normalizedEmail)).limit(1).then((res) => res[0]);
  if (!user || !user.passwordHash) {
    throw new Error("E-mail ou senha incorretos.");
  }
  const isPasswordValid = await import_bcryptjs.default.compare(password, user.passwordHash);
  if (!isPasswordValid) {
    throw new Error("E-mail ou senha incorretos.");
  }
  const { user: syncedUser, business } = await getOrCreateUserAndBusiness(user.uid, user.email);
  const { passwordHash: _, ...userWithoutPassword } = user;
  return { user: userWithoutPassword, business };
}
async function getUserById(userId) {
  const user = await db.select().from(users).where((0, import_drizzle_orm2.eq)(users.id, userId)).limit(1).then((res) => res[0]);
  if (!user) return null;
  const { passwordHash: _, ...userWithoutPassword } = user;
  const membership = await db.select().from(organizationMembers).where((0, import_drizzle_orm2.eq)(organizationMembers.userId, user.id)).limit(1).then((res) => res[0]);
  let business = null;
  if (membership) {
    business = await db.select().from(businesses).where((0, import_drizzle_orm2.eq)(businesses.organizationId, membership.organizationId)).limit(1).then((res) => res[0]);
  }
  return { user: userWithoutPassword, business };
}
async function getOrCreateUserAndBusiness(uid, email) {
  return await db.transaction(async (tx) => {
    let user = await tx.select().from(users).where((0, import_drizzle_orm2.eq)(users.uid, uid)).limit(1).then((res) => res[0]);
    if (!user) {
      user = await tx.insert(users).values({ uid, email }).returning().then((res) => res[0]);
    } else if (user.email !== email) {
      user = await tx.update(users).set({ email }).where((0, import_drizzle_orm2.eq)(users.id, user.id)).returning().then((res) => res[0]);
    }
    const membership = await tx.select().from(organizationMembers).where((0, import_drizzle_orm2.eq)(organizationMembers.userId, user.id)).limit(1).then((res) => res[0]);
    let orgId;
    if (!membership) {
      const orgName = `Empresa de ${email.split("@")[0]}`;
      const org = await tx.insert(organizations).values({ name: orgName }).returning().then((res) => res[0]);
      orgId = org.id;
      await tx.insert(organizationMembers).values({
        userId: user.id,
        organizationId: org.id,
        role: "owner"
      });
    } else {
      orgId = membership.organizationId;
    }
    let business = await tx.select().from(businesses).where((0, import_drizzle_orm2.eq)(businesses.organizationId, orgId)).limit(1).then((res) => res[0]);
    if (!business) {
      business = await tx.insert(businesses).values({
        organizationId: orgId,
        name: `Neg\xF3cio Principal`
      }).returning().then((res) => res[0]);
    }
    const { passwordHash: _, ...userWithoutPassword } = user;
    return { user: userWithoutPassword, business };
  });
}

// src/server/routes/onboarding.ts
var import_express = require("express");
var import_drizzle_orm4 = require("drizzle-orm");

// src/server/services/AIService.ts
var import_genai = require("@google/genai");
var import_drizzle_orm3 = require("drizzle-orm");
var AIService = class {
  constructor() {
    this.ai = null;
  }
  getAI() {
    if (!this.ai) {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error("GEMINI_API_KEY n\xE3o configurado.");
      this.ai = new import_genai.GoogleGenAI({
        apiKey,
        httpOptions: { headers: { "User-Agent": "aistudio-build" } }
      });
    }
    return this.ai;
  }
  async generateInitialStrategy(businessId, orgId) {
    try {
      const business = await db.select().from(businesses).where((0, import_drizzle_orm3.eq)(businesses.id, businessId)).then((r) => r[0]);
      const businessProducts = await db.select().from(products).where((0, import_drizzle_orm3.eq)(products.businessId, businessId));
      const audiences = await db.select().from(targetAudiences).where((0, import_drizzle_orm3.eq)(targetAudiences.businessId, businessId));
      const mktProfiles = await db.select().from(marketingProfiles).where((0, import_drizzle_orm3.eq)(marketingProfiles.businessId, businessId));
      const businessGoals = await db.select().from(goals).where((0, import_drizzle_orm3.eq)(goals.businessId, businessId));
      const audience = audiences[0] || {};
      const mktProfile = mktProfiles[0] || {};
      const goal = businessGoals[0] || {};
      const context = `
Empresa: ${business.name}
Segmento: ${business.segment}
Descri\xE7\xE3o: ${business.description}
\xC1rea de Atua\xE7\xE3o: ${business.serviceArea} (${business.serviceType})

Produtos/Servi\xE7os:
${businessProducts.map((p) => `- ${p.name} (${p.type}): ${p.description}. Benef\xEDcio: ${p.mainBenefit}. Diferenciais: ${p.differentiators}. Ticket: ${p.ticketValue}`).join("\n")}

P\xFAblico-alvo:
Perfil: ${audience.profile}
Idade: ${audience.ageRange}
Localiza\xE7\xE3o: ${audience.location}
Dores: ${JSON.stringify(audience.pains)}
Desejos: ${JSON.stringify(audience.desires)}
Obje\xE7\xF5es: ${JSON.stringify(audience.objections)}

Marketing Atual:
Canais: ${JSON.stringify(mktProfile.channels)}
Frequ\xEAncia: ${mktProfile.postFrequency}
Investimento: ${mktProfile.monthlyInvestment}
Dificuldade principal: ${mktProfile.mainDifficulty}

Objetivo Atual:
Tipo: ${goal.goalType}
M\xE9trica: ${goal.targetMetric}
Prazo: ${goal.timeframe}
`;
      const schema = {
        type: import_genai.Type.OBJECT,
        properties: {
          business_summary: { type: import_genai.Type.STRING, description: "Resumo executivo do neg\xF3cio e seu momento atual." },
          ideal_customer: {
            type: import_genai.Type.OBJECT,
            properties: {
              description: { type: import_genai.Type.STRING },
              main_pains: { type: import_genai.Type.ARRAY, items: { type: import_genai.Type.STRING } },
              main_desires: { type: import_genai.Type.ARRAY, items: { type: import_genai.Type.STRING } },
              main_objections: { type: import_genai.Type.ARRAY, items: { type: import_genai.Type.STRING } }
            }
          },
          positioning: {
            type: import_genai.Type.OBJECT,
            properties: {
              statement: { type: import_genai.Type.STRING, description: "Frase principal de posicionamento da marca." },
              value_proposition: { type: import_genai.Type.STRING, description: "Proposta de valor \xFAnica." },
              differentiators: { type: import_genai.Type.ARRAY, items: { type: import_genai.Type.STRING } }
            }
          },
          priority_channels: {
            type: import_genai.Type.ARRAY,
            items: {
              type: import_genai.Type.OBJECT,
              properties: {
                channel: { type: import_genai.Type.STRING },
                priority: { type: import_genai.Type.INTEGER, description: "Ordem de prioridade, 1 sendo o mais importante." },
                reason: { type: import_genai.Type.STRING, description: "Por que este canal \xE9 prioridade." }
              }
            }
          },
          opportunities: {
            type: import_genai.Type.ARRAY,
            items: {
              type: import_genai.Type.OBJECT,
              properties: {
                title: { type: import_genai.Type.STRING },
                description: { type: import_genai.Type.STRING },
                impact: { type: import_genai.Type.STRING, description: "high, medium ou low" }
              }
            }
          },
          plan_30_days: {
            type: import_genai.Type.ARRAY,
            items: {
              type: import_genai.Type.OBJECT,
              properties: {
                week: { type: import_genai.Type.INTEGER, description: "N\xFAmero da semana (1 a 4)" },
                objective: { type: import_genai.Type.STRING, description: "Objetivo central da semana" },
                actions: { type: import_genai.Type.ARRAY, items: { type: import_genai.Type.STRING }, description: "Checklist de 3 a 5 a\xE7\xF5es pr\xE1ticas para a semana" }
              }
            }
          }
        },
        required: ["business_summary", "ideal_customer", "positioning", "priority_channels", "opportunities", "plan_30_days"]
      };
      const prompt = `Voc\xEA \xE9 um Gerente de Marketing S\xEAnior e Especialista em Estrat\xE9gia de Neg\xF3cios.
Analise a empresa fornecida e crie uma estrat\xE9gia de marketing estruturada e acion\xE1vel.
Se houver informa\xE7\xF5es insuficientes em alguma categoria, fa\xE7a infer\xEAncias razo\xE1veis para completar a estrat\xE9gia, utilizando termos como "Uma poss\xEDvel hip\xF3tese..." quando n\xE3o tiver certeza absoluta.

Informa\xE7\xF5es da Empresa:
${context}`;
      const response = await this.getAI().models.generateContent({
        model: "gemini-3.6-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: schema,
          temperature: 0.7
        }
      });
      const textOutput = response.text;
      if (!textOutput) throw new Error("No output from AI");
      const parsed = JSON.parse(textOutput);
      await db.insert(aiGenerations).values({
        organizationId: orgId,
        businessId,
        type: "initial_strategy",
        provider: "gemini",
        model: "gemini-3.6-flash",
        output: parsed
      });
      return await db.transaction(async (tx) => {
        const strat = await tx.insert(strategies).values({
          businessId,
          businessSummary: parsed.business_summary,
          idealCustomerDesc: parsed.ideal_customer.description,
          idealCustomerPains: parsed.ideal_customer.main_pains,
          idealCustomerDesires: parsed.ideal_customer.main_desires,
          idealCustomerObjections: parsed.ideal_customer.main_objections,
          positioningStatement: parsed.positioning.statement,
          valueProposition: parsed.positioning.value_proposition,
          differentiators: parsed.positioning.differentiators
        }).returning().then((r) => r[0]);
        for (const ch of parsed.priority_channels) {
          await tx.insert(strategyChannels).values({
            strategyId: strat.id,
            channel: ch.channel,
            priority: ch.priority,
            reason: ch.reason
          });
        }
        for (const week of parsed.plan_30_days) {
          await tx.insert(strategyPlanWeeks).values({
            strategyId: strat.id,
            week: week.week,
            objective: week.objective,
            actions: week.actions
          });
        }
        for (const opp of parsed.opportunities) {
          await tx.insert(opportunities).values({
            businessId,
            title: opp.title,
            description: opp.description,
            impact: opp.impact,
            effort: "medium"
            // default
          });
        }
        return strat;
      });
    } catch (error) {
      console.error("AI Strategy Generation Error:", error);
      throw error;
    }
  }
  async generateContentCalendar(businessId, orgId, params, strategyDetails) {
    const schema = {
      type: import_genai.Type.OBJECT,
      properties: {
        content_items: {
          type: import_genai.Type.ARRAY,
          items: {
            type: import_genai.Type.OBJECT,
            properties: {
              scheduled_date: { type: import_genai.Type.STRING, description: "YYYY-MM-DD" },
              title: { type: import_genai.Type.STRING },
              topic: { type: import_genai.Type.STRING },
              channel: { type: import_genai.Type.STRING },
              format: { type: import_genai.Type.STRING },
              funnel_stage: { type: import_genai.Type.STRING, description: "awareness, consideration, conversion, or retention" },
              objective: { type: import_genai.Type.STRING },
              brief: { type: import_genai.Type.STRING }
            }
          }
        }
      },
      required: ["content_items"]
    };
    const prompt = `Voc\xEA \xE9 um Estrategista de Conte\xFAdo S\xEAnior.
Crie um calend\xE1rio editorial para a empresa com base na estrat\xE9gia atual.

Configura\xE7\xF5es do Calend\xE1rio:
- Per\xEDodo: ${params.periodDays} dias (come\xE7ando a partir de hoje: ${(/* @__PURE__ */ new Date()).toISOString().split("T")[0]})
- Frequ\xEAncia: ${params.frequencyDesc}
- Canais Permitidos: ${params.channels.join(", ")}
- Objetivo Principal: ${params.objective}

Contexto da Empresa e Estrat\xE9gia:
${JSON.stringify(strategyDetails, null, 2)}

Regras de Distribui\xE7\xE3o:
- Mantenha um equil\xEDbrio entre educa\xE7\xE3o/autoridade (40%), dores/desejos (25%), convers\xE3o (20%), e prova social/relacionamento (15%).
- Varie os formatos adequados para os canais selecionados.
- Utilize exclusivamente as dores, produtos e posicionamento fornecidos. N\xE3o invente benef\xEDcios, pre\xE7os ou promessas que n\xE3o estejam no contexto.
- Retorne apenas conte\xFAdos com funnel_stage v\xE1lidos: "awareness", "consideration", "conversion", "retention".
- As datas (scheduled_date) devem estar dentro do per\xEDodo especificado a partir de hoje.`;
    const response = await this.getAI().models.generateContent({
      model: "gemini-3.6-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: schema,
        temperature: 0.7
      }
    });
    const textOutput = response.text;
    if (!textOutput) throw new Error("No output from AI");
    const parsed = JSON.parse(textOutput);
    await db.insert(aiGenerations).values({
      organizationId: orgId,
      businessId,
      type: "content_calendar",
      provider: "gemini",
      model: "gemini-3.6-flash",
      output: parsed
    });
    return parsed.content_items;
  }
  async generateContentItem(orgId, businessId, itemData, strategyDetails) {
    const schema = {
      type: import_genai.Type.OBJECT,
      properties: {
        title: { type: import_genai.Type.STRING },
        hook: { type: import_genai.Type.STRING, description: "Gancho (headline inicial) para reter aten\xE7\xE3o" },
        body: { type: import_genai.Type.STRING, description: "Conte\xFAdo principal/corpo do post" },
        caption: { type: import_genai.Type.STRING, description: "Legenda para o canal social (se aplic\xE1vel)" },
        cta: { type: import_genai.Type.STRING, description: "Chamada para a\xE7\xE3o" },
        hashtags: { type: import_genai.Type.ARRAY, items: { type: import_genai.Type.STRING } },
        visual_direction: { type: import_genai.Type.STRING, description: "Instru\xE7\xF5es ou ideia visual para a arte" },
        video_script: { type: import_genai.Type.STRING, description: "Se for v\xEDdeo/reels, escreva a estrutura (Hook, Cenas, CTA). Se n\xE3o, deixe vazio." }
      },
      required: ["title", "hook", "body", "caption", "cta", "hashtags", "visual_direction"]
    };
    const prompt = `Voc\xEA \xE9 um Copywriter S\xEAnior.
Escreva um conte\xFAdo de alta qualidade baseado no briefing a seguir.
Utilize o contexto da empresa para garantir coer\xEAncia. NUNCA invente pre\xE7os, descontos, selos de garantia ou informa\xE7\xF5es falsas.

Item de Conte\xFAdo:
- T\xEDtulo/Tema: ${itemData.title || itemData.topic || ""}
- Canal: ${itemData.channel || ""}
- Formato: ${itemData.format || ""}
- Etapa do Funil: ${itemData.funnelStage || ""}
- Objetivo: ${itemData.objective || ""}
- Briefing: ${itemData.topic || ""}

Contexto Estrat\xE9gico da Empresa:
${JSON.stringify(strategyDetails, null, 2)}`;
    const response = await this.getAI().models.generateContent({
      model: "gemini-3.6-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: schema,
        temperature: 0.7
      }
    });
    const textOutput = response.text;
    if (!textOutput) throw new Error("No output from AI");
    const parsed = JSON.parse(textOutput);
    await db.insert(aiGenerations).values({
      organizationId: orgId,
      businessId,
      type: "content",
      provider: "gemini",
      model: "gemini-3.6-flash",
      output: parsed
    });
    return parsed;
  }
  async refineContentText(orgId, businessId, currentText, instruction) {
    const schema = {
      type: import_genai.Type.OBJECT,
      properties: {
        refined_text: { type: import_genai.Type.STRING }
      },
      required: ["refined_text"]
    };
    const prompt = `Voc\xEA \xE9 um Copywriter S\xEAnior. Voc\xEA precisa alterar o texto abaixo de acordo com a seguinte instru\xE7\xE3o: "${instruction}"

Texto original:
"""
${currentText}
"""

Retorne APENAS o texto modificado, mantendo a coer\xEAncia.`;
    const response = await this.getAI().models.generateContent({
      model: "gemini-3.6-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: schema,
        temperature: 0.7
      }
    });
    const textOutput = response.text;
    if (!textOutput) throw new Error("No output from AI");
    const parsed = JSON.parse(textOutput);
    await db.insert(aiGenerations).values({
      organizationId: orgId,
      businessId,
      type: "content_improvement",
      provider: "gemini",
      model: "gemini-3.6-flash",
      output: parsed
    });
    return parsed.refined_text;
  }
  async generateCampaign(businessId, orgId, setupData, contextData) {
    const schema = {
      type: import_genai.Type.OBJECT,
      properties: {
        campaign_name: { type: import_genai.Type.STRING },
        campaign_summary: { type: import_genai.Type.STRING },
        objective: { type: import_genai.Type.STRING },
        target_audience: {
          type: import_genai.Type.OBJECT,
          properties: {
            description: { type: import_genai.Type.STRING },
            main_pain: { type: import_genai.Type.STRING },
            main_desire: { type: import_genai.Type.STRING },
            main_objection: { type: import_genai.Type.STRING }
          }
        },
        offer: {
          type: import_genai.Type.OBJECT,
          properties: {
            description: { type: import_genai.Type.STRING },
            value_proposition: { type: import_genai.Type.STRING },
            urgency: { type: import_genai.Type.STRING }
          }
        },
        main_argument: { type: import_genai.Type.STRING },
        messaging: {
          type: import_genai.Type.OBJECT,
          properties: {
            main_message: { type: import_genai.Type.STRING },
            supporting_arguments: { type: import_genai.Type.ARRAY, items: { type: import_genai.Type.STRING } }
          }
        },
        channels: { type: import_genai.Type.ARRAY, items: { type: import_genai.Type.STRING } },
        plan_actions: { type: import_genai.Type.ARRAY, items: { type: import_genai.Type.STRING } }
      },
      required: ["campaign_name", "campaign_summary", "objective", "target_audience", "offer", "main_argument", "messaging", "channels", "plan_actions"]
    };
    const prompt = `Voc\xEA \xE9 um Estrategista de Campanhas S\xEAnior.
Crie uma campanha de marketing acion\xE1vel baseada nos dados fornecidos.

Dados de Configura\xE7\xE3o:
- Objetivo: ${setupData.objective}
- Instru\xE7\xF5es Adicionais: ${setupData.instructions || "Nenhuma"}
- Canais Solicitados: ${setupData.channels.join(", ")}

Contexto do Neg\xF3cio e Estrat\xE9gia:
${JSON.stringify(contextData, null, 2)}

Regras de Ouro:
1. NUNCA invente pre\xE7os, promo\xE7\xF5es ou descontos que n\xE3o estejam no contexto. Se n\xE3o houver, crie a oferta focando na proposta de valor, n\xE3o em promo\xE7\xF5es financeiras.
2. A campanha deve ser execut\xE1vel, clara e objetiva.
3. Se um produto espec\xEDfico n\xE3o foi selecionado, crie uma campanha institucional focada na marca.`;
    const response = await this.getAI().models.generateContent({
      model: "gemini-3.6-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: schema,
        temperature: 0.7
      }
    });
    const textOutput = response.text;
    if (!textOutput) throw new Error("No output from AI");
    const parsed = JSON.parse(textOutput);
    await db.insert(aiGenerations).values({
      organizationId: orgId,
      businessId,
      type: "campaign_generation",
      provider: "gemini",
      model: "gemini-3.6-flash",
      output: parsed
    });
    return parsed;
  }
  async generateCampaignAsset(orgId, businessId, assetType, campaignData, contextData) {
    let schema;
    if (assetType === "landing_page") {
      schema = {
        type: import_genai.Type.OBJECT,
        properties: {
          headline: { type: import_genai.Type.STRING },
          subheadline: { type: import_genai.Type.STRING },
          problem: { type: import_genai.Type.STRING },
          solution: { type: import_genai.Type.STRING },
          benefits: { type: import_genai.Type.ARRAY, items: { type: import_genai.Type.STRING } },
          differentiators: { type: import_genai.Type.ARRAY, items: { type: import_genai.Type.STRING } },
          cta: { type: import_genai.Type.STRING },
          faq: { type: import_genai.Type.ARRAY, items: { type: import_genai.Type.OBJECT, properties: { q: { type: import_genai.Type.STRING }, a: { type: import_genai.Type.STRING } } } }
        },
        required: ["headline", "subheadline", "problem", "solution", "benefits", "cta"]
      };
    } else if (assetType === "email") {
      schema = {
        type: import_genai.Type.OBJECT,
        properties: {
          subject: { type: import_genai.Type.STRING },
          preheader: { type: import_genai.Type.STRING },
          body: { type: import_genai.Type.STRING },
          cta: { type: import_genai.Type.STRING }
        },
        required: ["subject", "preheader", "body", "cta"]
      };
    } else if (assetType === "whatsapp") {
      schema = {
        type: import_genai.Type.OBJECT,
        properties: {
          initial_message: { type: import_genai.Type.STRING },
          followup_1: { type: import_genai.Type.STRING },
          followup_2: { type: import_genai.Type.STRING },
          final_message: { type: import_genai.Type.STRING }
        },
        required: ["initial_message", "followup_1", "followup_2", "final_message"]
      };
    } else if (assetType === "creative_brief") {
      schema = {
        type: import_genai.Type.OBJECT,
        properties: {
          visual_orientation: { type: import_genai.Type.STRING },
          main_text_on_image: { type: import_genai.Type.STRING },
          format_suggestion: { type: import_genai.Type.STRING },
          cta: { type: import_genai.Type.STRING }
        },
        required: ["visual_orientation", "main_text_on_image", "format_suggestion", "cta"]
      };
    } else {
      schema = {
        type: import_genai.Type.OBJECT,
        properties: {
          versions: {
            type: import_genai.Type.ARRAY,
            items: {
              type: import_genai.Type.OBJECT,
              properties: {
                angle: { type: import_genai.Type.STRING, description: "Dor, Benef\xEDcio, Oportunidade, ou Autoridade" },
                headline: { type: import_genai.Type.STRING },
                body: { type: import_genai.Type.STRING },
                cta: { type: import_genai.Type.STRING }
              }
            }
          }
        },
        required: ["versions"]
      };
    }
    const prompt = `Voc\xEA \xE9 um Copywriter de Resposta Direta S\xEAnior.
Crie o conte\xFAdo do tipo "${assetType}" para a campanha descrita abaixo.
Utilize o argumento principal e a oferta de forma persuasiva e coerente com a marca. Nunca invente pre\xE7os, promo\xE7\xF5es financeiras, selos ou promessas que n\xE3o estejam definidos na estrat\xE9gia.

Dados da Campanha:
${JSON.stringify(campaignData, null, 2)}

Contexto Adicional (P\xFAblico/Empresa):
${JSON.stringify(contextData, null, 2)}
`;
    const response = await this.getAI().models.generateContent({
      model: "gemini-3.6-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: schema,
        temperature: 0.7
      }
    });
    const textOutput = response.text;
    if (!textOutput) throw new Error("No output from AI");
    const parsed = JSON.parse(textOutput);
    await db.insert(aiGenerations).values({
      organizationId: orgId,
      businessId,
      type: "campaign_asset",
      provider: "gemini",
      model: "gemini-3.6-flash",
      output: { assetType, result: parsed }
    });
    return parsed;
  }
};
var aiService = new AIService();

// src/server/routes/onboarding.ts
var onboardingRouter = (0, import_express.Router)();
onboardingRouter.post("/complete", requireAuth, async (req, res) => {
  try {
    const { businessId, company, productsList, audience, marketing, objective } = req.body;
    const business = await db.select().from(businesses).where((0, import_drizzle_orm4.eq)(businesses.id, businessId)).then((r) => r[0]);
    if (!business) {
      return res.status(404).json({ error: "Neg\xF3cio n\xE3o encontrado." });
    }
    const user = await db.select().from(users).where((0, import_drizzle_orm4.eq)(users.uid, req.user.uid)).then((r) => r[0]);
    if (!user) {
      return res.status(401).json({ error: "Usu\xE1rio n\xE3o encontrado." });
    }
    const membership = await db.select().from(organizationMembers).where((0, import_drizzle_orm4.eq)(organizationMembers.userId, user.id)).then((r) => r[0]);
    if (!membership || membership.organizationId !== business.organizationId) {
      return res.status(403).json({ error: "Acesso negado." });
    }
    const orgId = business.organizationId;
    await db.transaction(async (tx) => {
      await tx.update(businesses).set({
        segment: company.segment,
        description: company.description,
        city: company.city,
        state: company.state,
        website: company.website,
        instagram: company.instagram,
        whatsapp: company.whatsapp,
        serviceArea: company.serviceArea,
        serviceType: company.serviceType
      }).where((0, import_drizzle_orm4.eq)(businesses.id, businessId));
      for (const p of productsList) {
        await tx.insert(products).values({
          businessId,
          name: p.name,
          type: p.type,
          description: p.description,
          price: p.price,
          ticketValue: p.ticketValue,
          mainBenefit: p.mainBenefit,
          differentiators: p.differentiators,
          idealCustomer: p.idealCustomer
        });
      }
      await tx.insert(targetAudiences).values({
        businessId,
        description: audience.description,
        ageRange: audience.ageRange,
        location: audience.location,
        profile: audience.profile,
        pains: audience.pains || [],
        desires: audience.desires || [],
        objections: audience.objections || [],
        decisionFactors: audience.decisionFactors
      });
      await tx.insert(marketingProfiles).values({
        businessId,
        channels: marketing.channels || [],
        postFrequency: marketing.postFrequency,
        monthlyInvestment: marketing.monthlyInvestment,
        monthlyLeads: marketing.monthlyLeads,
        monthlySales: marketing.monthlySales,
        mainDifficulty: marketing.mainDifficulty
      });
      await tx.insert(goals).values({
        businessId,
        goalType: objective.goalType,
        targetMetric: objective.targetMetric,
        timeframe: objective.timeframe
      });
    });
    await aiService.generateInitialStrategy(businessId, orgId);
    await db.update(businesses).set({
      onboardingCompleted: true,
      onboardingCompletedAt: /* @__PURE__ */ new Date()
    }).where((0, import_drizzle_orm4.eq)(businesses.id, businessId));
    res.json({ success: true });
  } catch (error) {
    console.error("Onboarding Error:", error);
    res.status(500).json({ error: error.message || "Erro interno" });
  }
});

// src/server/routes/strategy.ts
var import_express2 = require("express");
var import_drizzle_orm5 = require("drizzle-orm");
var strategyRouter = (0, import_express2.Router)();
strategyRouter.get("/current", requireAuth, async (req, res) => {
  try {
    const businessId = req.query.businessId;
    const activeStrategy = await db.select().from(strategies).where((0, import_drizzle_orm5.eq)(strategies.businessId, businessId)).orderBy((0, import_drizzle_orm5.desc)(strategies.createdAt)).limit(1).then((r) => r[0]);
    if (!activeStrategy) {
      return res.json({ strategy: null });
    }
    const channels = await db.select().from(strategyChannels).where((0, import_drizzle_orm5.eq)(strategyChannels.strategyId, activeStrategy.id));
    const planWeeks = await db.select().from(strategyPlanWeeks).where((0, import_drizzle_orm5.eq)(strategyPlanWeeks.strategyId, activeStrategy.id)).orderBy(strategyPlanWeeks.week);
    const opps = await db.select().from(opportunities).where((0, import_drizzle_orm5.eq)(opportunities.businessId, businessId));
    const activeGoals = await db.select().from(goals).where((0, import_drizzle_orm5.eq)(goals.businessId, businessId)).orderBy((0, import_drizzle_orm5.desc)(goals.createdAt)).limit(1);
    res.json({
      strategy: activeStrategy,
      channels,
      planWeeks,
      opportunities: opps,
      goal: activeGoals[0] || null
    });
  } catch (error) {
    console.error("Fetch Strategy Error:", error);
    res.status(500).json({ error: error.message || "Erro interno" });
  }
});
strategyRouter.post("/regenerate", requireAuth, async (req, res) => {
  try {
    const { businessId, orgId } = req.body;
    await db.update(strategies).set({ isActive: false }).where((0, import_drizzle_orm5.eq)(strategies.businessId, businessId));
    await aiService.generateInitialStrategy(businessId, orgId);
    res.json({ success: true });
  } catch (error) {
    console.error("Regenerate Strategy Error:", error);
    res.status(500).json({ error: error.message || "Erro interno" });
  }
});

// src/server/routes/content.ts
var import_express3 = require("express");
var import_drizzle_orm6 = require("drizzle-orm");
var contentRouter = (0, import_express3.Router)();
async function verifyBusinessAccess(req, businessId) {
  const business = await db.select().from(businesses).where((0, import_drizzle_orm6.eq)(businesses.id, businessId)).then((r) => r[0]);
  if (!business) throw new Error("Business not found");
  return business;
}
async function getStrategyDetails(businessId) {
  const strat = await db.select().from(strategies).where((0, import_drizzle_orm6.and)((0, import_drizzle_orm6.eq)(strategies.businessId, businessId), (0, import_drizzle_orm6.eq)(strategies.isActive, true))).orderBy((0, import_drizzle_orm6.desc)(strategies.createdAt)).limit(1).then((r) => r[0]);
  const prods = await db.select().from(products).where((0, import_drizzle_orm6.eq)(products.businessId, businessId));
  const audiences = await db.select().from(targetAudiences).where((0, import_drizzle_orm6.eq)(targetAudiences.businessId, businessId));
  return {
    strategy: strat || {},
    products: prods || [],
    audience: audiences[0] || {}
  };
}
contentRouter.get("/", requireAuth, async (req, res) => {
  try {
    const businessId = req.query.businessId;
    if (!businessId) return res.status(400).json({ error: "Missing businessId" });
    await verifyBusinessAccess(req, businessId);
    const items = await db.select().from(contentItems).where((0, import_drizzle_orm6.eq)(contentItems.businessId, businessId)).orderBy((0, import_drizzle_orm6.desc)(contentItems.scheduledDate));
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
contentRouter.get("/today", requireAuth, async (req, res) => {
  try {
    const businessId = req.query.businessId;
    if (!businessId) return res.status(400).json({ error: "Missing businessId" });
    await verifyBusinessAccess(req, businessId);
    const todayStr = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    const items = await db.select().from(contentItems).where((0, import_drizzle_orm6.and)(
      (0, import_drizzle_orm6.eq)(contentItems.businessId, businessId),
      (0, import_drizzle_orm6.eq)(contentItems.scheduledDate, todayStr)
    ));
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
contentRouter.get("/:id", requireAuth, async (req, res) => {
  try {
    const item = await db.select().from(contentItems).where((0, import_drizzle_orm6.eq)(contentItems.id, req.params.id)).then((r) => r[0]);
    if (!item) return res.status(404).json({ error: "Not found" });
    await verifyBusinessAccess(req, item.businessId);
    res.json(item);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
contentRouter.post("/", requireAuth, async (req, res) => {
  try {
    const { businessId, ...data } = req.body;
    const business = await verifyBusinessAccess(req, businessId);
    const strat = await db.select().from(strategies).where((0, import_drizzle_orm6.and)((0, import_drizzle_orm6.eq)(strategies.businessId, businessId), (0, import_drizzle_orm6.eq)(strategies.isActive, true))).orderBy((0, import_drizzle_orm6.desc)(strategies.createdAt)).limit(1).then((r) => r[0]);
    const item = await db.insert(contentItems).values({
      organizationId: business.organizationId,
      businessId,
      strategyId: strat?.id,
      title: data.title || "Novo Conte\xFAdo",
      topic: data.topic,
      channel: data.channel,
      format: data.format,
      funnelStage: data.funnelStage,
      objective: data.objective,
      scheduledDate: data.scheduledDate,
      status: data.status || "idea"
    }).returning().then((r) => r[0]);
    res.json(item);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
contentRouter.put("/:id", requireAuth, async (req, res) => {
  try {
    const item = await db.select().from(contentItems).where((0, import_drizzle_orm6.eq)(contentItems.id, req.params.id)).then((r) => r[0]);
    if (!item) return res.status(404).json({ error: "Not found" });
    await verifyBusinessAccess(req, item.businessId);
    const updateData = { ...req.body, updatedAt: /* @__PURE__ */ new Date() };
    if (updateData.status === "published" && item.status !== "published") {
      updateData.publishedAt = /* @__PURE__ */ new Date();
    }
    const updated = await db.update(contentItems).set(updateData).where((0, import_drizzle_orm6.eq)(contentItems.id, req.params.id)).returning().then((r) => r[0]);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
contentRouter.post("/generate-calendar", requireAuth, async (req, res) => {
  try {
    const { businessId, periodDays, frequencyDesc, channels, objective } = req.body;
    const business = await verifyBusinessAccess(req, businessId);
    const details = await getStrategyDetails(businessId);
    const itemsData = await aiService.generateContentCalendar(
      businessId,
      business.organizationId,
      { periodDays, frequencyDesc, channels, objective },
      details
    );
    const savedItems = [];
    for (const item of itemsData) {
      const saved = await db.insert(contentItems).values({
        organizationId: business.organizationId,
        businessId,
        strategyId: details.strategy?.id || null,
        title: item.title || item.topic || "Sem t\xEDtulo",
        topic: item.topic || item.brief,
        channel: item.channel,
        format: item.format,
        funnelStage: item.funnel_stage,
        objective: item.objective,
        scheduledDate: item.scheduled_date,
        status: "idea"
      }).returning().then((r) => r[0]);
      savedItems.push(saved);
    }
    res.json({ success: true, items: savedItems });
  } catch (error) {
    console.error("Generate Calendar Error:", error);
    res.status(500).json({ error: error.message });
  }
});
contentRouter.post("/:id/generate", requireAuth, async (req, res) => {
  try {
    const item = await db.select().from(contentItems).where((0, import_drizzle_orm6.eq)(contentItems.id, req.params.id)).then((r) => r[0]);
    if (!item) return res.status(404).json({ error: "Not found" });
    await verifyBusinessAccess(req, item.businessId);
    const details = await getStrategyDetails(item.businessId);
    const generated = await aiService.generateContentItem(
      item.organizationId,
      item.businessId,
      item,
      details
    );
    const updated = await db.update(contentItems).set({
      title: generated.title || item.title,
      hook: generated.hook,
      body: generated.body,
      caption: generated.caption,
      cta: generated.cta,
      hashtags: generated.hashtags || [],
      visualDirection: generated.visual_direction,
      videoScript: generated.video_script,
      status: "draft",
      updatedAt: /* @__PURE__ */ new Date()
    }).where((0, import_drizzle_orm6.eq)(contentItems.id, item.id)).returning().then((r) => r[0]);
    res.json(updated);
  } catch (error) {
    console.error("Generate Content Error:", error);
    res.status(500).json({ error: error.message });
  }
});
contentRouter.post("/:id/refine", requireAuth, async (req, res) => {
  try {
    const item = await db.select().from(contentItems).where((0, import_drizzle_orm6.eq)(contentItems.id, req.params.id)).then((r) => r[0]);
    if (!item) return res.status(404).json({ error: "Not found" });
    await verifyBusinessAccess(req, item.businessId);
    const { field, currentText, instruction } = req.body;
    if (!field || !currentText || !instruction) return res.status(400).json({ error: "Missing parameters" });
    const refinedText = await aiService.refineContentText(item.organizationId, item.businessId, currentText, instruction);
    res.json({ refinedText });
  } catch (error) {
    console.error("Refine Content Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// src/server/routes/campaigns.ts
var import_express4 = require("express");
var import_drizzle_orm7 = require("drizzle-orm");
var campaignRouter = (0, import_express4.Router)();
var ensureBusinessOwnership = async (req, res, next) => {
  const { businessId } = req.query;
  const user = req.user;
  if (!businessId) return res.status(400).json({ error: "Missing businessId" });
  const dbUser = await db.query.users.findFirst({
    where: (0, import_drizzle_orm7.eq)(users.uid, user.uid)
  });
  if (!dbUser) return res.status(401).json({ error: "User not found in DB" });
  const business = await db.query.businesses.findFirst({
    where: (0, import_drizzle_orm7.eq)(businesses.id, businessId),
    with: { organization: { with: { members: true } } }
  });
  if (!business) return res.status(404).json({ error: "Business not found" });
  const isMember = business.organization.members.some((m) => m.userId === dbUser.id);
  if (!isMember) return res.status(403).json({ error: "Unauthorized access to business" });
  req.business = business;
  next();
};
campaignRouter.get("/", requireAuth, ensureBusinessOwnership, async (req, res) => {
  const { businessId } = req.query;
  try {
    const list = await db.query.campaigns.findMany({
      where: (0, import_drizzle_orm7.eq)(campaigns.businessId, businessId),
      orderBy: (c, { desc: desc7 }) => [desc7(c.createdAt)],
      with: {
        channels: true
      }
    });
    res.json(list);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
campaignRouter.get("/:id", requireAuth, ensureBusinessOwnership, async (req, res) => {
  const { id } = req.params;
  const { businessId } = req.query;
  try {
    const campaign = await db.query.campaigns.findFirst({
      where: (0, import_drizzle_orm7.and)((0, import_drizzle_orm7.eq)(campaigns.id, id), (0, import_drizzle_orm7.eq)(campaigns.businessId, businessId)),
      with: {
        channels: true,
        assets: true,
        tasks: true,
        product: true
      }
    });
    if (!campaign) return res.status(404).json({ error: "Campaign not found" });
    res.json(campaign);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
campaignRouter.put("/:id", requireAuth, ensureBusinessOwnership, async (req, res) => {
  const { id } = req.params;
  const { businessId } = req.query;
  const data = req.body;
  try {
    const updated = await db.update(campaigns).set({
      ...data,
      updatedAt: /* @__PURE__ */ new Date()
    }).where((0, import_drizzle_orm7.and)((0, import_drizzle_orm7.eq)(campaigns.id, id), (0, import_drizzle_orm7.eq)(campaigns.businessId, businessId))).returning();
    res.json(updated[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
campaignRouter.post("/generate", requireAuth, ensureBusinessOwnership, async (req, res) => {
  const { businessId } = req.query;
  const orgId = req.business.organizationId;
  const setupData = req.body;
  try {
    const business = await db.query.businesses.findFirst({
      where: (0, import_drizzle_orm7.eq)(businesses.id, businessId),
      with: {
        products: true,
        targetAudiences: true,
        strategies: {
          where: (0, import_drizzle_orm7.eq)(strategies.isActive, true)
        }
      }
    });
    const activeStrategy = business?.strategies?.[0] || null;
    let selectedProduct = null;
    if (setupData.productId) {
      selectedProduct = business?.products.find((p) => p.id === setupData.productId);
    }
    const contextData = {
      businessInfo: business,
      product: selectedProduct,
      audience: setupData.customAudience || business?.targetAudiences?.[0],
      strategy: activeStrategy
    };
    const result = await aiService.generateCampaign(businessId, orgId, setupData, contextData);
    const newCampaign = await db.transaction(async (tx) => {
      const camp = await tx.insert(campaigns).values({
        organizationId: orgId,
        businessId,
        strategyId: activeStrategy?.id,
        productId: setupData.productId || null,
        name: result.campaign_name || setupData.name || "Nova Campanha",
        objective: setupData.objective,
        description: result.campaign_summary,
        targetAudience: result.target_audience,
        offer: result.offer,
        mainArgument: result.main_argument,
        messaging: result.messaging,
        budget: setupData.budget,
        startDate: setupData.startDate,
        endDate: setupData.endDate,
        status: "draft"
      }).returning().then((r) => r[0]);
      if (setupData.channels && Array.isArray(setupData.channels)) {
        for (const ch of setupData.channels) {
          await tx.insert(campaignChannels).values({
            campaignId: camp.id,
            channel: ch
          });
        }
      }
      if (result.plan_actions && Array.isArray(result.plan_actions)) {
        for (const action of result.plan_actions) {
          await tx.insert(campaignTasks).values({
            campaignId: camp.id,
            title: action,
            status: "todo"
          });
        }
      }
      return camp;
    });
    res.json(newCampaign);
  } catch (error) {
    console.error("Generate Campaign Error:", error);
    res.status(500).json({ error: error.message });
  }
});
campaignRouter.post("/:id/assets/generate", requireAuth, ensureBusinessOwnership, async (req, res) => {
  const { id } = req.params;
  const { businessId } = req.query;
  const orgId = req.business.organizationId;
  const { assetType } = req.body;
  try {
    const campaign = await db.query.campaigns.findFirst({
      where: (0, import_drizzle_orm7.and)((0, import_drizzle_orm7.eq)(campaigns.id, id), (0, import_drizzle_orm7.eq)(campaigns.businessId, businessId)),
      with: { product: true }
    });
    if (!campaign) return res.status(404).json({ error: "Campaign not found" });
    const business = await db.query.businesses.findFirst({
      where: (0, import_drizzle_orm7.eq)(businesses.id, businessId),
      with: { targetAudiences: true }
    });
    const contextData = {
      product: campaign.product,
      audience: campaign.targetAudience || business?.targetAudiences?.[0]
    };
    const assetContent = await aiService.generateCampaignAsset(orgId, businessId, assetType, campaign, contextData);
    let title = "Novo Material";
    if (assetType === "landing_page") title = "Landing Page";
    else if (assetType === "email") title = "E-mail Marketing";
    else if (assetType === "whatsapp") title = "Sequ\xEAncia de WhatsApp";
    else if (assetType === "creative_brief") title = "Briefing de Criativo";
    else if (assetType === "ad") title = "Varia\xE7\xF5es de An\xFAncio";
    else if (assetType === "social_post") title = "Varia\xE7\xF5es de Post";
    const newAsset = await db.insert(campaignAssets).values({
      campaignId: campaign.id,
      type: assetType,
      title,
      content: assetContent,
      status: "draft"
    }).returning().then((r) => r[0]);
    res.json(newAsset);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
campaignRouter.post("/:id/assets/:assetId/refine", requireAuth, ensureBusinessOwnership, async (req, res) => {
  const { id, assetId } = req.params;
  const { businessId } = req.query;
  const orgId = req.business.organizationId;
  const { currentText, instruction, fieldPath } = req.body;
  try {
    const refinedText = await aiService.refineContentText(orgId, businessId, currentText, instruction);
    res.json({ refined_text: refinedText, fieldPath });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
campaignRouter.put("/:id/assets/:assetId", requireAuth, ensureBusinessOwnership, async (req, res) => {
  const { id, assetId } = req.params;
  const data = req.body;
  try {
    const updated = await db.update(campaignAssets).set({ ...data, updatedAt: /* @__PURE__ */ new Date() }).where((0, import_drizzle_orm7.and)((0, import_drizzle_orm7.eq)(campaignAssets.id, assetId), (0, import_drizzle_orm7.eq)(campaignAssets.campaignId, id))).returning();
    res.json(updated[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
campaignRouter.post("/:id/assets/:assetId/to-content", requireAuth, ensureBusinessOwnership, async (req, res) => {
  const { id, assetId } = req.params;
  const { businessId } = req.query;
  const { date, channel, format } = req.body;
  const orgId = req.business.organizationId;
  try {
    const asset = await db.query.campaignAssets.findFirst({
      where: (0, import_drizzle_orm7.and)((0, import_drizzle_orm7.eq)(campaignAssets.id, assetId), (0, import_drizzle_orm7.eq)(campaignAssets.campaignId, id))
    });
    if (!asset) return res.status(404).json({ error: "Asset not found" });
    let bodyText = "";
    if (asset.type === "email" && asset.content) {
      bodyText = asset.content.body || "";
    } else if (asset.type === "whatsapp" && asset.content) {
      bodyText = asset.content.initial_message || "";
    } else {
      bodyText = JSON.stringify(asset.content, null, 2);
    }
    const newItem = await db.insert(contentItems).values({
      organizationId: orgId,
      businessId,
      campaignId: id,
      title: asset.title,
      topic: "Criado via Campanha",
      channel,
      format,
      scheduledDate: date,
      status: "draft",
      body: bodyText,
      generationContext: asset.content
    }).returning().then((r) => r[0]);
    res.json(newItem);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
campaignRouter.post("/:id/tasks", requireAuth, ensureBusinessOwnership, async (req, res) => {
  const { id } = req.params;
  const data = req.body;
  try {
    const task = await db.insert(campaignTasks).values({
      campaignId: id,
      title: data.title,
      description: data.description,
      dueDate: data.dueDate,
      status: data.status || "todo"
    }).returning().then((r) => r[0]);
    res.json(task);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
campaignRouter.put("/:id/tasks/:taskId", requireAuth, ensureBusinessOwnership, async (req, res) => {
  const { id, taskId } = req.params;
  const data = req.body;
  try {
    const task = await db.update(campaignTasks).set(data).where((0, import_drizzle_orm7.and)((0, import_drizzle_orm7.eq)(campaignTasks.id, taskId), (0, import_drizzle_orm7.eq)(campaignTasks.campaignId, id))).returning().then((r) => r[0]);
    res.json(task);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
campaignRouter.delete("/:id/tasks/:taskId", requireAuth, ensureBusinessOwnership, async (req, res) => {
  const { id, taskId } = req.params;
  try {
    await db.delete(campaignTasks).where((0, import_drizzle_orm7.and)((0, import_drizzle_orm7.eq)(campaignTasks.id, taskId), (0, import_drizzle_orm7.eq)(campaignTasks.campaignId, id)));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// src/server/routes/leads.ts
var import_express5 = require("express");
var import_drizzle_orm9 = require("drizzle-orm");

// src/server/services/RecommendationEngine.ts
var import_drizzle_orm8 = require("drizzle-orm");
var import_crypto = __toESM(require("crypto"), 1);
var import_genai2 = require("@google/genai");
var RecommendationEngine = class {
  /**
   * Calculates MD5 fingerprint for deduplication
   */
  static calculateFingerprint(businessId, type, sourceType, sourceId) {
    const raw = `${businessId}:${type}:${sourceType}:${sourceId || "aggregate"}`;
    return import_crypto.default.createHash("md5").update(raw).digest("hex");
  }
  /**
   * Deterministic Priority Score calculation (0 - 100)
   */
  static calculatePriorityScore(priority, financialValue = 0, isStrategic = false, daysStagnant = 0) {
    let urgencyScore = 10;
    if (priority === "critical") urgencyScore = 40;
    else if (priority === "high") urgencyScore = 30;
    else if (priority === "medium") urgencyScore = 20;
    let financialScore = 0;
    if (financialValue > 5e4) financialScore = 30;
    else if (financialValue > 1e4) financialScore = 20;
    else if (financialValue > 1e3) financialScore = 10;
    else if (financialValue > 0) financialScore = 5;
    const strategicScore = isStrategic ? 20 : 0;
    const ageScore = Math.min(10, Math.floor(daysStagnant * 2));
    const total = urgencyScore + financialScore + strategicScore + ageScore;
    return Math.min(100, Math.max(0, total));
  }
  /**
   * Evaluates all business modules and syncs database recommendations
   */
  static async evaluateBusiness(businessId) {
    const business = await db.query.businesses.findFirst({
      where: (0, import_drizzle_orm8.eq)(businesses.id, businessId)
    });
    if (!business) return [];
    const organizationId = business.organizationId;
    const now = /* @__PURE__ */ new Date();
    const nowTime = now.getTime();
    const todayStr = now.toISOString().split("T")[0];
    const allLeads = await db.select().from(leads).where((0, import_drizzle_orm8.eq)(leads.businessId, businessId));
    const allCampaigns = await db.select().from(campaigns).where((0, import_drizzle_orm8.eq)(campaigns.businessId, businessId));
    const allContent = await db.select().from(contentItems).where((0, import_drizzle_orm8.eq)(contentItems.businessId, businessId));
    const activeStrategy = await db.query.strategies.findFirst({
      where: (0, import_drizzle_orm8.and)((0, import_drizzle_orm8.eq)(strategies.businessId, businessId), (0, import_drizzle_orm8.eq)(strategies.isActive, true))
    });
    const businessGoals = await db.select().from(goals).where((0, import_drizzle_orm8.eq)(goals.businessId, businessId));
    const evaluatedList = [];
    let stagnantLeadsCount = 0;
    let totalStagnantValue = 0;
    let proposalLeadsCount = 0;
    let totalProposalValue = 0;
    for (const lead of allLeads) {
      if (lead.status === "customer" || lead.status === "lost") continue;
      const createdAtTime = lead.createdAt ? new Date(lead.createdAt).getTime() : nowTime;
      const lastContactTime = lead.lastContactAt ? new Date(lead.lastContactAt).getTime() : createdAtTime;
      const hoursSinceCreated = (nowTime - createdAtTime) / (1e3 * 60 * 60);
      const hoursSinceLastContact = (nowTime - lastContactTime) / (1e3 * 60 * 60);
      const daysSinceLastContact = Math.floor(hoursSinceLastContact / 24);
      const leadValue = lead.potentialValue || 0;
      if (hoursSinceLastContact > 48) {
        stagnantLeadsCount++;
        totalStagnantValue += leadValue;
      }
      if (lead.status === "proposal") {
        proposalLeadsCount++;
        totalProposalValue += leadValue;
      }
      if (lead.nextActionAt) {
        const nextActionTime = new Date(lead.nextActionAt).getTime();
        if (nextActionTime < nowTime) {
          const fingerprint = this.calculateFingerprint(businessId, "next_action_overdue", "lead", lead.id);
          const score = this.calculatePriorityScore("critical", leadValue, false, daysSinceLastContact);
          evaluatedList.push({
            fingerprint,
            type: "next_action_overdue",
            category: "sales",
            title: `Pr\xF3xima a\xE7\xE3o atrasada: ${lead.name}`,
            description: `A\xE7\xE3o "${lead.nextAction || "Follow-up"}" agendada estava vencida desde ${new Date(lead.nextActionAt).toLocaleDateString("pt-BR")}.`,
            reason: "O lead possui uma atividade de follow-up com data anterior a hoje.",
            priority: "critical",
            priorityScore: score,
            impact: leadValue > 1e4 ? "high" : "medium",
            sourceType: "lead",
            sourceId: lead.id,
            actionType: "open_lead",
            actionUrl: `/leads?leadId=${lead.id}`,
            metadata: { leadId: lead.id, leadName: lead.name, potentialValue: leadValue }
          });
          continue;
        }
      }
      if (lead.status === "new" && hoursSinceCreated > 24 && !lead.lastContactAt) {
        const fingerprint = this.calculateFingerprint(businessId, "new_lead_uncontacted", "lead", lead.id);
        const score = this.calculatePriorityScore("high", leadValue, false, Math.floor(hoursSinceCreated / 24));
        evaluatedList.push({
          fingerprint,
          type: "new_lead_uncontacted",
          category: "sales",
          title: "Lead aguardando primeiro contato",
          description: `O lead "${lead.name}" entrou h\xE1 mais de 24h e ainda n\xE3o recebeu nenhum contato inicial.`,
          reason: "Leads contatados nas primeiras 24h t\xEAm maior taxa de convers\xE3o.",
          priority: "high",
          priorityScore: score,
          impact: leadValue > 1e4 ? "high" : "medium",
          sourceType: "lead",
          sourceId: lead.id,
          actionType: "open_lead",
          actionUrl: `/leads?leadId=${lead.id}`,
          metadata: { leadId: lead.id, leadName: lead.name }
        });
        continue;
      }
      if (lead.status === "proposal" && hoursSinceLastContact > 72) {
        const fingerprint = this.calculateFingerprint(businessId, "proposal_stagnant", "lead", lead.id);
        const score = this.calculatePriorityScore("high", leadValue, true, daysSinceLastContact);
        const valFormatted = leadValue > 0 ? ` (Valor: R$ ${leadValue.toLocaleString("pt-BR")})` : "";
        evaluatedList.push({
          fingerprint,
          type: "proposal_stagnant",
          category: "sales",
          title: `Proposta aguardando follow-up: ${lead.name}`,
          description: `Proposta enviada para "${lead.name}"${valFormatted} est\xE1 sem novidades h\xE1 mais de 3 dias.`,
          reason: "Propostas sem acompanhamento frequente correm risco de esfriar.",
          priority: "high",
          priorityScore: score,
          impact: leadValue > 2e4 ? "high" : "medium",
          sourceType: "lead",
          sourceId: lead.id,
          actionType: "open_lead",
          actionUrl: `/leads?leadId=${lead.id}`,
          metadata: { leadId: lead.id, leadName: lead.name, potentialValue: leadValue }
        });
        continue;
      }
      if (hoursSinceLastContact > 48) {
        const fingerprint = this.calculateFingerprint(businessId, "stagnant_lead", "lead", lead.id);
        const score = this.calculatePriorityScore("high", leadValue, false, daysSinceLastContact);
        evaluatedList.push({
          fingerprint,
          type: "stagnant_lead",
          category: "sales",
          title: `Lead sem contato h\xE1 mais de 48h: ${lead.name}`,
          description: `Sem registros de intera\xE7\xE3o com "${lead.name}" h\xE1 ${daysSinceLastContact} dias.`,
          reason: "Intera\xE7\xE3o cont\xEDnua mant\xE9m o interesse do cliente aquecido.",
          priority: "high",
          priorityScore: score,
          impact: leadValue > 1e4 ? "high" : "medium",
          sourceType: "lead",
          sourceId: lead.id,
          actionType: "open_lead",
          actionUrl: `/leads?leadId=${lead.id}`,
          metadata: { leadId: lead.id, leadName: lead.name, potentialValue: leadValue }
        });
      }
    }
    if (stagnantLeadsCount >= 3) {
      const fingerprint = this.calculateFingerprint(businessId, "pipeline_at_risk", "pipeline", "all");
      const formattedVal = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(totalStagnantValue);
      const score = this.calculatePriorityScore("critical", totalStagnantValue, true, 3);
      evaluatedList.push({
        fingerprint,
        type: "pipeline_at_risk",
        category: "sales",
        title: `${formattedVal} em oportunidades precisam de aten\xE7\xE3o`,
        description: `${stagnantLeadsCount} leads est\xE3o sem registros de contato ou atualiza\xE7\xE3o h\xE1 mais de 48 horas.`,
        reason: "O ac\xFAmulo de leads parados compromete a previsibilidade do funil de vendas.",
        priority: "critical",
        priorityScore: score,
        impact: "high",
        sourceType: "pipeline",
        sourceId: "all",
        actionType: "view_leads",
        actionUrl: "/leads",
        metadata: { stagnantLeadsCount, totalStagnantValue }
      });
    }
    if (proposalLeadsCount >= 3) {
      const fingerprint = this.calculateFingerprint(businessId, "many_proposals", "pipeline", "proposals");
      const formattedVal = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(totalProposalValue);
      const score = this.calculatePriorityScore("high", totalProposalValue, true, 2);
      evaluatedList.push({
        fingerprint,
        type: "many_proposals",
        category: "opportunity",
        title: `Voc\xEA possui ${proposalLeadsCount} propostas em aberto (${formattedVal})`,
        description: `Existem ${proposalLeadsCount} propostas ativas aguardando fechamento, representando ${formattedVal} em potencial.`,
        reason: "Focar o esfor\xE7o comercial no fechamento dessas propostas \xE9 a rota mais r\xE1pida para receita.",
        priority: "high",
        priorityScore: score,
        impact: "high",
        sourceType: "pipeline",
        sourceId: "proposals",
        actionType: "view_proposals",
        actionUrl: "/leads?status=proposal",
        metadata: { proposalLeadsCount, totalProposalValue }
      });
    }
    try {
      const pendingQualifiedProspects = await db.select().from(prospects).where((0, import_drizzle_orm8.and)(
        (0, import_drizzle_orm8.eq)(prospects.businessId, businessId),
        (0, import_drizzle_orm8.eq)(prospects.status, "qualified")
      ));
      if (pendingQualifiedProspects.length > 0) {
        const count = pendingQualifiedProspects.length;
        const fingerprint = this.calculateFingerprint(businessId, "pending_qualified_prospects", "pipeline", "prospecting");
        evaluatedList.push({
          fingerprint,
          type: "pending_qualified_prospects",
          category: "opportunity",
          title: `Prospects qualificados aguardando importa\xE7\xE3o para o CRM`,
          description: `Voc\xEA possui ${count} prospects com alta compatibilidade identificados na prospec\xE7\xE3o que ainda n\xE3o foram adicionados ao CRM.`,
          reason: "Importar prospects qualificados para o CRM permite iniciar o contato comercial rapidamente.",
          priority: "high",
          priorityScore: 85,
          impact: "high",
          sourceType: "pipeline",
          sourceId: "prospecting",
          actionType: "view_prospects",
          actionUrl: "/prospecting",
          metadata: { qualifiedProspectsCount: count }
        });
      }
    } catch (e) {
      console.warn("Could not fetch pending prospects for recommendation:", e);
    }
    const future7DaysDate = /* @__PURE__ */ new Date();
    future7DaysDate.setDate(future7DaysDate.getDate() + 7);
    const future7DaysStr = future7DaysDate.toISOString().split("T")[0];
    let contentScheduledNext7Days = 0;
    for (const item of allContent) {
      if (item.scheduledDate) {
        if (item.scheduledDate >= todayStr && item.scheduledDate <= future7DaysStr) {
          contentScheduledNext7Days++;
        }
        if (item.scheduledDate === todayStr && item.status !== "published") {
          const fingerprint = this.calculateFingerprint(businessId, "content_today_unpublished", "content", item.id);
          const score = this.calculatePriorityScore("medium", 0, false, 0);
          evaluatedList.push({
            fingerprint,
            type: "content_today_unpublished",
            category: "content",
            title: `Conte\xFAdo programado para hoje n\xE3o publicado`,
            description: `O conte\xFAdo "${item.title}" est\xE1 agendado para hoje e ainda est\xE1 no status ${item.status}.`,
            reason: "Manter a const\xE2ncia da publica\xE7\xE3o fortalece o alcance org\xE2nico.",
            priority: "medium",
            priorityScore: score,
            impact: "medium",
            sourceType: "content",
            sourceId: item.id,
            actionType: "open_content",
            actionUrl: `/content`,
            metadata: { contentId: item.id, title: item.title }
          });
        }
        if (item.scheduledDate < todayStr && item.status !== "published") {
          const fingerprint = this.calculateFingerprint(businessId, "overdue_content", "content", item.id);
          const score = this.calculatePriorityScore("medium", 0, false, 2);
          evaluatedList.push({
            fingerprint,
            type: "overdue_content",
            category: "content",
            title: `Conte\xFAdo com data atrasada: ${item.title}`,
            description: `Conte\xFAdo estava agendado para ${item.scheduledDate} e permanece pendente.`,
            reason: "Atualize a data de agendamento ou publique o conte\xFAdo para ajustar o calend\xE1rio.",
            priority: "medium",
            priorityScore: score,
            impact: "medium",
            sourceType: "content",
            sourceId: item.id,
            actionType: "open_content",
            actionUrl: `/content`,
            metadata: { contentId: item.id, title: item.title }
          });
        }
      }
    }
    if (contentScheduledNext7Days === 0) {
      const fingerprint = this.calculateFingerprint(businessId, "empty_calendar", "content", "empty");
      const score = this.calculatePriorityScore("medium", 0, true, 0);
      evaluatedList.push({
        fingerprint,
        type: "empty_calendar",
        category: "content",
        title: "Seu calend\xE1rio de conte\xFAdo est\xE1 vazio",
        description: "Voc\xEA n\xE3o possui nenhum conte\xFAdo planejado para os pr\xF3ximos 7 dias.",
        reason: "O planejamento pr\xE9vio evita interrup\xE7\xF5es na sua presen\xE7a digital.",
        priority: "medium",
        priorityScore: score,
        impact: "medium",
        sourceType: "content",
        sourceId: "empty",
        actionType: "plan_content",
        actionUrl: "/content"
      });
    }
    const allCampaignTasks = await db.select().from(campaignTasks);
    for (const campaign of allCampaigns) {
      if (campaign.status !== "active") continue;
      const campaignLeads = allLeads.filter((l) => l.campaignId === campaign.id);
      const campaignTasksList = allCampaignTasks.filter((t) => t.campaignId === campaign.id);
      const pendingTasks = campaignTasksList.filter((t) => t.status !== "done");
      if (campaign.endDate) {
        const in3DaysDate = /* @__PURE__ */ new Date();
        in3DaysDate.setDate(in3DaysDate.getDate() + 3);
        const in3DaysStr = in3DaysDate.toISOString().split("T")[0];
        if (campaign.endDate >= todayStr && campaign.endDate <= in3DaysStr) {
          const fingerprint = this.calculateFingerprint(businessId, "campaign_ending_soon", "campaign", campaign.id);
          const score = this.calculatePriorityScore("high", 0, true, 0);
          evaluatedList.push({
            fingerprint,
            type: "campaign_ending_soon",
            category: "campaign",
            title: `Campanha encerra em breve: ${campaign.name}`,
            description: `A campanha "${campaign.name}" est\xE1 prevista para terminar na data ${campaign.endDate}.`,
            reason: "Avalie os resultados para decidir por prorroga\xE7\xE3o ou encerramento.",
            priority: "high",
            priorityScore: score,
            impact: "high",
            sourceType: "campaign",
            sourceId: campaign.id,
            actionType: "review_campaign",
            actionUrl: `/campaigns/${campaign.id}`,
            metadata: { campaignId: campaign.id, endDate: campaign.endDate }
          });
        }
        if (campaign.endDate < todayStr) {
          const fingerprint = this.calculateFingerprint(businessId, "campaign_overdue", "campaign", campaign.id);
          const score = this.calculatePriorityScore("high", 0, true, 2);
          evaluatedList.push({
            fingerprint,
            type: "campaign_overdue",
            category: "campaign",
            title: `Campanha passou da data final: ${campaign.name}`,
            description: `A campanha "${campaign.name}" ainda consta como ativa, mas sua data final era ${campaign.endDate}.`,
            reason: "Atualize o status ou prorrogue a vig\xEAncia para manter o acompanhamento correto.",
            priority: "high",
            priorityScore: score,
            impact: "high",
            sourceType: "campaign",
            sourceId: campaign.id,
            actionType: "review_campaign",
            actionUrl: `/campaigns/${campaign.id}`,
            metadata: { campaignId: campaign.id }
          });
        }
      }
      const createdAtDate = campaign.createdAt ? new Date(campaign.createdAt) : now;
      const daysSinceCreated = Math.floor((nowTime - createdAtDate.getTime()) / (1e3 * 60 * 60 * 24));
      if (daysSinceCreated >= 3 && campaignLeads.length === 0) {
        const fingerprint = this.calculateFingerprint(businessId, "campaign_no_leads", "campaign", campaign.id);
        const score = this.calculatePriorityScore("medium", 0, false, daysSinceCreated);
        evaluatedList.push({
          fingerprint,
          type: "campaign_no_leads",
          category: "campaign",
          title: `Campanha sem leads registrados: ${campaign.name}`,
          description: `A campanha "${campaign.name}" est\xE1 ativa h\xE1 ${daysSinceCreated} dias e ainda n\xE3o possui leads atribu\xEDdos no sistema.`,
          reason: "Verifique os canais de divulga\xE7\xE3o ou certifique-se de registrar as convers\xF5es.",
          priority: "medium",
          priorityScore: score,
          impact: "medium",
          sourceType: "campaign",
          sourceId: campaign.id,
          actionType: "review_campaign",
          actionUrl: `/campaigns/${campaign.id}`,
          metadata: { campaignId: campaign.id }
        });
      }
      let overdueTasksCount = 0;
      for (const task of pendingTasks) {
        if (task.dueDate && task.dueDate < todayStr) {
          overdueTasksCount++;
          const fingerprint = this.calculateFingerprint(businessId, "campaign_task_overdue", "campaign", task.id);
          const score = this.calculatePriorityScore("medium", 0, false, 1);
          evaluatedList.push({
            fingerprint,
            type: "campaign_task_overdue",
            category: "campaign",
            title: `Tarefa de campanha atrasada: ${task.title}`,
            description: `Tarefa "${task.title}" da campanha "${campaign.name}" venceu em ${task.dueDate}.`,
            reason: "Tarefas em dia evitam atrasos na veicula\xE7\xE3o e resultados da campanha.",
            priority: "medium",
            priorityScore: score,
            impact: "medium",
            sourceType: "campaign",
            sourceId: campaign.id,
            actionType: "review_campaign",
            actionUrl: `/campaigns/${campaign.id}`,
            metadata: { taskId: task.id, campaignId: campaign.id }
          });
        }
      }
      if (pendingTasks.length >= 3) {
        const fingerprint = this.calculateFingerprint(businessId, "campaign_unexecuted", "campaign", campaign.id);
        const score = this.calculatePriorityScore("high", 0, true, 2);
        evaluatedList.push({
          fingerprint,
          type: "campaign_unexecuted",
          category: "campaign",
          title: `Campanha "${campaign.name}" possui ${pendingTasks.length} a\xE7\xF5es pendentes`,
          description: `Existem ${pendingTasks.length} tarefas n\xE3o conclu\xEDdas (${overdueTasksCount} atrasadas) para esta campanha ativa.`,
          reason: "A\xE7\xF5es operacionais pendentes impactam diretamente a atra\xE7\xE3o e convers\xE3o de leads.",
          priority: "high",
          priorityScore: score,
          impact: "high",
          sourceType: "campaign",
          sourceId: campaign.id,
          actionType: "review_campaign",
          actionUrl: `/campaigns/${campaign.id}`,
          metadata: { campaignId: campaign.id, pendingCount: pendingTasks.length }
        });
      }
    }
    const activeCampaigns = allCampaigns.filter((c) => c.status === "active");
    if ((activeStrategy || businessGoals.length > 0) && activeCampaigns.length === 0 && contentScheduledNext7Days === 0) {
      const fingerprint = this.calculateFingerprint(businessId, "goal_unexecuted", "strategy", "goal");
      const score = this.calculatePriorityScore("high", 0, true, 0);
      evaluatedList.push({
        fingerprint,
        type: "goal_unexecuted",
        category: "strategy",
        title: "Seu objetivo atual n\xE3o possui a\xE7\xF5es em andamento",
        description: "Voc\xEA possui estrat\xE9gia/objetivo definidos, mas nenhuma campanha ativa e nenhum conte\xFAdo planejado para os pr\xF3ximos dias.",
        reason: "Uma estrat\xE9gia s\xF3 produz resultados quando traduzida em a\xE7\xF5es cont\xEDnuas de marketing.",
        priority: "high",
        priorityScore: score,
        impact: "high",
        sourceType: "strategy",
        sourceId: activeStrategy?.id || "goal",
        actionType: "create_campaign",
        actionUrl: "/campaigns"
      });
    }
    const existingDbRecs = await db.select().from(recommendations).where((0, import_drizzle_orm8.eq)(recommendations.businessId, businessId));
    const existingMap = /* @__PURE__ */ new Map();
    for (const r of existingDbRecs) {
      existingMap.set(r.fingerprint, r);
    }
    const activeFingerprintsSet = /* @__PURE__ */ new Set();
    for (const item of evaluatedList) {
      activeFingerprintsSet.add(item.fingerprint);
      const existing = existingMap.get(item.fingerprint);
      if (existing) {
        if (existing.status === "dismissed") {
          continue;
        }
        await db.update(recommendations).set({
          title: item.title,
          description: item.description,
          reason: item.reason,
          priority: item.priority,
          priorityScore: item.priorityScore,
          impact: item.impact,
          status: "active",
          metadata: item.metadata,
          updatedAt: /* @__PURE__ */ new Date(),
          resolvedAt: null
        }).where((0, import_drizzle_orm8.eq)(recommendations.id, existing.id));
      } else {
        await db.insert(recommendations).values({
          organizationId,
          businessId,
          fingerprint: item.fingerprint,
          type: item.type,
          category: item.category,
          title: item.title,
          description: item.description,
          reason: item.reason,
          priority: item.priority,
          priorityScore: item.priorityScore,
          impact: item.impact,
          sourceType: item.sourceType,
          sourceId: item.sourceId || null,
          actionType: item.actionType,
          actionUrl: item.actionUrl,
          status: "active",
          metadata: item.metadata,
          createdAt: /* @__PURE__ */ new Date(),
          updatedAt: /* @__PURE__ */ new Date()
        });
      }
    }
    for (const r of existingDbRecs) {
      if (r.status === "active" && !activeFingerprintsSet.has(r.fingerprint)) {
        await db.update(recommendations).set({
          status: "completed",
          resolvedAt: /* @__PURE__ */ new Date(),
          updatedAt: /* @__PURE__ */ new Date()
        }).where((0, import_drizzle_orm8.eq)(recommendations.id, r.id));
      }
    }
    return await db.select().from(recommendations).where((0, import_drizzle_orm8.eq)(recommendations.businessId, businessId));
  }
  /**
   * Generates max 3 strategic executive insights using Gemini with AGGREGATED data only.
   */
  static async generateStrategicInsights(businessId) {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return [
          "Defina metas claras de convers\xE3o para acompanhar a efici\xEAncia das campanhas ativas.",
          "Priorize o contato com leads em est\xE1gio de proposta para acelerar o ciclo de receita."
        ];
      }
      const business = await db.query.businesses.findFirst({
        where: (0, import_drizzle_orm8.eq)(businesses.id, businessId)
      });
      const allLeads = await db.select().from(leads).where((0, import_drizzle_orm8.eq)(leads.businessId, businessId));
      const allCampaigns = await db.select().from(campaigns).where((0, import_drizzle_orm8.eq)(campaigns.businessId, businessId));
      const allContent = await db.select().from(contentItems).where((0, import_drizzle_orm8.eq)(contentItems.businessId, businessId));
      const businessGoals = await db.select().from(goals).where((0, import_drizzle_orm8.eq)(goals.businessId, businessId));
      const totalLeads = allLeads.length;
      const proposalLeads = allLeads.filter((l) => l.status === "proposal").length;
      const customers = allLeads.filter((l) => l.status === "customer").length;
      const activeCampaignsCount = allCampaigns.filter((c) => c.status === "active").length;
      const publishedContentCount = allContent.filter((c) => c.status === "published").length;
      const aggregatedData = {
        businessName: business?.name,
        segment: business?.segment,
        goals: businessGoals.map((g) => g.goalType),
        pipelineSummary: {
          totalLeads,
          proposalLeads,
          convertedCustomers: customers
        },
        marketingSummary: {
          activeCampaigns: activeCampaignsCount,
          publishedContent: publishedContentCount
        }
      };
      const ai = new import_genai2.GoogleGenAI({
        apiKey,
        httpOptions: { headers: { "User-Agent": "aistudio-build" } }
      });
      const prompt = `Voc\xEA \xE9 um analista executivo de marketing e vendas B2B/B2C.
Analise estes dados AGREGADOS do neg\xF3cio:
${JSON.stringify(aggregatedData, null, 2)}

Forne\xE7a NO M\xC1XIMO 3 insights estrat\xE9gicos curtos, pr\xE1ticos e diretos em portugu\xEAs (1 frase por insight).
Regras estritas:
1. N\xC3O invente causalidades diretas n\xE3o comprovadas (ex: "seu post X vendeu Y").
2. Foque em dire\xE7\xF5es de aloca\xE7\xE3o de tempo, gargalos de funil ou prioriza\xE7\xE3o de canais.
3. Retorne no formato JSON array de strings: ["Insight 1", "Insight 2", "Insight 3"]`;
      const response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json"
        }
      });
      const rawText = response.text || "[]";
      const insightsArray = JSON.parse(rawText);
      if (business) {
        await db.insert(aiGenerations).values({
          organizationId: business.organizationId,
          businessId: business.id,
          type: "strategic_insights",
          model: "gemini-3.6-flash",
          output: insightsArray,
          createdAt: /* @__PURE__ */ new Date()
        });
      }
      return Array.isArray(insightsArray) ? insightsArray.slice(0, 3) : [];
    } catch (e) {
      if (e?.status === 429 || e?.message?.includes("429") || e?.message?.includes("Quota exceeded")) {
        console.warn("Gemini API rate limit (429) hit for strategic insights. Returning default fallback insights.");
      } else {
        console.error("Failed to generate strategic insights:", e);
      }
      return [
        "Mantenha o foco em follow-up de propostas ativas para garantir fluxo constante de caixa.",
        "Mantenha a frequ\xEAncia semanal de publica\xE7\xF5es nos canais principais para atra\xE7\xE3o constante."
      ];
    }
  }
};

// src/server/routes/leads.ts
var leadsRouter = (0, import_express5.Router)();
var ensureBusinessOwnership2 = async (req, res, next) => {
  const { businessId } = req.query;
  const user = req.user;
  if (!businessId) return res.status(400).json({ error: "Missing businessId parameter" });
  const dbUser = await db.query.users.findFirst({
    where: (0, import_drizzle_orm9.eq)(users.uid, user.uid)
  });
  if (!dbUser) return res.status(401).json({ error: "User not found in DB" });
  const business = await db.query.businesses.findFirst({
    where: (0, import_drizzle_orm9.eq)(businesses.id, businessId),
    with: { organization: { with: { members: true } } }
  });
  if (!business) return res.status(404).json({ error: "Business not found" });
  const isMember = business.organization.members.some((m) => m.userId === dbUser.id);
  if (!isMember) return res.status(403).json({ error: "Unauthorized access to business" });
  req.business = business;
  req.dbUser = dbUser;
  next();
};
leadsRouter.get("/", requireAuth, ensureBusinessOwnership2, async (req, res) => {
  const { businessId, status, source, campaignId, productId, search } = req.query;
  try {
    const conditions = [(0, import_drizzle_orm9.eq)(leads.businessId, businessId)];
    if (status) {
      conditions.push((0, import_drizzle_orm9.eq)(leads.status, status));
    }
    if (source) {
      conditions.push((0, import_drizzle_orm9.eq)(leads.source, source));
    }
    if (campaignId) {
      conditions.push((0, import_drizzle_orm9.eq)(leads.campaignId, campaignId));
    }
    if (productId) {
      conditions.push((0, import_drizzle_orm9.eq)(leads.productId, productId));
    }
    if (search && typeof search === "string" && search.trim() !== "") {
      const pattern = `%${search.trim()}%`;
      conditions.push(
        (0, import_drizzle_orm9.or)(
          (0, import_drizzle_orm9.ilike)(leads.name, pattern),
          (0, import_drizzle_orm9.ilike)(leads.companyName, pattern),
          (0, import_drizzle_orm9.ilike)(leads.email, pattern),
          (0, import_drizzle_orm9.ilike)(leads.phone, pattern)
        )
      );
    }
    const list = await db.query.leads.findMany({
      where: (0, import_drizzle_orm9.and)(...conditions),
      orderBy: [(0, import_drizzle_orm9.desc)(leads.createdAt)],
      with: {
        campaign: {
          columns: {
            id: true,
            name: true
          }
        },
        product: {
          columns: {
            id: true,
            name: true
          }
        },
        responsibleUser: {
          columns: {
            id: true,
            email: true
          }
        }
      }
    });
    res.json(list);
  } catch (error) {
    console.error("Fetch Leads Error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch leads" });
  }
});
leadsRouter.get("/summary", requireAuth, ensureBusinessOwnership2, async (req, res) => {
  const { businessId } = req.query;
  try {
    const allLeads = await db.select().from(leads).where((0, import_drizzle_orm9.eq)(leads.businessId, businessId));
    let total = allLeads.length;
    let newCount = 0;
    let contactedCount = 0;
    let interestedCount = 0;
    let proposalCount = 0;
    let customerCount = 0;
    let lostCount = 0;
    let totalPotentialValue = 0;
    let totalActualValue = 0;
    for (const l of allLeads) {
      if (l.status === "new") newCount++;
      else if (l.status === "contacted") contactedCount++;
      else if (l.status === "interested") interestedCount++;
      else if (l.status === "proposal") proposalCount++;
      else if (l.status === "customer") {
        customerCount++;
        if (l.actualValue) totalActualValue += l.actualValue;
      } else if (l.status === "lost") lostCount++;
      if (l.potentialValue && l.status !== "lost") {
        totalPotentialValue += l.potentialValue;
      }
    }
    const inNegotiationCount = contactedCount + interestedCount + proposalCount;
    res.json({
      total,
      newCount,
      contactedCount,
      interestedCount,
      proposalCount,
      inNegotiationCount,
      customerCount,
      lostCount,
      totalPotentialValue,
      totalActualValue
    });
  } catch (error) {
    console.error("Lead Summary Error:", error);
    res.status(500).json({ error: error.message });
  }
});
leadsRouter.get("/recommendations", requireAuth, ensureBusinessOwnership2, async (req, res) => {
  const { businessId } = req.query;
  try {
    const alerts = await RecommendationEngine.evaluateBusiness(businessId);
    res.json(alerts);
  } catch (error) {
    console.error("Lead Recommendations Error:", error);
    res.status(500).json({ error: error.message });
  }
});
leadsRouter.get("/campaign-metrics/:campaignId", requireAuth, ensureBusinessOwnership2, async (req, res) => {
  const { campaignId } = req.params;
  const { businessId } = req.query;
  try {
    const campaignLeads = await db.select().from(leads).where(
      (0, import_drizzle_orm9.and)(
        (0, import_drizzle_orm9.eq)(leads.businessId, businessId),
        (0, import_drizzle_orm9.eq)(leads.campaignId, campaignId)
      )
    );
    const totalGenerated = campaignLeads.length;
    const customers = campaignLeads.filter((l) => l.status === "customer");
    const customerCount = customers.length;
    const conversionRate = totalGenerated > 0 ? (customerCount / totalGenerated * 100).toFixed(1) : "0.0";
    let totalPotentialValue = 0;
    let attributedRevenue = 0;
    for (const l of campaignLeads) {
      if (l.potentialValue && l.status !== "lost") {
        totalPotentialValue += l.potentialValue;
      }
      if (l.status === "customer" && l.actualValue) {
        attributedRevenue += l.actualValue;
      }
    }
    res.json({
      totalGenerated,
      customerCount,
      conversionRate: parseFloat(conversionRate),
      totalPotentialValue,
      attributedRevenue
    });
  } catch (error) {
    console.error("Campaign Lead Metrics Error:", error);
    res.status(500).json({ error: error.message });
  }
});
leadsRouter.get("/:id", requireAuth, ensureBusinessOwnership2, async (req, res) => {
  const { id } = req.params;
  const { businessId } = req.query;
  try {
    const lead = await db.query.leads.findFirst({
      where: (0, import_drizzle_orm9.and)((0, import_drizzle_orm9.eq)(leads.id, id), (0, import_drizzle_orm9.eq)(leads.businessId, businessId)),
      with: {
        campaign: true,
        product: true,
        responsibleUser: true
      }
    });
    if (!lead) return res.status(404).json({ error: "Lead not found" });
    const activities = await db.query.leadActivities.findMany({
      where: (0, import_drizzle_orm9.eq)(leadActivities.leadId, id),
      orderBy: [(0, import_drizzle_orm9.desc)(leadActivities.createdAt)],
      with: {
        user: true
      }
    });
    res.json({ lead, activities });
  } catch (error) {
    console.error("Lead Detail Error:", error);
    res.status(500).json({ error: error.message });
  }
});
leadsRouter.post("/", requireAuth, ensureBusinessOwnership2, async (req, res) => {
  const { businessId } = req.query;
  const orgId = req.business.organizationId;
  const userId = req.dbUser.id;
  const body = req.body;
  if (!body.name || body.name.trim() === "") {
    return res.status(400).json({ error: "O nome do lead \xE9 obrigat\xF3rio." });
  }
  try {
    const result = await db.transaction(async (tx) => {
      const newLead = await tx.insert(leads).values({
        organizationId: orgId,
        businessId,
        campaignId: body.campaignId || null,
        productId: body.productId || null,
        name: body.name.trim(),
        companyName: body.companyName ? body.companyName.trim() : null,
        email: body.email ? body.email.trim() : null,
        phone: body.phone ? body.phone.trim() : null,
        source: body.source || "Manual",
        status: body.status || "new",
        potentialValue: body.potentialValue ? parseInt(body.potentialValue, 10) : null,
        notes: body.notes ? body.notes.trim() : null,
        nextAction: body.nextAction ? body.nextAction.trim() : null,
        nextActionAt: body.nextActionAt ? new Date(body.nextActionAt) : null,
        responsibleUserId: body.responsibleUserId || userId
      }).returning().then((r) => r[0]);
      await tx.insert(leadActivities).values({
        organizationId: orgId,
        businessId,
        leadId: newLead.id,
        userId,
        type: "created",
        description: `Lead criado via ${newLead.source}`,
        metadata: { source: newLead.source }
      });
      if (body.notes && body.notes.trim() !== "") {
        await tx.insert(leadActivities).values({
          organizationId: orgId,
          businessId,
          leadId: newLead.id,
          userId,
          type: "note",
          description: `Observa\xE7\xE3o inicial: ${body.notes.trim()}`
        });
      }
      return newLead;
    });
    res.status(201).json(result);
  } catch (error) {
    console.error("Create Lead Error:", error);
    res.status(500).json({ error: error.message });
  }
});
leadsRouter.put("/:id", requireAuth, ensureBusinessOwnership2, async (req, res) => {
  const { id } = req.params;
  const { businessId } = req.query;
  const body = req.body;
  try {
    const existing = await db.query.leads.findFirst({
      where: (0, import_drizzle_orm9.and)((0, import_drizzle_orm9.eq)(leads.id, id), (0, import_drizzle_orm9.eq)(leads.businessId, businessId))
    });
    if (!existing) return res.status(404).json({ error: "Lead not found" });
    const updateData = {
      updatedAt: /* @__PURE__ */ new Date()
    };
    if (body.name !== void 0) updateData.name = body.name;
    if (body.companyName !== void 0) updateData.companyName = body.companyName;
    if (body.email !== void 0) updateData.email = body.email;
    if (body.phone !== void 0) updateData.phone = body.phone;
    if (body.source !== void 0) updateData.source = body.source;
    if (body.campaignId !== void 0) updateData.campaignId = body.campaignId || null;
    if (body.productId !== void 0) updateData.productId = body.productId || null;
    if (body.potentialValue !== void 0) updateData.potentialValue = body.potentialValue ? parseInt(body.potentialValue, 10) : null;
    if (body.actualValue !== void 0) updateData.actualValue = body.actualValue ? parseInt(body.actualValue, 10) : null;
    if (body.notes !== void 0) updateData.notes = body.notes;
    if (body.nextAction !== void 0) updateData.nextAction = body.nextAction;
    if (body.nextActionAt !== void 0) updateData.nextActionAt = body.nextActionAt ? new Date(body.nextActionAt) : null;
    const updated = await db.update(leads).set(updateData).where((0, import_drizzle_orm9.and)((0, import_drizzle_orm9.eq)(leads.id, id), (0, import_drizzle_orm9.eq)(leads.businessId, businessId))).returning().then((r) => r[0]);
    res.json(updated);
  } catch (error) {
    console.error("Update Lead Error:", error);
    res.status(500).json({ error: error.message });
  }
});
leadsRouter.patch("/:id/status", requireAuth, ensureBusinessOwnership2, async (req, res) => {
  const { id } = req.params;
  const { businessId } = req.query;
  const orgId = req.business.organizationId;
  const userId = req.dbUser.id;
  const { newStatus, lostReason, actualValue } = req.body;
  const validStatuses = ["new", "contacted", "interested", "proposal", "customer", "lost"];
  if (!validStatuses.includes(newStatus)) {
    return res.status(400).json({ error: "Status inv\xE1lido." });
  }
  const statusLabels = {
    new: "Novo",
    contacted: "Contatado",
    interested: "Interessado",
    proposal: "Proposta",
    customer: "Cliente",
    lost: "Perdido"
  };
  try {
    const existing = await db.query.leads.findFirst({
      where: (0, import_drizzle_orm9.and)((0, import_drizzle_orm9.eq)(leads.id, id), (0, import_drizzle_orm9.eq)(leads.businessId, businessId))
    });
    if (!existing) return res.status(404).json({ error: "Lead not found" });
    const oldStatusLabel = statusLabels[existing.status] || existing.status;
    const newStatusLabel = statusLabels[newStatus] || newStatus;
    const updateFields = {
      status: newStatus,
      updatedAt: /* @__PURE__ */ new Date()
    };
    let activityType = "status_change";
    let activityDesc = `Status alterado de "${oldStatusLabel}" para "${newStatusLabel}"`;
    if (newStatus === "customer") {
      updateFields.convertedAt = /* @__PURE__ */ new Date();
      if (actualValue !== void 0 && actualValue !== null) {
        updateFields.actualValue = parseInt(actualValue, 10);
      }
      activityType = "conversion";
      activityDesc = `Lead convertido em Cliente! Valor da venda: R$ ${actualValue || existing.potentialValue || 0}`;
    } else if (newStatus === "lost") {
      updateFields.lostAt = /* @__PURE__ */ new Date();
      updateFields.lostReason = lostReason || "Motivo n\xE3o informado";
      activityType = "lost";
      activityDesc = `Lead marcado como Perdido. Motivo: ${updateFields.lostReason}`;
    }
    const updated = await db.transaction(async (tx) => {
      const resLead = await tx.update(leads).set(updateFields).where((0, import_drizzle_orm9.and)((0, import_drizzle_orm9.eq)(leads.id, id), (0, import_drizzle_orm9.eq)(leads.businessId, businessId))).returning().then((r) => r[0]);
      await tx.insert(leadActivities).values({
        organizationId: orgId,
        businessId,
        leadId: id,
        userId,
        type: activityType,
        description: activityDesc,
        metadata: {
          fromStatus: existing.status,
          toStatus: newStatus,
          lostReason: lostReason || null,
          actualValue: actualValue || null
        }
      });
      return resLead;
    });
    res.json(updated);
  } catch (error) {
    console.error("Update Lead Status Error:", error);
    res.status(500).json({ error: error.message });
  }
});
leadsRouter.post("/:id/activities", requireAuth, ensureBusinessOwnership2, async (req, res) => {
  const { id } = req.params;
  const { businessId } = req.query;
  const orgId = req.business.organizationId;
  const userId = req.dbUser.id;
  const { type, contactChannel, notes, nextAction, nextActionAt } = req.body;
  try {
    const existing = await db.query.leads.findFirst({
      where: (0, import_drizzle_orm9.and)((0, import_drizzle_orm9.eq)(leads.id, id), (0, import_drizzle_orm9.eq)(leads.businessId, businessId))
    });
    if (!existing) return res.status(404).json({ error: "Lead n\xE3o encontrado" });
    const now = /* @__PURE__ */ new Date();
    const updateLeadFields = {
      updatedAt: now
    };
    let activityType = type || "contact";
    let activityDesc = "";
    if (type === "contact") {
      updateLeadFields.lastContactAt = now;
      const channelLabel = contactChannel || "Contato";
      activityDesc = `Contato realizado via ${channelLabel}${notes ? `: ${notes}` : ""}`;
    } else if (type === "note") {
      activityDesc = `Observa\xE7\xE3o: ${notes || ""}`;
    } else {
      activityDesc = notes || "Atividade registrada";
    }
    if (nextAction !== void 0) {
      updateLeadFields.nextAction = nextAction ? nextAction.trim() : null;
    }
    if (nextActionAt !== void 0) {
      updateLeadFields.nextActionAt = nextActionAt ? new Date(nextActionAt) : null;
    }
    const result = await db.transaction(async (tx) => {
      if (Object.keys(updateLeadFields).length > 0) {
        await tx.update(leads).set(updateLeadFields).where((0, import_drizzle_orm9.and)((0, import_drizzle_orm9.eq)(leads.id, id), (0, import_drizzle_orm9.eq)(leads.businessId, businessId)));
      }
      const newActivity = await tx.insert(leadActivities).values({
        organizationId: orgId,
        businessId,
        leadId: id,
        userId,
        type: activityType,
        description: activityDesc,
        metadata: {
          contactChannel: contactChannel || null,
          nextAction: nextAction || null,
          nextActionAt: nextActionAt || null
        }
      }).returning().then((r) => r[0]);
      return newActivity;
    });
    res.status(201).json(result);
  } catch (error) {
    console.error("Create Activity Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// src/server/routes/recommendations.ts
var import_express6 = require("express");
var import_drizzle_orm10 = require("drizzle-orm");
var recommendationsRouter = (0, import_express6.Router)();
var ensureBusinessOwnership3 = async (req, res, next) => {
  const { businessId } = req.query;
  const user = req.user;
  if (!businessId) return res.status(400).json({ error: "Missing businessId parameter" });
  const dbUser = await db.query.users.findFirst({
    where: (0, import_drizzle_orm10.eq)(users.uid, user.uid)
  });
  if (!dbUser) return res.status(401).json({ error: "User not found in DB" });
  const business = await db.query.businesses.findFirst({
    where: (0, import_drizzle_orm10.eq)(businesses.id, businessId),
    with: { organization: { with: { members: true } } }
  });
  if (!business) return res.status(404).json({ error: "Business not found" });
  const isMember = business.organization.members.some((m) => m.userId === dbUser.id);
  if (!isMember) return res.status(403).json({ error: "Unauthorized access to business" });
  req.business = business;
  req.dbUser = dbUser;
  next();
};
recommendationsRouter.get("/", requireAuth, ensureBusinessOwnership3, async (req, res) => {
  const { businessId, category, priority, status } = req.query;
  try {
    await RecommendationEngine.evaluateBusiness(businessId);
    const conditions = [(0, import_drizzle_orm10.eq)(recommendations.businessId, businessId)];
    if (status) {
      conditions.push((0, import_drizzle_orm10.eq)(recommendations.status, status));
    } else {
      conditions.push((0, import_drizzle_orm10.eq)(recommendations.status, "active"));
    }
    if (category && category !== "all") {
      conditions.push((0, import_drizzle_orm10.eq)(recommendations.category, category));
    }
    if (priority && priority !== "all") {
      conditions.push((0, import_drizzle_orm10.eq)(recommendations.priority, priority));
    }
    const list = await db.select().from(recommendations).where((0, import_drizzle_orm10.and)(...conditions)).orderBy((0, import_drizzle_orm10.desc)(recommendations.priorityScore), (0, import_drizzle_orm10.desc)(recommendations.createdAt));
    res.json(list);
  } catch (error) {
    console.error("Fetch Recommendations Error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch recommendations" });
  }
});
recommendationsRouter.get("/summary", requireAuth, ensureBusinessOwnership3, async (req, res) => {
  const { businessId } = req.query;
  try {
    await RecommendationEngine.evaluateBusiness(businessId);
    const activeList = await db.select().from(recommendations).where((0, import_drizzle_orm10.and)((0, import_drizzle_orm10.eq)(recommendations.businessId, businessId), (0, import_drizzle_orm10.eq)(recommendations.status, "active")));
    let attentionNeeded = 0;
    let opportunities2 = 0;
    let contentCount = 0;
    let campaignCount = 0;
    let salesCount = 0;
    for (const item of activeList) {
      if (item.priority === "critical" || item.priority === "high") {
        attentionNeeded++;
      }
      if (item.category === "opportunity") {
        opportunities2++;
      } else if (item.category === "content") {
        contentCount++;
      } else if (item.category === "campaign") {
        campaignCount++;
      } else if (item.category === "sales") {
        salesCount++;
      }
    }
    res.json({
      totalActive: activeList.length,
      attentionNeeded,
      opportunities: opportunities2,
      contentCount,
      campaignCount,
      salesCount
    });
  } catch (error) {
    console.error("Summary Recommendations Error:", error);
    res.status(500).json({ error: error.message });
  }
});
recommendationsRouter.post("/:id/dismiss", requireAuth, ensureBusinessOwnership3, async (req, res) => {
  const { id } = req.params;
  const { businessId } = req.query;
  try {
    const existing = await db.query.recommendations.findFirst({
      where: (0, import_drizzle_orm10.and)((0, import_drizzle_orm10.eq)(recommendations.id, id), (0, import_drizzle_orm10.eq)(recommendations.businessId, businessId))
    });
    if (!existing) return res.status(404).json({ error: "Recommendation not found" });
    await db.update(recommendations).set({
      status: "dismissed",
      dismissedAt: /* @__PURE__ */ new Date(),
      updatedAt: /* @__PURE__ */ new Date()
    }).where((0, import_drizzle_orm10.eq)(recommendations.id, id));
    res.json({ success: true, status: "dismissed" });
  } catch (error) {
    console.error("Dismiss Recommendation Error:", error);
    res.status(500).json({ error: error.message });
  }
});
recommendationsRouter.post("/:id/complete", requireAuth, ensureBusinessOwnership3, async (req, res) => {
  const { id } = req.params;
  const { businessId } = req.query;
  try {
    const existing = await db.query.recommendations.findFirst({
      where: (0, import_drizzle_orm10.and)((0, import_drizzle_orm10.eq)(recommendations.id, id), (0, import_drizzle_orm10.eq)(recommendations.businessId, businessId))
    });
    if (!existing) return res.status(404).json({ error: "Recommendation not found" });
    await db.update(recommendations).set({
      status: "completed",
      resolvedAt: /* @__PURE__ */ new Date(),
      updatedAt: /* @__PURE__ */ new Date()
    }).where((0, import_drizzle_orm10.eq)(recommendations.id, id));
    res.json({ success: true, status: "completed" });
  } catch (error) {
    console.error("Complete Recommendation Error:", error);
    res.status(500).json({ error: error.message });
  }
});
recommendationsRouter.get("/insights", requireAuth, ensureBusinessOwnership3, async (req, res) => {
  const { businessId } = req.query;
  try {
    const insights = await RecommendationEngine.generateStrategicInsights(businessId);
    res.json({ insights });
  } catch (error) {
    console.error("Generate Insights Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// src/server/routes/analytics.ts
var import_express7 = require("express");
var import_drizzle_orm11 = require("drizzle-orm");
var import_genai3 = require("@google/genai");
var analyticsRouter = (0, import_express7.Router)();
var ensureBusinessOwnership4 = async (req, res, next) => {
  const { businessId } = req.query;
  const user = req.user;
  if (!businessId) return res.status(400).json({ error: "Missing businessId parameter" });
  const dbUser = await db.query.users.findFirst({
    where: (0, import_drizzle_orm11.eq)(users.uid, user.uid)
  });
  if (!dbUser) return res.status(401).json({ error: "User not found in DB" });
  const business = await db.query.businesses.findFirst({
    where: (0, import_drizzle_orm11.eq)(businesses.id, businessId),
    with: { organization: { with: { members: true } } }
  });
  if (!business) return res.status(404).json({ error: "Business not found" });
  const isMember = business.organization.members.some((m) => m.userId === dbUser.id);
  if (!isMember) return res.status(403).json({ error: "Unauthorized access to business" });
  req.business = business;
  req.dbUser = dbUser;
  next();
};
function getPeriodDates(period, customStart, customEnd) {
  const now = /* @__PURE__ */ new Date();
  let endDate = new Date(now);
  let startDate = new Date(now);
  if (period === "7d") {
    startDate.setDate(now.getDate() - 7);
  } else if (period === "30d") {
    startDate.setDate(now.getDate() - 30);
  } else if (period === "90d") {
    startDate.setDate(now.getDate() - 90);
  } else if (period === "this_month") {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  } else if (period === "last_month") {
    startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
  } else if (period === "custom" && customStart && customEnd) {
    startDate = new Date(customStart);
    endDate = new Date(customEnd);
  } else {
    startDate.setDate(now.getDate() - 30);
  }
  const durationMs = endDate.getTime() - startDate.getTime();
  const prevEndDate = new Date(startDate.getTime() - 1);
  const prevStartDate = new Date(prevEndDate.getTime() - durationMs);
  return { startDate, endDate, prevStartDate, prevEndDate };
}
analyticsRouter.get("/overview", requireAuth, ensureBusinessOwnership4, async (req, res) => {
  const { businessId, period = "30d", customStart, customEnd, comparePrevious = "true" } = req.query;
  try {
    const { startDate, endDate, prevStartDate, prevEndDate } = getPeriodDates(
      period,
      customStart,
      customEnd
    );
    const currentLeads = await db.select().from(leads).where((0, import_drizzle_orm11.and)(
      (0, import_drizzle_orm11.eq)(leads.businessId, businessId),
      (0, import_drizzle_orm11.gte)(leads.createdAt, startDate),
      (0, import_drizzle_orm11.lte)(leads.createdAt, endDate)
    ));
    const convertedInPeriod = await db.select().from(leads).where((0, import_drizzle_orm11.and)(
      (0, import_drizzle_orm11.eq)(leads.businessId, businessId),
      (0, import_drizzle_orm11.eq)(leads.status, "customer"),
      (0, import_drizzle_orm11.gte)(leads.convertedAt, startDate),
      (0, import_drizzle_orm11.lte)(leads.convertedAt, endDate)
    ));
    let prevLeads = [];
    let prevConverted = [];
    if (comparePrevious === "true") {
      prevLeads = await db.select().from(leads).where((0, import_drizzle_orm11.and)(
        (0, import_drizzle_orm11.eq)(leads.businessId, businessId),
        (0, import_drizzle_orm11.gte)(leads.createdAt, prevStartDate),
        (0, import_drizzle_orm11.lte)(leads.createdAt, prevEndDate)
      ));
      prevConverted = await db.select().from(leads).where((0, import_drizzle_orm11.and)(
        (0, import_drizzle_orm11.eq)(leads.businessId, businessId),
        (0, import_drizzle_orm11.eq)(leads.status, "customer"),
        (0, import_drizzle_orm11.gte)(leads.convertedAt, prevStartDate),
        (0, import_drizzle_orm11.lte)(leads.convertedAt, prevEndDate)
      ));
    }
    const businessCampaigns = await db.select().from(campaigns).where((0, import_drizzle_orm11.eq)(campaigns.businessId, businessId));
    const totalLeads = currentLeads.length;
    const totalCustomers = convertedInPeriod.length;
    const conversionRate = totalLeads > 0 ? totalCustomers / totalLeads * 100 : 0;
    const attributedRevenue = convertedInPeriod.reduce((sum, l) => sum + Number(l.actualValue || 0), 0);
    const activePipelineLeads = await db.select().from(leads).where((0, import_drizzle_orm11.and)(
      (0, import_drizzle_orm11.eq)(leads.businessId, businessId),
      import_drizzle_orm11.sql`${leads.status} NOT IN ('customer', 'lost')`
    ));
    const potentialPipelineValue = activePipelineLeads.reduce((sum, l) => sum + Number(l.potentialValue || 0), 0);
    const parseBudget = (b, inv) => {
      if (inv) return inv;
      if (!b) return 0;
      const parsed = parseFloat(b.replace(/[^0-9.]/g, ""));
      return isNaN(parsed) ? 0 : parsed;
    };
    const totalInvestment = businessCampaigns.reduce((sum, c) => sum + parseBudget(c.budget, c.investmentSpent), 0);
    const cpl = totalLeads > 0 && totalInvestment > 0 ? totalInvestment / totalLeads : null;
    const cac = totalCustomers > 0 && totalInvestment > 0 ? totalInvestment / totalCustomers : null;
    const roas = totalInvestment > 0 ? attributedRevenue / totalInvestment : null;
    const prevTotalLeads = prevLeads.length;
    const prevTotalCustomers = prevConverted.length;
    const prevConversionRate = prevTotalLeads > 0 ? prevTotalCustomers / prevTotalLeads * 100 : 0;
    const prevRevenue = prevConverted.reduce((sum, l) => sum + Number(l.actualValue || 0), 0);
    const calcChange = (curr, prev) => {
      if (prev === 0) return null;
      return (curr - prev) / prev * 100;
    };
    const changes = {
      leads: calcChange(totalLeads, prevTotalLeads),
      customers: calcChange(totalCustomers, prevTotalCustomers),
      conversionRate: calcChange(conversionRate, prevConversionRate),
      revenue: calcChange(attributedRevenue, prevRevenue)
    };
    const allBusinessLeads = await db.select().from(leads).where((0, import_drizzle_orm11.eq)(leads.businessId, businessId));
    const pipelineByStage = {
      new: { count: 0, value: 0 },
      contacted: { count: 0, value: 0 },
      interested: { count: 0, value: 0 },
      proposal: { count: 0, value: 0 },
      customer: { count: 0, value: 0 },
      lost: { count: 0, value: 0 }
    };
    allBusinessLeads.forEach((l) => {
      if (pipelineByStage[l.status]) {
        pipelineByStage[l.status].count++;
        pipelineByStage[l.status].value += Number(l.potentialValue || l.actualValue || 0);
      }
    });
    let totalConversionDays = 0;
    let convertedCountWithDates = 0;
    allBusinessLeads.forEach((l) => {
      if (l.status === "customer" && l.createdAt && l.convertedAt) {
        const diffMs = new Date(l.convertedAt).getTime() - new Date(l.createdAt).getTime();
        const diffDays = Math.max(0, diffMs / (1e3 * 60 * 60 * 24));
        totalConversionDays += diffDays;
        convertedCountWithDates++;
      }
    });
    const avgConversionTimeDays = convertedCountWithDates > 0 ? totalConversionDays / convertedCountWithDates : null;
    const lostReasonCounts = {};
    let totalLostCount = 0;
    allBusinessLeads.forEach((l) => {
      if (l.status === "lost") {
        totalLostCount++;
        const reason = l.lostReason || "Outros / N\xE3o informado";
        lostReasonCounts[reason] = (lostReasonCounts[reason] || 0) + 1;
      }
    });
    const lostReasons = Object.entries(lostReasonCounts).map(([reason, count]) => ({
      reason,
      count,
      percentage: totalLostCount > 0 ? count / totalLostCount * 100 : 0
    })).sort((a, b) => b.count - a.count);
    const campaignsPerformance = businessCampaigns.map((c) => {
      const campaignLeadsList = allBusinessLeads.filter((l) => l.campaignId === c.id);
      const crmLeadsCount = campaignLeadsList.length;
      const crmCustomersCount = campaignLeadsList.filter((l) => l.status === "customer").length;
      const crmRevenue = campaignLeadsList.filter((l) => l.status === "customer").reduce((sum, l) => sum + Number(l.actualValue || 0), 0);
      const investment = parseBudget(c.budget, c.investmentSpent);
      const crmConversionRate = crmLeadsCount > 0 ? crmCustomersCount / crmLeadsCount * 100 : 0;
      const crmCpl = crmLeadsCount > 0 && investment > 0 ? investment / crmLeadsCount : null;
      const crmCac = crmCustomersCount > 0 && investment > 0 ? investment / crmCustomersCount : null;
      const crmRoas = investment > 0 ? crmRevenue / investment : null;
      const manualLeads = c.leads !== null && c.leads !== void 0 ? c.leads : null;
      const manualRevenue = c.revenueGenerated !== null && c.revenueGenerated !== void 0 ? c.revenueGenerated : null;
      const hasDiscrepancy = manualLeads !== null && manualLeads !== crmLeadsCount;
      return {
        id: c.id,
        name: c.name,
        status: c.status,
        investment,
        crm: {
          leads: crmLeadsCount,
          customers: crmCustomersCount,
          conversionRate: crmConversionRate,
          revenue: crmRevenue,
          cpl: crmCpl,
          cac: crmCac,
          roas: crmRoas
        },
        manual: {
          leads: manualLeads,
          revenue: manualRevenue
        },
        hasDiscrepancy
      };
    });
    const sourceCounts = {};
    allBusinessLeads.forEach((l) => {
      const src = l.source || "Outros";
      if (!sourceCounts[src]) {
        sourceCounts[src] = { leads: 0, customers: 0, revenue: 0, potential: 0 };
      }
      sourceCounts[src].leads++;
      if (l.status === "customer") {
        sourceCounts[src].customers++;
        sourceCounts[src].revenue += Number(l.actualValue || 0);
      } else if (l.status !== "lost") {
        sourceCounts[src].potential += Number(l.potentialValue || 0);
      }
    });
    const channelPerformance = Object.entries(sourceCounts).map(([channel, data]) => ({
      channel,
      leads: data.leads,
      customers: data.customers,
      conversionRate: data.leads > 0 ? data.customers / data.leads * 100 : 0,
      revenue: data.revenue,
      potentialValue: data.potential
    })).sort((a, b) => b.leads - a.leads);
    const allContent = await db.select().from(contentItems).where((0, import_drizzle_orm11.eq)(contentItems.businessId, businessId));
    const plannedContentCount = allContent.length;
    const publishedContentCount = allContent.filter((c) => c.status === "published").length;
    const executionPercentage = plannedContentCount > 0 ? publishedContentCount / plannedContentCount * 100 : 0;
    const channelContentDistribution = {};
    allContent.forEach((c) => {
      const ch = c.channel || "Outros";
      channelContentDistribution[ch] = (channelContentDistribution[ch] || 0) + 1;
    });
    const timelineMap = {};
    const currDay = new Date(startDate);
    while (currDay <= endDate) {
      const dateKey = currDay.toISOString().split("T")[0];
      timelineMap[dateKey] = { date: dateKey, leads: 0, customers: 0, revenue: 0 };
      currDay.setDate(currDay.getDate() + 1);
    }
    currentLeads.forEach((l) => {
      if (l.createdAt) {
        const dateKey = new Date(l.createdAt).toISOString().split("T")[0];
        if (timelineMap[dateKey]) {
          timelineMap[dateKey].leads++;
        }
      }
    });
    convertedInPeriod.forEach((l) => {
      if (l.convertedAt) {
        const dateKey = new Date(l.convertedAt).toISOString().split("T")[0];
        if (timelineMap[dateKey]) {
          timelineMap[dateKey].customers++;
          timelineMap[dateKey].revenue += Number(l.actualValue || 0);
        }
      }
    });
    const timeline = Object.values(timelineMap);
    res.json({
      period,
      startDate,
      endDate,
      overview: {
        totalLeads,
        totalCustomers,
        conversionRate,
        attributedRevenue,
        potentialPipelineValue,
        totalInvestment,
        cpl,
        cac,
        roas,
        changes
      },
      pipeline: {
        stages: pipelineByStage,
        avgConversionTimeDays
      },
      lostReasons,
      campaigns: campaignsPerformance,
      channels: channelPerformance,
      contentExecution: {
        planned: plannedContentCount,
        published: publishedContentCount,
        percentage: executionPercentage,
        distribution: channelContentDistribution
      },
      timeline
    });
  } catch (error) {
    console.error("Analytics Overview Error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch analytics" });
  }
});
analyticsRouter.get("/export", requireAuth, ensureBusinessOwnership4, async (req, res) => {
  const { businessId, period = "30d" } = req.query;
  try {
    const allLeads = await db.select().from(leads).where((0, import_drizzle_orm11.eq)(leads.businessId, businessId));
    let csvContent = "ID,Nome,Empresa,Email,Telefone,Status,Origem,Valor Potencial (R$),Valor Real (R$),Data Criacao,Data Conversao\n";
    allLeads.forEach((l) => {
      const name = `"${(l.name || "").replace(/"/g, '""')}"`;
      const company = `"${(l.companyName || "").replace(/"/g, '""')}"`;
      const email = `"${(l.email || "").replace(/"/g, '""')}"`;
      const phone = `"${(l.phone || "").replace(/"/g, '""')}"`;
      const created = l.createdAt ? new Date(l.createdAt).toISOString() : "";
      const converted = l.convertedAt ? new Date(l.convertedAt).toISOString() : "";
      csvContent += `${l.id},${name},${company},${email},${phone},${l.status},${l.source},${l.potentialValue || 0},${l.actualValue || 0},${created},${converted}
`;
    });
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename=analytics_export_${businessId}_${period}.csv`);
    res.send(csvContent);
  } catch (error) {
    console.error("Analytics Export Error:", error);
    res.status(500).json({ error: error.message });
  }
});
analyticsRouter.get("/insights", requireAuth, ensureBusinessOwnership4, async (req, res) => {
  const { businessId, period = "30d" } = req.query;
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.json({
        insights: [
          {
            title: "Foco no Fechamento de Propostas",
            observation: "O pipeline possui propostas em aberto com bom valor potencial.",
            recommended_action: "Priorize o follow-up direto com os tomadores de decis\xE3o.",
            confidence: "high"
          }
        ]
      });
    }
    const businessLeads = await db.select().from(leads).where((0, import_drizzle_orm11.eq)(leads.businessId, businessId));
    const totalLeads = businessLeads.length;
    const customers = businessLeads.filter((l) => l.status === "customer").length;
    const revenue = businessLeads.filter((l) => l.status === "customer").reduce((sum, l) => sum + Number(l.actualValue || 0), 0);
    const aggregated = {
      period,
      totalLeads,
      convertedCustomers: customers,
      attributedRevenue: revenue,
      sources: Array.from(new Set(businessLeads.map((l) => l.source)))
    };
    const ai = new import_genai3.GoogleGenAI({
      apiKey,
      httpOptions: { headers: { "User-Agent": "aistudio-build" } }
    });
    const prompt = `Voc\xEA \xE9 um analista de intelig\xEAncia de marketing e vendas.
Analise estes dados AGREGADOS:
${JSON.stringify(aggregated, null, 2)}

Forne\xE7a at\xE9 3 insights anal\xEDticos no seguinte schema JSON estrito:
{
  "insights": [
    {
      "title": "T\xEDtulo curto",
      "observation": "Observa\xE7\xE3o baseada nos dados",
      "recommended_action": "A\xE7\xE3o pr\xE1tica recomendada",
      "confidence": "high"
    }
  ]
}

Regras:
1. NUNCA invente causalidades n\xE3o comprovadas (ex: "Canal X gerou aumento de 20% nas vendas").
2. Seja totalmente factual e objetivo.
3. Idioma: Portugu\xEAs do Brasil.`;
    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });
    const parsed = JSON.parse(response.text || '{"insights": []}');
    res.json(parsed);
  } catch (error) {
    if (error?.status === 429 || error?.message?.includes("429") || error?.message?.includes("Quota exceeded")) {
      console.warn("AI Insights Rate Limit (429) hit, returning default analytics insights.");
      return res.json({
        insights: [
          {
            title: "Desempenho Comercial",
            observation: "O fluxo de prospec\xE7\xE3o e leads est\xE1 ativo no sistema.",
            recommended_action: "Acompanhe periodicamente as oportunidades e o engajamento com contatos prospectados.",
            confidence: "medium"
          }
        ]
      });
    }
    console.error("AI Insights Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// src/server/routes/prospecting.ts
var import_express8 = require("express");
var import_drizzle_orm13 = require("drizzle-orm");

// src/server/services/ProspectingService.ts
var import_drizzle_orm12 = require("drizzle-orm");

// src/server/services/BusinessDiscoveryProvider.ts
var geoapifyMemoryCache = /* @__PURE__ */ new Map();
var CACHE_TTL_MS = 15 * 60 * 1e3;
var GeoapifyBusinessDiscoveryProvider = class {
  constructor(apiKey) {
    this.name = "Geoapify Places API";
    this.apiKey = apiKey;
  }
  async searchBusinesses(params) {
    const city = params.city || "Goi\xE2nia";
    const state = params.state || "GO";
    const country = params.country || "Brasil";
    const segment = params.segment;
    const keywords = params.keywords || "";
    const targetLimit = Math.max(1, params.limit || 25);
    const cacheKey = `geoapify:${segment.toLowerCase().trim()}:${city.toLowerCase().trim()}:${state.toLowerCase().trim()}:${country.toLowerCase().trim()}:${keywords.toLowerCase().trim()}:${targetLimit}`;
    const cached = geoapifyMemoryCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.data;
    }
    const discovered = [];
    const seenSignatures = /* @__PURE__ */ new Set();
    const locationString = [city, state, country].filter(Boolean).join(", ");
    const textQuery = `${segment} ${keywords} ${locationString}`.trim();
    const pageSize = 50;
    let offset = 0;
    let keepFetching = true;
    while (keepFetching && discovered.length < targetLimit) {
      try {
        const fetchLimit = Math.min(pageSize, targetLimit - discovered.length);
        const searchUrl = `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(textQuery)}&limit=${fetchLimit}&offset=${offset}&apiKey=${this.apiKey}`;
        const res = await fetch(searchUrl);
        if (res.status === 429) {
          console.warn("Geoapify API Rate Limit hit (429). Returning collected results so far.");
          break;
        }
        if (!res.ok) {
          console.warn(`Geoapify Geocoding Search failed: ${res.status} ${res.statusText}`);
          break;
        }
        const data = await res.json();
        const features = data.features;
        if (!Array.isArray(features) || features.length === 0) {
          keepFetching = false;
          break;
        }
        let newAddedInBatch = 0;
        for (const feature of features) {
          const item = this.extractCompanyFromFeature(feature, segment, city, state, country);
          if (!item) continue;
          const sig = this.getDedupeSignature(item);
          if (!seenSignatures.has(sig)) {
            seenSignatures.add(sig);
            discovered.push(item);
            newAddedInBatch++;
            if (discovered.length >= targetLimit) {
              keepFetching = false;
              break;
            }
          }
        }
        if (features.length < fetchLimit || newAddedInBatch === 0) {
          keepFetching = false;
        }
        offset += fetchLimit;
        if (keepFetching && discovered.length < targetLimit) {
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
      } catch (err) {
        console.error("Error calling Geoapify API:", err);
        break;
      }
    }
    if (discovered.length < targetLimit) {
      try {
        const categoryFilter = this.mapSegmentToCategory(segment);
        const placesFetchLimit = Math.min(pageSize, targetLimit - discovered.length);
        const placesUrl = `https://api.geoapify.com/v2/places?categories=${categoryFilter}&filter=countrycode:${this.getCountryCode(country)}&limit=${placesFetchLimit}&apiKey=${this.apiKey}`;
        const placesRes = await fetch(placesUrl);
        if (placesRes.ok) {
          const placesData = await placesRes.json();
          if (Array.isArray(placesData.features)) {
            for (const feature of placesData.features) {
              const item = this.extractCompanyFromFeature(feature, segment, city, state, country);
              if (!item) continue;
              const sig = this.getDedupeSignature(item);
              if (!seenSignatures.has(sig)) {
                seenSignatures.add(sig);
                discovered.push(item);
                if (discovered.length >= targetLimit) break;
              }
            }
          }
        }
      } catch (err) {
        console.warn("Geoapify Places v2 fallback query skipped:", err);
      }
    }
    if (discovered.length > 0) {
      geoapifyMemoryCache.set(cacheKey, {
        timestamp: Date.now(),
        data: discovered
      });
    }
    return discovered;
  }
  extractCompanyFromFeature(feature, fallbackSegment, fallbackCity, fallbackState, fallbackCountry) {
    const props = feature.properties || {};
    const companyName = props.name || props.company || props.legal_name || props.address_line1;
    if (!companyName || typeof companyName !== "string" || companyName.trim().length === 0) {
      return null;
    }
    const city = props.city || props.municipality || props.county || fallbackCity;
    const state = props.state || props.state_code || fallbackState;
    const country = props.country || fallbackCountry;
    const description = props.formatted || [props.address_line1, props.address_line2].filter(Boolean).join(", ") || `Empresa do setor ${fallbackSegment} em ${city}`;
    const website = props.website || props.contact?.website || props.url || void 0;
    const phone = props.phone || props.contact?.phone || props.contact?.mobile || void 0;
    const legalName = props.legal_name || void 0;
    const resultType = props.result_type || props.place_type;
    const categories = props.categories || [];
    if (isInvalidBusinessName(companyName, resultType, categories, city, state, country)) {
      console.log(`[GEOAPIFY_FILTER_REJECTED] "${companyName}" rejected as non-business administrative place or city name`);
      return null;
    }
    console.log("[DIAGNOSTIC_GEOAPIFY_FEATURE]", JSON.stringify({
      companyName: companyName.trim(),
      rawCity: props.city || props.municipality || props.county,
      rawState: props.state || props.state_code,
      rawCountry: props.country,
      hasWebsite: !!website,
      websiteValue: website || null,
      hasPhone: !!phone,
      phoneValue: phone || null,
      availableKeys: Object.keys(props)
    }));
    const propsState = props.state || props.state_code;
    const propsCity = props.city || props.municipality || props.county;
    if (!matchesRequestedLocation(propsState, props.state_code, propsCity, fallbackState, fallbackCity)) {
      console.log(`[GEOAPIFY_FILTER_REJECTED] ${companyName} (${propsCity}, ${propsState}) does not match requested target (${fallbackCity}, ${fallbackState})`);
      return null;
    }
    return {
      companyName: companyName.trim(),
      legalName: legalName ? legalName.trim() : void 0,
      segment: fallbackSegment,
      description: description.trim(),
      city,
      state,
      country,
      website: website ? website.trim() : void 0,
      phone: phone ? phone.trim() : void 0,
      contactSource: "Geoapify Places API"
    };
  }
  getDedupeSignature(b) {
    const normName = b.companyName.toLowerCase().replace(/[^\w]/g, "");
    const normCity = (b.city || "").toLowerCase().replace(/[^\w]/g, "");
    const normWebsite = b.website ? b.website.toLowerCase().replace(/https?:\/\/(www\.)?/, "").split("/")[0] : "";
    if (normWebsite) return `domain:${normWebsite}`;
    return `name:${normName}:${normCity}`;
  }
  getCountryCode(country) {
    const lower = (country || "").toLowerCase();
    if (lower.includes("brasil") || lower.includes("brazil") || lower === "br") return "br";
    if (lower.includes("eua") || lower.includes("usa") || lower.includes("united states")) return "us";
    return "br";
  }
  mapSegmentToCategory(segment) {
    const lower = segment.toLowerCase();
    if (lower.includes("advoga") || lower.includes("jur\xEDd") || lower.includes("direito") || lower.includes("contab") || lower.includes("tecnologia") || lower.includes("ti") || lower.includes("consultor") || lower.includes("escrit\xF3r")) {
      return "office,office.lawyer,office.financial,office.it,office.company";
    }
    if (lower.includes("restaurante") || lower.includes("comida") || lower.includes("aliment") || lower.includes("bar") || lower.includes("caf\xE9")) {
      return "catering,catering.restaurant,catering.cafe";
    }
    if (lower.includes("sa\xFAde") || lower.includes("m\xE9dic") || lower.includes("hospital") || lower.includes("cl\xEDnica") || lower.includes("dentist")) {
      return "healthcare,healthcare.hospital,healthcare.clinic";
    }
    if (lower.includes("loja") || lower.includes("varejo") || lower.includes("com\xE9rcio") || lower.includes("mercado")) {
      return "commercial,commercial.supermarket,commercial.clothing";
    }
    return "office,commercial,service,catering,healthcare,building.commercial";
  }
};
var GooglePlacesDiscoveryProvider = class {
  constructor(apiKey) {
    this.name = "Google Places API";
    this.apiKey = apiKey;
  }
  async searchBusinesses(params) {
    const locationPart = [params.city, params.state, params.country].filter(Boolean).join(", ");
    const query = `${params.segment} ${params.keywords || ""} ${locationPart}`.trim();
    try {
      const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${this.apiKey}`;
      const res = await fetch(url);
      if (!res.ok) {
        console.warn("Google Places API call failed:", res.statusText);
        return [];
      }
      const data = await res.json();
      if (!data.results || !Array.isArray(data.results)) {
        return [];
      }
      const results = [];
      const places = data.results.slice(0, params.limit);
      for (const place of places) {
        let website = "";
        let phone = "";
        if (place.place_id) {
          try {
            const detailUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=name,website,formatted_phone_number,international_phone_number,types&key=${this.apiKey}`;
            const detailRes = await fetch(detailUrl);
            if (detailRes.ok) {
              const detailData = await detailRes.json();
              website = detailData.result?.website || "";
              phone = detailData.result?.formatted_phone_number || detailData.result?.international_phone_number || "";
            }
          } catch {
          }
        }
        results.push({
          companyName: place.name || "Empresa Sem Nome",
          segment: params.segment,
          description: place.formatted_address || place.vicinity || `Empresa do setor ${params.segment}`,
          city: params.city || "Goi\xE2nia",
          state: params.state || "GO",
          country: params.country || "Brasil",
          website: website || void 0,
          phone: phone || place.formatted_phone_number || void 0,
          contactSource: "Google Places API"
        });
      }
      return results;
    } catch (error) {
      console.error("Error in GooglePlacesDiscoveryProvider:", error);
      return [];
    }
  }
};
var LocalWebDiscoveryProvider = class {
  constructor() {
    this.name = "Diret\xF3rio P\xFAblico B2B (Modo Demo)";
  }
  async searchBusinesses(params) {
    const city = params.city || "Goi\xE2nia";
    const state = params.state || "GO";
    const country = params.country || "Brasil";
    const segment = params.segment;
    const mockCompanies = [
      {
        companyName: `${segment} Alfa Pro`,
        legalName: `${segment} Alfa Pro Servi\xE7os Ltda`,
        segment,
        description: `Empresa especializada em solu\xE7\xF5es completas para ${segment.toLowerCase()} em ${city}.`,
        city,
        state,
        country,
        website: `https://www.empresa-alfa-${slugify(segment)}.com.br`,
        phone: "(62) 3920-1100",
        contactSource: "Diret\xF3rio Comercial P\xFAblico"
      },
      {
        companyName: `Grupo Centro-Oeste ${segment}`,
        legalName: `Grupo Centro Oeste de ${segment} S.A.`,
        segment,
        description: `L\xEDder regional no fornecimento de servi\xE7os corporativos e atendimento para ${segment.toLowerCase()}.`,
        city,
        state,
        country,
        website: `https://www.grupocentrooeste-${slugify(segment)}.com.br`,
        phone: "(62) 3215-4400",
        contactSource: "Portal de Empresas do Estado"
      },
      {
        companyName: `Tech & Solu\xE7\xF5es ${segment}`,
        legalName: `Tech e Solu\xE7\xF5es em ${segment} Eireli`,
        segment,
        description: `Inova\xE7\xE3o e qualidade em ${segment.toLowerCase()} com equipe t\xE9cnica qualificada em ${city}.`,
        city,
        state,
        country,
        website: `https://www.techsolucoes-${slugify(segment)}.com.br`,
        phone: "(62) 99812-3344",
        contactSource: "Cadastro Empresarial P\xFAblico"
      },
      {
        companyName: `Excel\xEAncia em ${segment}`,
        legalName: `Excel\xEAncia Atendimento ${segment} Ltda`,
        segment,
        description: `Atendimento empresarial personalizado e consultoria para ${segment.toLowerCase()}.`,
        city,
        state,
        country,
        website: `https://www.excelencia-${slugify(segment)}.com.br`,
        phone: "(62) 3541-8890",
        contactSource: "Guia Comercial Regional"
      },
      {
        companyName: `Solu\xE7\xF5es Integradas ${segment}`,
        legalName: `Solu\xE7\xF5es Integradas ${segment} Brasil Ltda`,
        segment,
        description: `Infraestrutura corporativa e servi\xE7os especializados para empresas e profissionais de ${segment.toLowerCase()}.`,
        city,
        state,
        country,
        website: `https://www.solucoes-${slugify(segment)}.com.br`,
        phone: "(62) 3098-7711",
        contactSource: "Diret\xF3rio Comercial de ${city}"
      },
      {
        companyName: `Nova Era ${segment}`,
        legalName: `Nova Era Empreendimentos ${segment} Ltda`,
        segment,
        description: `Gest\xE3o de projetos e atendimento B2B em ${city} para o setor de ${segment.toLowerCase()}.`,
        city,
        state,
        country,
        website: `https://www.novaera-${slugify(segment)}.com.br`,
        phone: "(62) 3876-2233",
        contactSource: "Portal de Neg\xF3cios Brasil"
      }
    ];
    return mockCompanies.slice(0, Math.min(params.limit, mockCompanies.length));
  }
};
function slugify(text2) {
  return text2.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\w\s-]/g, "").replace(/\s+/g, "-");
}
function normalizeGeoString(str) {
  if (!str) return "";
  return str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\w\s]/gi, "").trim();
}
function matchesRequestedLocation(propsState, propsStateCode, propsCity, requestedState, requestedCity) {
  if (requestedState) {
    const normTargetState = normalizeGeoString(requestedState);
    const normPropsState = normalizeGeoString(propsState);
    const normPropsStateCode = normalizeGeoString(propsStateCode);
    const stateMap = {
      go: ["go", "goias"],
      sp: ["sp", "sao paulo"],
      rj: ["rj", "rio de janeiro"],
      mg: ["mg", "minas gerais"],
      pr: ["pr", "parana"],
      rs: ["rs", "rio grande do sul"],
      sc: ["sc", "santa catarina"],
      ba: ["ba", "bahia"],
      pe: ["pe", "pernambuco"],
      ce: ["ce", "ceara"],
      df: ["df", "distrito federal"],
      es: ["es", "espirito santo"],
      mt: ["mt", "mato grosso"],
      ms: ["ms", "mato grosso do sul"],
      pa: ["pa", "para"],
      am: ["am", "amazonas"]
    };
    const allowedVariants = stateMap[normTargetState] || [normTargetState];
    const stateMatches = allowedVariants.some((v) => normPropsState.includes(v) || normPropsStateCode === v);
    if ((propsState || propsStateCode) && !stateMatches) {
      return false;
    }
  }
  if (requestedCity) {
    const normTargetCity = normalizeGeoString(requestedCity);
    const normPropsCity = normalizeGeoString(propsCity);
    if (normPropsCity && normTargetCity && !normPropsCity.includes(normTargetCity) && !normTargetCity.includes(normPropsCity)) {
      return false;
    }
  }
  return true;
}
function isInvalidBusinessName(companyName, resultType, categories, city, state, country) {
  const normName = normalizeGeoString(companyName);
  if (!normName || normName.length < 2) return true;
  const invalidResultTypes = [
    "city",
    "county",
    "state",
    "country",
    "postcode",
    "administrative",
    "suburb",
    "district",
    "quarter",
    "neighbourhood",
    "locality"
  ];
  if (resultType && invalidResultTypes.includes(resultType.toLowerCase())) {
    return true;
  }
  if (city && normName === normalizeGeoString(city)) return true;
  if (state && normName === normalizeGeoString(state)) return true;
  if (country && normName === normalizeGeoString(country)) return true;
  const pureGeoNames = [
    "sao paulo",
    "goiania",
    "rio de janeiro",
    "brasil",
    "brasilia",
    "goias",
    "minas gerais",
    "bahia",
    "parana",
    "santa catarina",
    "rio grande do sul",
    "espirito santo",
    "mato grosso",
    "mato grosso do sul",
    "para",
    "amazonas",
    "ceara",
    "pernambuco"
  ];
  if (pureGeoNames.includes(normName)) {
    return true;
  }
  if (Array.isArray(categories)) {
    const isPureAdminCategory = categories.some(
      (c) => c.includes("administrative") || c.includes("political") || c.includes("place.city")
    ) && !categories.some(
      (c) => c.includes("commercial") || c.includes("service") || c.includes("catering") || c.includes("office") || c.includes("store") || c.includes("industrial")
    );
    if (isPureAdminCategory) return true;
  }
  return false;
}
function getDiscoveryProvider() {
  const geoapifyKey = process.env.GEOAPIFY_API_KEY;
  if (geoapifyKey && geoapifyKey.trim().length > 0 && geoapifyKey !== '""') {
    return new GeoapifyBusinessDiscoveryProvider(geoapifyKey.trim());
  }
  const googleKey = process.env.GOOGLE_PLACES_API_KEY;
  if (googleKey && googleKey.trim().length > 0 && googleKey !== '""') {
    return new GooglePlacesDiscoveryProvider(googleKey.trim());
  }
  return new LocalWebDiscoveryProvider();
}

// src/server/services/WebsiteDiscoveryService.ts
var import_url2 = require("url");

// src/server/services/WebsiteFetcher.ts
var import_promises = __toESM(require("dns/promises"), 1);
var import_url = require("url");
function isPrivateIp(ip) {
  const ipv4Match = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const [, a, b] = ipv4Match.map(Number);
    if (a === 127) return true;
    if (a === 10) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true;
    if (a === 0) return true;
  }
  if (ip === "::1" || ip === "0:0:0:0:0:0:0:1" || ip.toLowerCase().startsWith("fe80:")) {
    return true;
  }
  return false;
}
async function validateUrlForSSRF(targetUrl) {
  let parsed;
  try {
    parsed = new import_url.URL(targetUrl);
  } catch {
    throw new Error("Invalid URL format");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`Protocol '${parsed.protocol}' is not allowed. Only http and https are allowed.`);
  }
  const hostname = parsed.hostname;
  if (!hostname || hostname === "localhost") {
    throw new Error("Access to localhost is blocked for security");
  }
  try {
    const addresses = await import_promises.default.lookup(hostname, { all: true });
    for (const addr of addresses) {
      if (isPrivateIp(addr.address)) {
        throw new Error(`Access to private IP range (${addr.address}) is blocked`);
      }
    }
  } catch (err) {
    if (err.message?.includes("blocked")) throw err;
  }
  return parsed;
}
async function fetchPageHtml(targetUrl, timeoutMs = 6e3) {
  try {
    const validatedUrl = await validateUrlForSSRF(targetUrl);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const response = await fetch(validatedUrl.toString(), {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent": "MarketingOSBot/1.0 (+https://marketingos.app/b2b-prospecting)",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8"
      }
    });
    clearTimeout(timeoutId);
    if (response.url && response.url !== validatedUrl.toString()) {
      await validateUrlForSSRF(response.url);
    }
    if (!response.ok) {
      return { url: targetUrl, ok: false, status: response.status, error: `HTTP ${response.status}` };
    }
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html") && !contentType.includes("xhtml") && !contentType.includes("text/plain")) {
      return { url: targetUrl, ok: false, error: "Content-Type is not HTML" };
    }
    const reader = response.body?.getReader();
    if (!reader) {
      const rawText = await response.text();
      return { url: targetUrl, ok: true, status: response.status, html: cleanHtmlContent(rawText) };
    }
    let receivedLength = 0;
    const maxBytes = 2 * 1024 * 1024;
    const chunks = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        receivedLength += value.length;
        if (receivedLength > maxBytes) {
          reader.cancel();
          break;
        }
        chunks.push(value);
      }
    }
    const combined = new Uint8Array(receivedLength);
    let position = 0;
    for (const chunk of chunks) {
      combined.set(chunk, position);
      position += chunk.length;
    }
    const decoder = new TextDecoder("utf-8");
    const htmlText = decoder.decode(combined);
    return {
      url: targetUrl,
      ok: true,
      status: response.status,
      html: cleanHtmlContent(htmlText)
    };
  } catch (error) {
    return {
      url: targetUrl,
      ok: false,
      error: error.name === "AbortError" ? "Request timeout" : error.message || "Fetch failed"
    };
  }
}
function cleanHtmlContent(html) {
  return html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ").replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ").replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, " ").replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, " ").replace(/<!--[\s\S]*?-->/g, " ");
}

// src/server/services/WebsiteDiscoveryService.ts
var IGNORED_DOMAINS = [
  "facebook.com",
  "instagram.com",
  "linkedin.com",
  "twitter.com",
  "x.com",
  "youtube.com",
  "whatsapp.com",
  "google.com",
  "maps.google.com",
  "cnpj.biz",
  "econodata.com.br",
  "jusbrasil.com.br",
  "escavador.com",
  "reclameaqui.com.br",
  "guiamais.com.br",
  "apontador.com.br",
  "yellowpages.com",
  "infobel.com",
  "tripadvisor.com",
  "glassdoor.com",
  "wikipedia.org",
  "solutudo.com.br",
  "consultacnpj.com",
  "serasaexperian.com.br"
];
function processWebsiteUrl(rawWebsiteUrl) {
  if (!rawWebsiteUrl || rawWebsiteUrl.trim() === "") {
    return { confidence: "low" };
  }
  let cleanUrl = rawWebsiteUrl.trim();
  if (!cleanUrl.startsWith("http://") && !cleanUrl.startsWith("https://")) {
    cleanUrl = `https://${cleanUrl}`;
  }
  try {
    const parsed = new import_url2.URL(cleanUrl);
    parsed.search = "";
    parsed.hash = "";
    const hostname = parsed.hostname.toLowerCase();
    const domain = hostname.replace(/^www\./, "");
    if (IGNORED_DOMAINS.some((d) => domain.includes(d))) {
      return { confidence: "low" };
    }
    return {
      website: parsed.toString().replace(/\/$/, ""),
      // remove trailing slash
      domain,
      confidence: "high"
    };
  } catch {
    return { confidence: "low" };
  }
}
async function discoverOfficialWebsite(companyName, city, state, apiKey) {
  const normName = companyName.trim();
  const location = [city, state].filter(Boolean).join(" ");
  if (apiKey && apiKey.trim().length > 0 && apiKey !== '""') {
    try {
      const geoUrl = `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(`${normName} ${location}`)}&limit=3&apiKey=${apiKey}`;
      const res = await fetch(geoUrl);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.features)) {
          for (const feature of data.features) {
            const props = feature.properties || {};
            const site = props.website || props.contact?.website || props.url;
            if (site) {
              const processed = processWebsiteUrl(site);
              if (processed.website) {
                return { ...processed, source: "Geoapify Specific Geocode Lookup" };
              }
            }
          }
        }
      }
    } catch {
    }
  }
  const cleanSlug = normName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\w\s]/gi, "").replace(/\b(ltda|sa|eireli|me|epp|comercial|grupo|br)\b/gi, "").replace(/\s+/g, "").trim();
  if (cleanSlug.length >= 4 && cleanSlug.length <= 30) {
    const candidateDomains = [
      `https://www.${cleanSlug}.com.br`,
      `https://${cleanSlug}.com.br`,
      `https://www.${cleanSlug}.com`
    ];
    for (const candUrl of candidateDomains) {
      try {
        await validateUrlForSSRF(candUrl);
        const res = await fetchPageHtml(candUrl, 3e3);
        if (res.ok && res.html) {
          const processed = processWebsiteUrl(candUrl);
          if (processed.website && processed.domain) {
            return { ...processed, source: "Direto Dom\xEDnio Oficial" };
          }
        }
      } catch {
      }
    }
  }
  try {
    const ddgUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(`${normName} ${location}`)}&format=json&no_redirect=1&no_html=1`;
    const ddgRes = await fetch(ddgUrl, { headers: { "User-Agent": "MarketingOSBot/1.0" } });
    if (ddgRes.ok) {
      const ddgData = await ddgRes.json();
      const candidate = ddgData.AbstractURL || ddgData.Results && ddgData.Results[0]?.FirstURL;
      if (candidate) {
        const processed = processWebsiteUrl(candidate);
        if (processed.website) {
          return { ...processed, source: "DuckDuckGo Instant Answer API" };
        }
      }
    }
  } catch {
  }
  const searchQueries = [
    `${normName} ${location}`,
    `${normName} site oficial`
  ];
  for (const queryStr of searchQueries) {
    try {
      const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(queryStr)}`;
      const searchRes = await fetch(searchUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7"
        }
      });
      if (searchRes.ok) {
        const htmlText = await searchRes.text();
        const urlMatches = htmlText.match(/href=["'](\/l\/\?uddg=[^"']+|https?:\/\/[^"']+)["']/gi) || [];
        for (const matchStr of urlMatches) {
          let rawHref = matchStr.replace(/^href=["']/, "").replace(/["']$/, "");
          if (rawHref.startsWith("/l/?uddg=")) {
            const params = new URLSearchParams(rawHref.split("?")[1]);
            rawHref = params.get("uddg") || "";
          }
          if (rawHref && (rawHref.startsWith("http://") || rawHref.startsWith("https://"))) {
            const processed = processWebsiteUrl(rawHref);
            if (processed.website && processed.domain) {
              try {
                await validateUrlForSSRF(processed.website);
                return { ...processed, source: "Public Web Discovery Engine" };
              } catch {
              }
            }
          }
        }
      }
    } catch {
    }
  }
  return { confidence: "low" };
}

// src/server/services/ContactValidator.ts
var COMMERCIAL_PATTERNS = [/comercial/i, /vendas/i, /sales/i, /negocios/i, /b2b/i, /propostas/i];
var SUPPORT_PATTERNS = [/atendimento/i, /suporte/i, /support/i, /sac/i, /ajuda/i, /help/i];
var GENERAL_PATTERNS = [/contato/i, /contact/i, /faleconosco/i, /fale-conosco/i, /atendimento/i, /hello/i, /info/i, /institucional/i];
var PERSONAL_PATTERNS = [/^[a-z]+\.[a-z]+@/i, /^[a-z]+_\.[a-z]+@/i];
function classifyEmailType(email) {
  const cleanEmail = email.trim().toLowerCase();
  const [localPart, domain] = cleanEmail.split("@");
  if (!localPart || !domain) return "unknown";
  for (const pattern of COMMERCIAL_PATTERNS) {
    if (pattern.test(localPart)) return "commercial";
  }
  for (const pattern of SUPPORT_PATTERNS) {
    if (pattern.test(localPart)) return "support";
  }
  for (const pattern of GENERAL_PATTERNS) {
    if (pattern.test(localPart)) return "general";
  }
  if (PERSONAL_PATTERNS.some((p) => p.test(cleanEmail))) {
    return "personal";
  }
  return "unknown";
}
function getEmailPriorityRank(type) {
  switch (type) {
    case "commercial":
      return 1;
    case "general":
      return 2;
    case "support":
      return 3;
    case "unknown":
      return 4;
    case "personal":
      return 5;
    default:
      return 6;
  }
}
function isValidEmailFormat(email) {
  if (!email || email.length > 254) return false;
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  if (!emailRegex.test(email)) return false;
  if (/\.(png|jpg|jpeg|gif|svg|webp|css|js)$/i.test(email)) return false;
  return true;
}
function sanitizePhone(phone) {
  return phone.replace(/[^\d+]/g, "").trim();
}
function calculateConfidence(sourceUrl, officialDomain, emailType) {
  const urlLower = sourceUrl.toLowerCase();
  const isContactPage = urlLower.includes("/contato") || urlLower.includes("/contact") || urlLower.includes("/fale-conosco") || urlLower.includes("/sobre") || urlLower.includes("/about");
  if (isContactPage && (emailType === "commercial" || emailType === "general")) {
    return "high";
  }
  if (isContactPage) {
    return "high";
  }
  if (officialDomain && urlLower.includes(officialDomain.toLowerCase())) {
    return "medium";
  }
  return "low";
}

// src/server/services/PublicContactExtractor.ts
function extractContactsFromHtml(html, sourceUrl, officialDomain) {
  const contactsMap = /* @__PURE__ */ new Map();
  const contactPageUrlsSet = /* @__PURE__ */ new Set();
  if (!html) return { contacts: [], contactPageUrls: [] };
  const hrefRegex = /href=["']([^"']+)["']/gi;
  let match;
  while ((match = hrefRegex.exec(html)) !== null) {
    const link = match[1]?.trim();
    if (!link) continue;
    if (/(\/contato|\/contact|\/fale-conosco|\/faleconosco|\/sobre|\/about|\/atendimento|\/comercial)/i.test(link)) {
      try {
        const fullUrl = new URL(link, sourceUrl).toString();
        if (fullUrl.startsWith("http://") || fullUrl.startsWith("https://")) {
          contactPageUrlsSet.add(fullUrl);
        }
      } catch {
      }
    }
    if (link.toLowerCase().startsWith("mailto:")) {
      const emailMatch = link.replace(/^mailto:/i, "").split("?")[0].trim();
      if (isValidEmailFormat(emailMatch)) {
        addEmailContact(emailMatch, sourceUrl, officialDomain, contactsMap, "mailto link");
      }
    }
    if (link.toLowerCase().startsWith("tel:")) {
      const phoneVal = link.replace(/^tel:/i, "").trim();
      const sanitized = sanitizePhone(phoneVal);
      if (sanitized.length >= 8) {
        addPhoneContact(sanitized, "phone", sourceUrl, officialDomain, contactsMap, "tel link");
      }
    }
    if (/wa\.me\/|api\.whatsapp\.com\/send/i.test(link)) {
      const waPhoneMatch = link.match(/(?:phone=|wa\.me\/)(\+?\d{8,15})/i);
      if (waPhoneMatch && waPhoneMatch[1]) {
        const sanitized = sanitizePhone(waPhoneMatch[1]);
        addPhoneContact(sanitized, "whatsapp", sourceUrl, officialDomain, contactsMap, "WhatsApp link");
      }
    }
  }
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
  const rawEmails = html.match(emailRegex) || [];
  for (const rawEmail of rawEmails) {
    const cleanEmail = rawEmail.trim().toLowerCase();
    if (isValidEmailFormat(cleanEmail)) {
      addEmailContact(cleanEmail, sourceUrl, officialDomain, contactsMap, "Public text");
    }
  }
  const obfuscatedEmailRegex = /\b([A-Za-z0-9._%+-]+)\s*(?:\[at\]|\(at\)|\b\[em\]\b|\b\(em\)\b|@)\s*([A-Za-z0-9.-]+(?:\s*(?:\[dot\]|\(dot\)|\.)\s*[A-Za-z0-9.-]+)+)\b/gi;
  let obfMatch;
  while ((obfMatch = obfuscatedEmailRegex.exec(html)) !== null) {
    const userPart = obfMatch[1];
    let domainPart = obfMatch[2].replace(/\s*\[dot\]\s*|\s*\(dot\)\s*/gi, ".").replace(/\s+/g, "");
    const reconstructedEmail = `${userPart}@${domainPart}`.toLowerCase();
    if (isValidEmailFormat(reconstructedEmail)) {
      addEmailContact(reconstructedEmail, sourceUrl, officialDomain, contactsMap, "Obfuscated text");
    }
  }
  const jsonLdRegex = /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let jsonLdMatch;
  while ((jsonLdMatch = jsonLdRegex.exec(html)) !== null) {
    const jsonContent = jsonLdMatch[1];
    if (jsonContent) {
      const foundInJson = jsonContent.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g) || [];
      for (const emailStr of foundInJson) {
        if (isValidEmailFormat(emailStr)) {
          addEmailContact(emailStr.toLowerCase(), sourceUrl, officialDomain, contactsMap, "JSON-LD Metadata");
        }
      }
      const foundPhones = jsonContent.match(/(?:\+55\s?)?(?:\(?\d{2}\)?\s?)?(?:9?\d{4}[-.\s]?\d{4})\b/g) || [];
      for (const phoneStr of foundPhones) {
        const sanitized = sanitizePhone(phoneStr);
        if (sanitized.length >= 10 && sanitized.length <= 13) {
          addPhoneContact(sanitized, "phone", sourceUrl, officialDomain, contactsMap, "JSON-LD Metadata");
        }
      }
    }
  }
  const metaRegex = /<meta\b[^>]*content=["']([^"']+)["'][^>]*>/gi;
  let metaMatch;
  while ((metaMatch = metaRegex.exec(html)) !== null) {
    const metaVal = metaMatch[1];
    if (metaVal) {
      const emailsInMeta = metaVal.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g) || [];
      for (const em of emailsInMeta) {
        if (isValidEmailFormat(em)) {
          addEmailContact(em.toLowerCase(), sourceUrl, officialDomain, contactsMap, "Meta tags");
        }
      }
    }
  }
  const phoneRegex = /(?:\+55\s?)?(?:\(?\d{2}\)?\s?)?(?:9?\d{4}[-.\s]?\d{4})\b/g;
  const rawPhones = html.match(phoneRegex) || [];
  for (const rawPhone of rawPhones) {
    const sanitized = sanitizePhone(rawPhone);
    if (sanitized.length >= 10 && sanitized.length <= 13) {
      addPhoneContact(sanitized, "phone", sourceUrl, officialDomain, contactsMap, "Public text");
    }
  }
  const contacts = Array.from(contactsMap.values());
  const contactPageUrls = Array.from(contactPageUrlsSet);
  return { contacts, contactPageUrls };
}
function addEmailContact(email, sourceUrl, officialDomain, contactsMap, sourceLabel) {
  const emailType = classifyEmailType(email);
  const confidence = calculateConfidence(sourceUrl, officialDomain, emailType);
  const key = `email:${email.toLowerCase()}`;
  if (!contactsMap.has(key)) {
    contactsMap.set(key, {
      type: "email",
      value: email.toLowerCase(),
      emailType,
      label: sourceLabel,
      sourceUrl,
      confidence
    });
  }
}
function addPhoneContact(phone, type, sourceUrl, officialDomain, contactsMap, sourceLabel) {
  const confidence = calculateConfidence(sourceUrl, officialDomain);
  const key = `${type}:${phone}`;
  if (!contactsMap.has(key)) {
    contactsMap.set(key, {
      type,
      value: phone,
      label: sourceLabel,
      sourceUrl,
      confidence
    });
  }
}
function selectPrimaryContacts(contacts) {
  const emails = contacts.filter((c) => c.type === "email");
  const phones = contacts.filter((c) => c.type === "phone" || c.type === "whatsapp");
  emails.sort((a, b) => {
    const rankA = getEmailPriorityRank(a.emailType || "unknown");
    const rankB = getEmailPriorityRank(b.emailType || "unknown");
    if (rankA !== rankB) return rankA - rankB;
    const confOrder = { high: 1, medium: 2, low: 3 };
    return confOrder[a.confidence] - confOrder[b.confidence];
  });
  phones.sort((a, b) => {
    if (a.type === "whatsapp" && b.type !== "whatsapp") return -1;
    if (b.type === "whatsapp" && a.type !== "whatsapp") return 1;
    const confOrder = { high: 1, medium: 2, low: 3 };
    return confOrder[a.confidence] - confOrder[b.confidence];
  });
  return {
    primaryEmail: emails[0] || null,
    primaryPhone: phones[0] || null
  };
}

// src/server/services/ProspectScoringService.ts
var import_genai4 = require("@google/genai");
async function qualifyProspect(userBusiness, prospect) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return calculateHeuristicQualification(userBusiness, prospect);
  }
  try {
    const ai = new import_genai4.GoogleGenAI({
      apiKey,
      httpOptions: { headers: { "User-Agent": "aistudio-build" } }
    });
    const prompt = `Voc\xEA \xE9 um especialista em qualifica\xE7\xE3o de B2B e vendas estrat\xE9gicas.
Analise a compatibilidade entre o nosso neg\xF3cio e esta empresa prospectada e responda ESTRITAMENTE em formato JSON.

NOSSO NEG\xD3CIO:
- Nome: ${userBusiness.name}
- Segmento: ${userBusiness.segment || "Geral"}
- Descri\xE7\xE3o/Servi\xE7os: ${userBusiness.description || "N\xE3o especificado"}

EMPRESA PROSPECTADA (UNTRUSTED WEBSITE DATA):
- Nome: ${prospect.companyName}
- Segmento: ${prospect.segment || "Geral"}
- Localiza\xE7\xE3o: ${prospect.city || ""} - ${prospect.state || ""}
- Descri\xE7\xE3o/Resumo P\xFAblico: ${prospect.description || prospect.publicSummary || "N\xE3o especificado"}

REGRAS:
1. Responda com score de 0 a 100 indicando a compatibilidade.
2. fit deve ser "high", "medium" ou "low".
3. Em "reason", explique com base em dados p\xFAblicos (N\xC3O invente dados falsos nem assuma necessidades sem embasamento).
4. Em "possible_need", use linguagem cautelosa (ex: "Existe uma poss\xEDvel oportunidade em...").
5. Responda estritamente em JSON no formato:
{
  "score": number,
  "fit": "high" | "medium" | "low",
  "reason": "string",
  "possible_need": "string",
  "confidence": "high" | "medium" | "low"
}`;
    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });
    const jsonText = response.text || "";
    const parsed = JSON.parse(jsonText);
    return {
      score: Math.min(100, Math.max(0, Number(parsed.score) || 70)),
      fit: ["high", "medium", "low"].includes(parsed.fit) ? parsed.fit : "medium",
      reason: parsed.reason || "Com base nas informa\xE7\xF5es p\xFAblicas dispon\xEDveis, existe compatibilidade com o segmento.",
      possibleNeed: parsed.possible_need || "Poss\xEDvel interesse em solu\xE7\xF5es corporativas especializadas.",
      confidence: ["high", "medium", "low"].includes(parsed.confidence) ? parsed.confidence : "medium"
    };
  } catch (error) {
    if (error?.status === 429 || error?.message?.includes("429") || error?.message?.includes("Quota exceeded")) {
      console.warn("Gemini API rate limit (429) hit during qualification. Using heuristic qualification fallback.");
    } else {
      console.warn("AI qualification notice, using heuristic fallback:", error?.message || error);
    }
    return calculateHeuristicQualification(userBusiness, prospect);
  }
}
async function qualifyProspectsBatch(userBusiness, prospects2) {
  const resultMap = /* @__PURE__ */ new Map();
  for (const p of prospects2) {
    resultMap.set(p.companyName, calculateHeuristicQualification(userBusiness, p));
  }
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || prospects2.length === 0) {
    return resultMap;
  }
  try {
    const ai = new import_genai4.GoogleGenAI({
      apiKey,
      httpOptions: { headers: { "User-Agent": "aistudio-build" } }
    });
    const prospectListText = prospects2.map((p, idx) => `
[PROSPECT ${idx + 1}]
- Nome: ${p.companyName}
- Segmento: ${p.segment || "Geral"}
- Localiza\xE7\xE3o: ${p.city || ""} - ${p.state || ""}
- Descri\xE7\xE3o: ${p.description || p.publicSummary || "N\xE3o especificado"}
`).join("\n");
    const prompt = `Voc\xEA \xE9 um especialista em qualifica\xE7\xE3o de B2B e vendas estrat\xE9gicas.
Analise a compatibilidade entre o nosso neg\xF3cio e a lista de empresas prospectadas e responda ESTRITAMENTE em formato JSON.

NOSSO NEG\xD3CIO:
- Nome: ${userBusiness.name}
- Segmento: ${userBusiness.segment || "Geral"}
- Descri\xE7\xE3o/Servi\xE7os: ${userBusiness.description || "N\xE3o especificado"}

EMPRESAS PROSPECTADAS:
${prospectListText}

REGRAS:
1. Para CADA empresa na lista, forne\xE7a uma avalia\xE7\xE3o com score (0 a 100), fit ("high", "medium", "low"), raz\xE3o breve ("reason"), poss\xEDvel necessidade ("possible_need") e confian\xE7a ("confidence").
2. Responda ESTRITAMENTE no formato JSON:
{
  "qualifications": [
    {
      "companyName": "Nome da Empresa",
      "score": number,
      "fit": "high" | "medium" | "low",
      "reason": "string",
      "possible_need": "string",
      "confidence": "high" | "medium" | "low"
    }
  ]
}`;
    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });
    const parsed = JSON.parse(response.text || "{}");
    const items = Array.isArray(parsed.qualifications) ? parsed.qualifications : Array.isArray(parsed) ? parsed : [];
    for (const item of items) {
      if (!item || !item.companyName) continue;
      const matchingProspect = prospects2.find(
        (p) => p.companyName.toLowerCase().trim() === String(item.companyName).toLowerCase().trim()
      );
      const key = matchingProspect ? matchingProspect.companyName : item.companyName;
      resultMap.set(key, {
        score: Math.min(100, Math.max(0, Number(item.score) || 70)),
        fit: ["high", "medium", "low"].includes(item.fit) ? item.fit : "medium",
        reason: item.reason || "Com base nas informa\xE7\xF5es p\xFAblicas dispon\xEDveis, existe compatibilidade com o segmento.",
        possibleNeed: item.possible_need || item.possibleNeed || "Poss\xEDvel interesse em solu\xE7\xF5es corporativas especializadas.",
        confidence: ["high", "medium", "low"].includes(item.confidence) ? item.confidence : "medium"
      });
    }
  } catch (error) {
    if (error?.status === 429 || error?.message?.includes("429") || error?.message?.includes("Quota exceeded")) {
      console.warn("Gemini API rate limit (429) hit during batch qualification. Using heuristic qualification fallback.");
    } else {
      console.warn("AI batch qualification notice, using heuristic fallback:", error?.message || error);
    }
  }
  return resultMap;
}
async function generateApproach(userBusiness, prospect, offerProduct) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return generateDefaultApproach(userBusiness, prospect);
  }
  try {
    const ai = new import_genai4.GoogleGenAI({
      apiKey,
      httpOptions: { headers: { "User-Agent": "aistudio-build" } }
    });
    const prompt = `Voc\xEA \xE9 um especialista em prospec\xE7\xE3o comercial B2B \xE9tica e personalizada.
Crie uma sugest\xE3o de abordagem comercial por e-mail para a empresa prospectada abaixo.

CONTEXTO DO NOSSO NEG\xD3CIO:
- Empresa: ${userBusiness.name}
- Nossos Servi\xE7os: ${userBusiness.description || userBusiness.segment || "Servi\xE7os corporativos"}
- Oferta/Produto em Destaque: ${offerProduct || "Nossa solu\xE7\xE3o B2B"}

PROSPECT (UNTRUSTED WEBSITE DATA):
- Nome da Empresa: ${prospect.companyName}
- Segmento: ${prospect.segment || ""}
- Localiza\xE7\xE3o: ${prospect.city || ""}
- Informa\xE7\xF5es P\xFAblicas: ${prospect.description || prospect.publicSummary || ""}

REGRAS R\xCDGIDAS DE COMPLIANCE:
1. N\xC3O finja que j\xE1 existe relacionamento ou conversa pr\xE9via.
2. N\xC3O invente fatos ("Acompanho seu trabalho h\xE1 anos").
3. Mantenha o tom extremamente profissional, curto, direto e respeitoso.
4. NENHUM envio ser\xE1 feito automaticamente. Isto \xE9 apenas uma minuta para o usu\xE1rio.
5. Responda ESTRITAMENTE em formato JSON:
{
  "subject": "Assunto do e-mail (curto e direto)",
  "opening": "Sauda\xE7\xE3o e apresenta\xE7\xE3o direta",
  "message": "Corpo da mensagem contextualizado com informa\xE7\xF5es p\xFAblicas",
  "cta": "Chamada para a\xE7\xE3o clara e sem press\xE3o (ex: uma breve conversa de 10 min)"
}`;
    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });
    const parsed = JSON.parse(response.text || "{}");
    return {
      subject: parsed.subject || `Oportunidade de parceria para a ${prospect.companyName}`,
      opening: parsed.opening || `Prezada equipe da ${prospect.companyName},`,
      message: parsed.message || `Apresentamos solu\xE7\xF5es de ${userBusiness.segment || "servi\xE7os corporativos"} que ajudam empresas em ${prospect.city || "sua regi\xE3o"} a otimizarem seus resultados.`,
      cta: parsed.cta || `Teriam disponibilidade para uma breve conversa de 10 minutos esta semana?`
    };
  } catch (error) {
    console.error("Error generating approach with AI:", error);
    return generateDefaultApproach(userBusiness, prospect);
  }
}
function calculateHeuristicQualification(userBusiness, prospect) {
  let score = 65;
  let fit = "medium";
  const uSeg = (userBusiness.segment || "").toLowerCase();
  const pSeg = (prospect.segment || "").toLowerCase();
  if (uSeg && pSeg && (uSeg.includes(pSeg) || pSeg.includes(uSeg))) {
    score += 20;
    fit = "high";
  }
  if (prospect.city) score += 10;
  if (prospect.website) score += 5;
  score = Math.min(100, score);
  return {
    score,
    fit,
    reason: `Empresa atuante no segmento ${prospect.segment || "alvo"} em ${prospect.city || "sua regi\xE3o"}, alinhada ao perfil B2B desejado.`,
    possibleNeed: `Poss\xEDvel interesse na contrata\xE7\xE3o de servi\xE7os de ${userBusiness.segment || "otimiza\xE7\xE3o comercial"}.`,
    confidence: "medium"
  };
}
function generateDefaultApproach(userBusiness, prospect) {
  return {
    subject: `Apresenta\xE7\xE3o comercial e parceria \u2014 ${prospect.companyName}`,
    opening: `Prezada equipe comercial da ${prospect.companyName},`,
    message: `A ${userBusiness.name} atua na \xE1rea de ${userBusiness.segment || "servi\xE7os especializados"} e identificamos o perfil p\xFAblico da ${prospect.companyName} como potencial parceiro em ${prospect.city || "sua regi\xE3o"}.`,
    cta: `Gostar\xEDamos de agendar uma r\xE1pida conversa de 10 minutos para apresentar nosso portf\xF3lio. Seria poss\xEDvel essa semana?`
  };
}

// src/server/services/ProspectingService.ts
var ProspectingService = class {
  /**
   * Creates a new search job and executes company discovery & public contact extraction.
   */
  static async executeSearch(input) {
    const limit = input.requestedLimit || 25;
    const [searchRecord] = await db.insert(prospectingSearches).values({
      organizationId: input.organizationId,
      businessId: input.businessId,
      userId: input.userId,
      segment: input.segment,
      city: input.city,
      state: input.state,
      country: input.country || "Brasil",
      radiusKm: input.radiusKm,
      keywords: input.keywords,
      requestedLimit: limit,
      status: "running"
    }).returning();
    const [businessData] = await db.select().from(businesses).where((0, import_drizzle_orm12.eq)(businesses.id, input.businessId)).limit(1);
    const userBusinessCtx = {
      name: businessData?.name || "Sua Empresa",
      segment: businessData?.segment || input.segment,
      description: businessData?.description || ""
    };
    try {
      const provider = getDiscoveryProvider();
      const discoveredCompanies = await provider.searchBusinesses({
        segment: input.segment,
        city: input.city,
        state: input.state,
        country: input.country || "Brasil",
        keywords: input.keywords,
        limit
      });
      let totalFound = discoveredCompanies.length;
      let totalWithEmail = 0;
      let totalWithPhone = 0;
      const batchProspectContexts = discoveredCompanies.map((c) => ({
        companyName: c.companyName,
        segment: c.segment,
        city: c.city,
        state: c.state,
        description: c.description,
        website: c.website,
        publicSummary: c.description
      }));
      const batchQualificationsMap = await qualifyProspectsBatch(userBusinessCtx, batchProspectContexts);
      for (const rawCompany of discoveredCompanies) {
        const preCalculatedQualification = batchQualificationsMap.get(rawCompany.companyName);
        await this.processSingleProspect({
          searchId: searchRecord.id,
          organizationId: input.organizationId,
          businessId: input.businessId,
          rawCompany,
          userBusinessCtx,
          preCalculatedQualification
        });
      }
      const createdProspects = await db.select().from(prospects).where((0, import_drizzle_orm12.eq)(prospects.searchId, searchRecord.id));
      totalWithEmail = createdProspects.filter((p) => !!p.email).length;
      totalWithPhone = createdProspects.filter((p) => !!p.phone).length;
      await db.update(prospectingSearches).set({
        status: "completed",
        totalFound,
        totalWithEmail,
        totalWithPhone,
        completedAt: /* @__PURE__ */ new Date(),
        updatedAt: /* @__PURE__ */ new Date()
      }).where((0, import_drizzle_orm12.eq)(prospectingSearches.id, searchRecord.id));
      return {
        searchId: searchRecord.id,
        totalFound,
        totalWithEmail,
        totalWithPhone
      };
    } catch (error) {
      console.error("Error executing prospecting search:", error);
      await db.update(prospectingSearches).set({
        status: "failed",
        updatedAt: /* @__PURE__ */ new Date()
      }).where((0, import_drizzle_orm12.eq)(prospectingSearches.id, searchRecord.id));
      throw error;
    }
  }
  /**
   * Processes a single discovered company: site discovery, public contact crawling, deduplication, scoring.
   */
  static async processSingleProspect(params) {
    const { searchId, organizationId, businessId, rawCompany, userBusinessCtx, preCalculatedQualification } = params;
    console.log("[PROSPECT_LOG] business_discovered:", JSON.stringify({
      companyName: rawCompany.companyName,
      city: rawCompany.city,
      state: rawCompany.state,
      providerWebsite: rawCompany.website || null,
      providerPhone: rawCompany.phone || null
    }));
    let finalWebsite = rawCompany.website;
    let contactSource = rawCompany.contactSource || "Geoapify Places API";
    if (finalWebsite) {
      console.log("[PROSPECT_LOG] website_from_provider:", JSON.stringify({
        companyName: rawCompany.companyName,
        website: finalWebsite
      }));
    } else {
      console.log("[PROSPECT_LOG] website_discovery_attempted:", JSON.stringify({
        companyName: rawCompany.companyName,
        city: rawCompany.city,
        state: rawCompany.state
      }));
      const geoapifyKey = process.env.GEOAPIFY_API_KEY;
      const secondaryDiscovery = await discoverOfficialWebsite(
        rawCompany.companyName,
        rawCompany.city,
        rawCompany.state,
        geoapifyKey
      );
      if (secondaryDiscovery.website) {
        finalWebsite = secondaryDiscovery.website;
        contactSource = secondaryDiscovery.source || "Estrat\xE9gia Secund\xE1ria de Descoberta";
        console.log("[PROSPECT_LOG] website_discovered:", JSON.stringify({
          companyName: rawCompany.companyName,
          url: finalWebsite,
          source: contactSource
        }));
      } else {
        console.log("[PROSPECT_LOG] website_discovery_completed:", JSON.stringify({
          companyName: rawCompany.companyName,
          status: "no_official_website_found",
          info: "No official website found across search strategies"
        }));
      }
    }
    const websiteInfo = processWebsiteUrl(finalWebsite);
    const domain = websiteInfo.domain || "";
    if (domain) {
      const existing = await db.select().from(prospects).where((0, import_drizzle_orm12.and)((0, import_drizzle_orm12.eq)(prospects.businessId, businessId), (0, import_drizzle_orm12.eq)(prospects.domain, domain))).limit(1);
      if (existing.length > 0) {
        return existing[0];
      }
    }
    const extractedContactsList = [];
    const scannedUrls = [];
    let websiteStatus = "no_website_found";
    let fetchAttemptedCount = 0;
    let fetchBlockedCount = 0;
    let fetchSuccessCount = 0;
    if (websiteInfo.website) {
      console.log("[PROSPECT_LOG] contact_extraction_started:", JSON.stringify({
        companyName: rawCompany.companyName,
        websiteUrl: websiteInfo.website
      }));
      try {
        const baseObj = new URL(websiteInfo.website);
        const subPaths = ["", "/contato", "/contact", "/fale-conosco", "/sobre", "/about", "/atendimento", "/comercial"];
        const targetUrlsToScan = subPaths.map((p) => `${baseObj.origin}${p}`);
        const uniqueTargetUrls = Array.from(new Set(targetUrlsToScan));
        for (const targetUrl of uniqueTargetUrls) {
          fetchAttemptedCount++;
          try {
            const pageRes = await fetchPageHtml(targetUrl, 5e3);
            if (pageRes.ok && pageRes.html) {
              fetchSuccessCount++;
              scannedUrls.push(targetUrl);
              const extracted = extractContactsFromHtml(pageRes.html, targetUrl, domain);
              extractedContactsList.push(...extracted.contacts);
            } else {
              if (pageRes.status === 403 || pageRes.status === 401 || pageRes.status === 429) {
                fetchBlockedCount++;
              }
              console.log("[PROSPECT_LOG] extraction_error:", JSON.stringify({
                companyName: rawCompany.companyName,
                pageUrl: targetUrl,
                error: pageRes.error || `HTTP ${pageRes.status}`
              }));
            }
          } catch (fetchErr) {
            console.log("[PROSPECT_LOG] extraction_error:", JSON.stringify({
              companyName: rawCompany.companyName,
              pageUrl: targetUrl,
              error: fetchErr.message || "Network error"
            }));
          }
          if (extractedContactsList.some((c) => c.type === "email")) {
            break;
          }
        }
      } catch (urlErr) {
        console.log("[PROSPECT_LOG] extraction_error:", JSON.stringify({
          companyName: rawCompany.companyName,
          pageUrl: websiteInfo.website,
          error: "Invalid URL object"
        }));
      }
      console.log("[PROSPECT_LOG] pages_scanned:", JSON.stringify({
        companyName: rawCompany.companyName,
        pagesCount: scannedUrls.length,
        pages: scannedUrls
      }));
      const emailsFound = extractedContactsList.filter((c) => c.type === "email");
      const phonesFound = extractedContactsList.filter((c) => c.type === "phone" || c.type === "whatsapp");
      console.log("[PROSPECT_LOG] emails_found:", JSON.stringify({
        companyName: rawCompany.companyName,
        count: emailsFound.length,
        emails: emailsFound.map((e) => e.value)
      }));
      console.log("[PROSPECT_LOG] phones_found:", JSON.stringify({
        companyName: rawCompany.companyName,
        count: phonesFound.length,
        phones: phonesFound.map((p) => p.value)
      }));
      if (extractedContactsList.length > 0) {
        websiteStatus = "contact_found";
      } else if (fetchSuccessCount > 0) {
        websiteStatus = "website_found_no_contact";
      } else if (fetchBlockedCount > 0) {
        websiteStatus = "blocked_by_site";
      } else {
        websiteStatus = "fetch_failed";
      }
    } else {
      websiteStatus = "no_website_found";
    }
    const primary = selectPrimaryContacts(extractedContactsList);
    const email = primary.primaryEmail?.value || void 0;
    const emailType = primary.primaryEmail?.emailType || void 0;
    const phone = primary.primaryPhone?.value || rawCompany.phone || void 0;
    const sourceUrl = primary.primaryEmail?.sourceUrl || primary.primaryPhone?.sourceUrl || websiteInfo.website || void 0;
    let existingCrmLeadId = null;
    if (email) {
      const existingLeads = await db.select().from(leads).where((0, import_drizzle_orm12.and)((0, import_drizzle_orm12.eq)(leads.businessId, businessId), (0, import_drizzle_orm12.ilike)(leads.email, email))).limit(1);
      if (existingLeads.length > 0) {
        existingCrmLeadId = existingLeads[0].id;
      }
    }
    const qualification = preCalculatedQualification || await qualifyProspect(userBusinessCtx, {
      companyName: rawCompany.companyName,
      segment: rawCompany.segment,
      city: rawCompany.city,
      state: rawCompany.state,
      description: rawCompany.description,
      website: websiteInfo.website,
      publicSummary: rawCompany.description || ""
    });
    const prospectStatus = existingCrmLeadId ? "imported" : qualification.fit === "high" ? "qualified" : "new";
    const [insertedProspect] = await db.insert(prospects).values({
      organizationId,
      businessId,
      searchId,
      companyName: rawCompany.companyName,
      legalName: rawCompany.legalName,
      segment: rawCompany.segment,
      description: rawCompany.description,
      city: rawCompany.city,
      state: rawCompany.state,
      country: rawCompany.country,
      website: websiteInfo.website,
      domain,
      phone,
      email,
      emailType,
      websiteStatus,
      sourceUrl,
      contactSource,
      confidence: primary.primaryEmail?.confidence || websiteInfo.confidence || "medium",
      qualificationScore: qualification.score,
      qualificationReason: qualification.reason,
      qualificationFit: qualification.fit,
      possibleNeed: qualification.possibleNeed,
      status: prospectStatus,
      crmLeadId: existingCrmLeadId
    }).returning();
    if (extractedContactsList.length > 0) {
      const contactRows = extractedContactsList.slice(0, 15).map((c) => ({
        prospectId: insertedProspect.id,
        type: c.type,
        value: c.value,
        label: c.label,
        sourceUrl: c.sourceUrl || sourceUrl || websiteInfo.website,
        confidence: c.confidence,
        isPrimary: c.value === email || c.value === phone
      }));
      await db.insert(prospectContacts).values(contactRows);
    }
    return insertedProspect;
  }
  /**
   * Imports selected prospects into the CRM `leads` table with origin 'prospecting'.
   */
  static async importProspectsToCRM(businessId, organizationId, prospectIds) {
    if (!prospectIds || prospectIds.length === 0) return { importedCount: 0, leads: [] };
    const targetProspects = await db.select().from(prospects).where((0, import_drizzle_orm12.and)(
      (0, import_drizzle_orm12.eq)(prospects.businessId, businessId),
      (0, import_drizzle_orm12.inArray)(prospects.id, prospectIds)
    ));
    const createdLeads = [];
    for (const prospect of targetProspects) {
      if (prospect.crmLeadId) {
        continue;
      }
      if (prospect.email) {
        const existingLeads = await db.select().from(leads).where((0, import_drizzle_orm12.and)((0, import_drizzle_orm12.eq)(leads.businessId, businessId), (0, import_drizzle_orm12.ilike)(leads.email, prospect.email))).limit(1);
        if (existingLeads.length > 0) {
          await db.update(prospects).set({ crmLeadId: existingLeads[0].id, status: "imported", updatedAt: /* @__PURE__ */ new Date() }).where((0, import_drizzle_orm12.eq)(prospects.id, prospect.id));
          continue;
        }
      }
      const notes = `Origem: Prospec\xE7\xE3o B2B
Fonte do Contato: ${prospect.sourceUrl || prospect.contactSource || "Publicamente disponibilizado"}
Score de Qualifica\xE7\xE3o: ${prospect.qualificationScore || 0}/100
Justificativa: ${prospect.qualificationReason || ""}
Poss\xEDvel Necessidade: ${prospect.possibleNeed || ""}`;
      const [newLead] = await db.insert(leads).values({
        organizationId,
        businessId,
        name: prospect.companyName,
        companyName: prospect.companyName,
        email: prospect.email || `contato@${prospect.domain || "prospect.com"}`,
        phone: prospect.phone || "",
        source: "prospecting",
        status: "new",
        potentialValue: 0,
        notes
      }).returning();
      await db.update(prospects).set({
        crmLeadId: newLead.id,
        status: "imported",
        updatedAt: /* @__PURE__ */ new Date()
      }).where((0, import_drizzle_orm12.eq)(prospects.id, prospect.id));
      createdLeads.push(newLead);
    }
    return {
      importedCount: createdLeads.length,
      leads: createdLeads
    };
  }
  /**
   * Generates a CSV string export for selected or all prospects in a business.
   */
  static async exportProspectsCSV(businessId, prospectIds) {
    let query = db.select().from(prospects).where((0, import_drizzle_orm12.eq)(prospects.businessId, businessId));
    if (prospectIds && prospectIds.length > 0) {
      query = db.select().from(prospects).where(
        (0, import_drizzle_orm12.and)((0, import_drizzle_orm12.eq)(prospects.businessId, businessId), (0, import_drizzle_orm12.inArray)(prospects.id, prospectIds))
      );
    }
    const items = await query;
    const headers = [
      "Empresa",
      "Segmento",
      "Cidade",
      "Estado",
      "Website",
      "E-mail",
      "Tipo de E-mail",
      "Telefone",
      "Score Qualificacao",
      "Status",
      "Fonte de Origem"
    ];
    const rows = items.map((p) => [
      `"${(p.companyName || "").replace(/"/g, '""')}"`,
      `"${(p.segment || "").replace(/"/g, '""')}"`,
      `"${(p.city || "").replace(/"/g, '""')}"`,
      `"${(p.state || "").replace(/"/g, '""')}"`,
      `"${(p.website || "").replace(/"/g, '""')}"`,
      `"${(p.email || "").replace(/"/g, '""')}"`,
      `"${(p.emailType || "").replace(/"/g, '""')}"`,
      `"${(p.phone || "").replace(/"/g, '""')}"`,
      p.qualificationScore || 0,
      `"${p.status}"`,
      `"${(p.sourceUrl || p.contactSource || "").replace(/"/g, '""')}"`
    ].join(","));
    return [headers.join(","), ...rows].join("\n");
  }
};

// src/server/routes/prospecting.ts
var prospectingRouter = (0, import_express8.Router)();
var ensureBusinessOwnership5 = async (req, res, next) => {
  const businessId = req.query.businessId || req.body.businessId;
  const user = req.user;
  if (!businessId) return res.status(400).json({ error: "Missing businessId parameter" });
  const dbUser = await db.query.users.findFirst({
    where: (0, import_drizzle_orm13.eq)(users.uid, user.uid)
  });
  if (!dbUser) return res.status(401).json({ error: "User not found in DB" });
  const business = await db.query.businesses.findFirst({
    where: (0, import_drizzle_orm13.eq)(businesses.id, businessId),
    with: { organization: { with: { members: true } } }
  });
  if (!business) return res.status(404).json({ error: "Business not found" });
  const isMember = business.organization.members.some((m) => m.userId === dbUser.id);
  if (!isMember) return res.status(403).json({ error: "Unauthorized access to business" });
  req.dbUser = dbUser;
  req.business = business;
  next();
};
prospectingRouter.post("/search", requireAuth, ensureBusinessOwnership5, async (req, res) => {
  try {
    const { segment, city, state, country, radiusKm, keywords, requestedLimit } = req.body;
    if (!segment || !segment.trim()) {
      return res.status(400).json({ error: "Segmento \xE9 obrigat\xF3rio para realizar a busca." });
    }
    const searchResult = await ProspectingService.executeSearch({
      organizationId: req.business.organizationId,
      businessId: req.business.id,
      userId: req.dbUser.id,
      segment: segment.trim(),
      city: city?.trim(),
      state: state?.trim(),
      country: country?.trim() || "Brasil",
      radiusKm: radiusKm ? Number(radiusKm) : void 0,
      keywords: keywords?.trim(),
      requestedLimit: requestedLimit ? Number(requestedLimit) : 25
    });
    res.json(searchResult);
  } catch (error) {
    console.error("Error starting prospecting search:", error);
    res.status(500).json({ error: error.message || "Falha ao executar busca de prospec\xE7\xE3o." });
  }
});
prospectingRouter.get("/searches", requireAuth, ensureBusinessOwnership5, async (req, res) => {
  try {
    const searches = await db.select().from(prospectingSearches).where((0, import_drizzle_orm13.eq)(prospectingSearches.businessId, req.business.id)).orderBy((0, import_drizzle_orm13.desc)(prospectingSearches.createdAt));
    res.json({ searches });
  } catch (error) {
    console.error("Error fetching prospecting searches:", error);
    res.status(500).json({ error: "Falha ao carregar hist\xF3rico de buscas." });
  }
});
prospectingRouter.get("/searches/:searchId", requireAuth, ensureBusinessOwnership5, async (req, res) => {
  try {
    const { searchId } = req.params;
    const [searchRecord] = await db.select().from(prospectingSearches).where((0, import_drizzle_orm13.and)(
      (0, import_drizzle_orm13.eq)(prospectingSearches.id, searchId),
      (0, import_drizzle_orm13.eq)(prospectingSearches.businessId, req.business.id)
    )).limit(1);
    if (!searchRecord) {
      return res.status(404).json({ error: "Busca de prospec\xE7\xE3o n\xE3o encontrada." });
    }
    const prospectList = await db.select().from(prospects).where((0, import_drizzle_orm13.and)(
      (0, import_drizzle_orm13.eq)(prospects.searchId, searchId),
      (0, import_drizzle_orm13.eq)(prospects.businessId, req.business.id)
    )).orderBy((0, import_drizzle_orm13.desc)(prospects.qualificationScore));
    res.json({ search: searchRecord, prospects: prospectList });
  } catch (error) {
    console.error("Error fetching search details:", error);
    res.status(500).json({ error: "Falha ao carregar detalhes da busca." });
  }
});
prospectingRouter.get("/prospects", requireAuth, ensureBusinessOwnership5, async (req, res) => {
  try {
    const { hasEmail, hasPhone, hasWebsite, status, search, fit } = req.query;
    const conditions = [(0, import_drizzle_orm13.eq)(prospects.businessId, req.business.id)];
    if (hasEmail === "true") {
      conditions.push(import_drizzle_orm13.sql`${prospects.email} IS NOT NULL AND ${prospects.email} != ''`);
    }
    if (hasPhone === "true") {
      conditions.push(import_drizzle_orm13.sql`${prospects.phone} IS NOT NULL AND ${prospects.phone} != ''`);
    }
    if (hasWebsite === "true") {
      conditions.push(import_drizzle_orm13.sql`${prospects.website} IS NOT NULL AND ${prospects.website} != ''`);
    }
    if (status) {
      conditions.push((0, import_drizzle_orm13.eq)(prospects.status, status));
    }
    if (fit) {
      conditions.push((0, import_drizzle_orm13.eq)(prospects.qualificationFit, fit));
    }
    if (search && typeof search === "string" && search.trim() !== "") {
      const q = `%${search.trim()}%`;
      conditions.push((0, import_drizzle_orm13.or)(
        (0, import_drizzle_orm13.ilike)(prospects.companyName, q),
        (0, import_drizzle_orm13.ilike)(prospects.city, q),
        (0, import_drizzle_orm13.ilike)(prospects.email, q),
        (0, import_drizzle_orm13.ilike)(prospects.website, q)
      ));
    }
    const prospectList = await db.select().from(prospects).where((0, import_drizzle_orm13.and)(...conditions)).orderBy((0, import_drizzle_orm13.desc)(prospects.qualificationScore), (0, import_drizzle_orm13.desc)(prospects.createdAt));
    res.json({ prospects: prospectList });
  } catch (error) {
    console.error("Error listing prospects:", error);
    res.status(500).json({ error: "Falha ao carregar lista de prospects." });
  }
});
prospectingRouter.get("/prospects/:id", requireAuth, ensureBusinessOwnership5, async (req, res) => {
  try {
    const { id } = req.params;
    const [prospectRecord] = await db.select().from(prospects).where((0, import_drizzle_orm13.and)(
      (0, import_drizzle_orm13.eq)(prospects.id, id),
      (0, import_drizzle_orm13.eq)(prospects.businessId, req.business.id)
    )).limit(1);
    if (!prospectRecord) {
      return res.status(404).json({ error: "Prospect n\xE3o encontrado." });
    }
    const contactsList = await db.select().from(prospectContacts).where((0, import_drizzle_orm13.eq)(prospectContacts.prospectId, id));
    res.json({ prospect: prospectRecord, contacts: contactsList });
  } catch (error) {
    console.error("Error fetching prospect details:", error);
    res.status(500).json({ error: "Falha ao carregar detalhes do prospect." });
  }
});
prospectingRouter.post("/prospects/:id/qualify", requireAuth, ensureBusinessOwnership5, async (req, res) => {
  try {
    const { id } = req.params;
    const [prospectRecord] = await db.select().from(prospects).where((0, import_drizzle_orm13.and)(
      (0, import_drizzle_orm13.eq)(prospects.id, id),
      (0, import_drizzle_orm13.eq)(prospects.businessId, req.business.id)
    )).limit(1);
    if (!prospectRecord) {
      return res.status(404).json({ error: "Prospect n\xE3o encontrado." });
    }
    const qualification = await qualifyProspect(
      {
        name: req.business.name,
        segment: req.business.segment || void 0,
        description: req.business.description || void 0
      },
      {
        companyName: prospectRecord.companyName,
        segment: prospectRecord.segment || void 0,
        city: prospectRecord.city || void 0,
        state: prospectRecord.state || void 0,
        description: prospectRecord.description || void 0,
        website: prospectRecord.website || void 0
      }
    );
    const [updated] = await db.update(prospects).set({
      qualificationScore: qualification.score,
      qualificationReason: qualification.reason,
      qualificationFit: qualification.fit,
      possibleNeed: qualification.possibleNeed,
      status: qualification.fit === "high" ? "qualified" : prospectRecord.status,
      updatedAt: /* @__PURE__ */ new Date()
    }).where((0, import_drizzle_orm13.eq)(prospects.id, id)).returning();
    res.json({ prospect: updated, qualification });
  } catch (error) {
    console.error("Error qualifying prospect:", error);
    res.status(500).json({ error: "Falha ao qualificar prospect." });
  }
});
prospectingRouter.post("/prospects/:id/generate-approach", requireAuth, ensureBusinessOwnership5, async (req, res) => {
  try {
    const { id } = req.params;
    const { offerProduct } = req.body;
    const [prospectRecord] = await db.select().from(prospects).where((0, import_drizzle_orm13.and)(
      (0, import_drizzle_orm13.eq)(prospects.id, id),
      (0, import_drizzle_orm13.eq)(prospects.businessId, req.business.id)
    )).limit(1);
    if (!prospectRecord) {
      return res.status(404).json({ error: "Prospect n\xE3o encontrado." });
    }
    const approach = await generateApproach(
      {
        name: req.business.name,
        segment: req.business.segment || void 0,
        description: req.business.description || void 0
      },
      {
        companyName: prospectRecord.companyName,
        segment: prospectRecord.segment || void 0,
        city: prospectRecord.city || void 0,
        description: prospectRecord.description || void 0,
        website: prospectRecord.website || void 0
      },
      offerProduct
    );
    res.json({ approach });
  } catch (error) {
    console.error("Error generating approach:", error);
    res.status(500).json({ error: "Falha ao gerar proposta de abordagem." });
  }
});
prospectingRouter.post("/prospects/import", requireAuth, ensureBusinessOwnership5, async (req, res) => {
  try {
    const { prospectIds } = req.body;
    if (!Array.isArray(prospectIds) || prospectIds.length === 0) {
      return res.status(400).json({ error: "Nenhum prospect selecionado para importa\xE7\xE3o." });
    }
    const result = await ProspectingService.importProspectsToCRM(
      req.business.id,
      req.business.organizationId,
      prospectIds
    );
    res.json(result);
  } catch (error) {
    console.error("Error importing prospects to CRM:", error);
    res.status(500).json({ error: "Falha ao importar prospects para o CRM." });
  }
});
prospectingRouter.post("/prospects/export", requireAuth, ensureBusinessOwnership5, async (req, res) => {
  try {
    const { prospectIds } = req.body;
    const csvData = await ProspectingService.exportProspectsCSV(
      req.business.id,
      Array.isArray(prospectIds) ? prospectIds : void 0
    );
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="prospects.csv"');
    res.send(csvData);
  } catch (error) {
    console.error("Error exporting prospects CSV:", error);
    res.status(500).json({ error: "Falha ao exportar CSV de prospects." });
  }
});

// src/server/app.ts
dotenv2.config();
var app = (0, import_express9.default)();
app.use(import_express9.default.json());
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});
app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "E-mail e senha s\xE3o obrigat\xF3rios." });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "A senha deve ter pelo menos 6 caracteres." });
    }
    const { user, business } = await registerUserInDB(name || "", email, password);
    const token = import_jsonwebtoken2.default.sign(
      { userId: user.id, uid: user.uid, email: user.email },
      JWT_SECRET_KEY,
      { expiresIn: "30d" }
    );
    res.json({ token, user, business });
  } catch (error) {
    console.error("Register error:", error);
    res.status(400).json({ error: error.message || "Falha ao registrar usu\xE1rio." });
  }
});
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "E-mail e senha s\xE3o obrigat\xF3rios." });
    }
    const { user, business } = await loginUserInDB(email, password);
    const token = import_jsonwebtoken2.default.sign(
      { userId: user.id, uid: user.uid, email: user.email },
      JWT_SECRET_KEY,
      { expiresIn: "30d" }
    );
    res.json({ token, user, business });
  } catch (error) {
    console.error("Login error:", error);
    res.status(401).json({ error: error.message || "Falha ao realizar login." });
  }
});
app.get("/api/auth/me", requireAuth, async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "N\xE3o autenticado." });
    const result = await getUserById(req.user.userId);
    if (!result) return res.status(404).json({ error: "Usu\xE1rio n\xE3o encontrado." });
    res.json(result);
  } catch (error) {
    console.error("Failed to get current user:", error);
    res.status(500).json({ error: error.message || "Erro no servidor." });
  }
});
app.post("/api/auth/sync", requireAuth, async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "No user" });
    const { user, business } = await getOrCreateUserAndBusiness(req.user.uid, req.user.email || "");
    res.json({ user, business });
  } catch (error) {
    console.error("Failed to sync user:", error);
    res.status(500).json({ error: error.message || "Failed to sync user" });
  }
});
app.use("/api/onboarding", onboardingRouter);
app.use("/api/strategy", strategyRouter);
app.use("/api/content", contentRouter);
app.use("/api/campaigns", campaignRouter);
app.use("/api/leads", leadsRouter);
app.use("/api/recommendations", recommendationsRouter);
app.use("/api/analytics", analyticsRouter);
app.use("/api/prospecting", prospectingRouter);
app.use("/api", (req, res) => {
  res.status(404).json({ error: "API Route not found: " + req.method + " " + req.url });
});

// src/vercel-handler.ts
var app2 = (0, import_express10.default)();
app2.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,PATCH,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  next();
});
app2.use(import_express10.default.json({ limit: "4mb" }));
var JWT_SECRET = process.env.JWT_SECRET || "mkt-agro-bw-secret-key-2026";
var DATABASE_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL;
function createPool2() {
  if (!DATABASE_URL) throw new Error("DATABASE_URL n\xE3o configurado na Vercel.");
  return new import_pg2.Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 2,
    connectionTimeoutMillis: 8e3,
    idleTimeoutMillis: 5e3
  });
}
app2.get("/api/health", (_req, res) => {
  res.json({ ok: true, time: (/* @__PURE__ */ new Date()).toISOString(), hasDb: !!DATABASE_URL });
});
app2.post("/api/auth/login", async (req, res) => {
  const pool2 = createPool2();
  try {
    const { email, password } = req.body ?? {};
    if (!email || !password) return res.status(400).json({ error: "E-mail e senha s\xE3o obrigat\xF3rios." });
    const { rows } = await pool2.query("SELECT * FROM users WHERE email = $1 LIMIT 1", [String(email).trim().toLowerCase()]);
    const user = rows[0];
    if (!user?.password_hash) return res.status(401).json({ error: "E-mail ou senha incorretos." });
    if (!await import_bcryptjs2.default.compare(String(password), user.password_hash)) return res.status(401).json({ error: "E-mail ou senha incorretos." });
    const member = await pool2.query("SELECT organization_id FROM organization_members WHERE user_id = $1 LIMIT 1", [user.id]);
    let business = null;
    if (member.rows[0]) {
      const biz = await pool2.query("SELECT * FROM businesses WHERE organization_id = $1 LIMIT 1", [member.rows[0].organization_id]);
      business = biz.rows[0] ?? null;
    }
    const token = import_jsonwebtoken3.default.sign({ userId: user.id, uid: user.uid, email: user.email }, JWT_SECRET, { expiresIn: "30d" });
    const { password_hash, ...safeUser } = user;
    res.json({ token, user: safeUser, business });
  } catch (e) {
    console.error("[login]", e.message);
    res.status(500).json({ error: e.message });
  } finally {
    pool2.end().catch(() => {
    });
  }
});
app2.post("/api/auth/register", async (req, res) => {
  const pool2 = createPool2();
  try {
    const { name, email, password } = req.body ?? {};
    if (!email || !password) return res.status(400).json({ error: "E-mail e senha s\xE3o obrigat\xF3rios." });
    if (String(password).length < 6) return res.status(400).json({ error: "A senha deve ter pelo menos 6 caracteres." });
    const emailNorm = String(email).trim().toLowerCase();
    if ((await pool2.query("SELECT id FROM users WHERE email = $1", [emailNorm])).rows[0])
      return res.status(400).json({ error: "J\xE1 existe um usu\xE1rio com este e-mail." });
    const hash = await import_bcryptjs2.default.hash(String(password), 10);
    const uid = `user_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const { rows: [newUser] } = await pool2.query(
      "INSERT INTO users (uid, email, name, password_hash) VALUES ($1,$2,$3,$4) RETURNING *",
      [uid, emailNorm, name || "", hash]
    );
    const { rows: [org] } = await pool2.query("INSERT INTO organizations (name) VALUES ($1) RETURNING *", [`Empresa de ${name || emailNorm.split("@")[0]}`]);
    await pool2.query("INSERT INTO organization_members (user_id, organization_id, role) VALUES ($1,$2,$3)", [newUser.id, org.id, "owner"]);
    const { rows: [business] } = await pool2.query("INSERT INTO businesses (organization_id, name) VALUES ($1,$2) RETURNING *", [org.id, "Neg\xF3cio Principal"]);
    const token = import_jsonwebtoken3.default.sign({ userId: newUser.id, uid: newUser.uid, email: newUser.email }, JWT_SECRET, { expiresIn: "30d" });
    const { password_hash, ...safeUser } = newUser;
    res.json({ token, user: safeUser, business });
  } catch (e) {
    console.error("[register]", e.message);
    res.status(400).json({ error: e.message });
  } finally {
    pool2.end().catch(() => {
    });
  }
});
app2.get("/api/auth/me", async (req, res) => {
  const pool2 = createPool2();
  try {
    const h = req.headers.authorization;
    if (!h?.startsWith("Bearer ")) return res.status(401).json({ error: "N\xE3o autenticado." });
    let decoded;
    try {
      decoded = import_jsonwebtoken3.default.verify(h.split("Bearer ")[1], JWT_SECRET);
    } catch {
      return res.status(401).json({ error: "Token inv\xE1lido." });
    }
    const { rows } = await pool2.query("SELECT * FROM users WHERE id = $1 LIMIT 1", [decoded.userId]);
    if (!rows[0]) return res.status(404).json({ error: "Usu\xE1rio n\xE3o encontrado." });
    const user = rows[0];
    const member = await pool2.query("SELECT organization_id FROM organization_members WHERE user_id = $1 LIMIT 1", [user.id]);
    let business = null;
    if (member.rows[0]) {
      const biz = await pool2.query("SELECT * FROM businesses WHERE organization_id = $1 LIMIT 1", [member.rows[0].organization_id]);
      business = biz.rows[0] ?? null;
    }
    const { password_hash, ...safeUser } = user;
    res.json({ user: safeUser, business });
  } catch (e) {
    console.error("[me]", e.message);
    res.status(500).json({ error: e.message });
  } finally {
    pool2.end().catch(() => {
    });
  }
});
app2.post("/api/auth/sync", (_req, res) => res.json({ ok: true }));
app2.use((req, res, next) => {
  app(req, res, next);
});
var vercel_handler_default = app2;
