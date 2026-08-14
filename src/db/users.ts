import { db } from './index.ts';
import { users, organizations, organizationMembers, businesses } from './schema.ts';
import { eq } from 'drizzle-orm';

export async function getOrCreateUserAndBusiness(uid: string, email: string) {
  return await db.transaction(async (tx) => {
    // 1. Get or create user
    let user = await tx.select().from(users).where(eq(users.uid, uid)).limit(1).then(res => res[0]);
    if (!user) {
      user = await tx.insert(users).values({ uid, email }).returning().then(res => res[0]);
    } else if (user.email !== email) {
      user = await tx.update(users).set({ email }).where(eq(users.id, user.id)).returning().then(res => res[0]);
    }

    // 2. Check for organization membership
    const membership = await tx.select()
      .from(organizationMembers)
      .where(eq(organizationMembers.userId, user.id))
      .limit(1)
      .then(res => res[0]);

    let orgId: string;
    if (!membership) {
      // Create new organization
      const orgName = `Empresa de ${email.split('@')[0]}`;
      const org = await tx.insert(organizations).values({ name: orgName }).returning().then(res => res[0]);
      orgId = org.id;
      // Add user as owner
      await tx.insert(organizationMembers).values({
        userId: user.id,
        organizationId: org.id,
        role: 'owner'
      });
    } else {
      orgId = membership.organizationId;
    }

    // 3. Get or create primary business
    let business = await tx.select()
      .from(businesses)
      .where(eq(businesses.organizationId, orgId))
      .limit(1)
      .then(res => res[0]);

    if (!business) {
      business = await tx.insert(businesses).values({
        organizationId: orgId,
        name: `Negócio Principal`,
      }).returning().then(res => res[0]);
    }

    return { user, business };
  });
}
