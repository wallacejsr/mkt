import { db } from './index.ts';
import { users, organizations, organizationMembers, businesses } from './schema.ts';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

export async function registerUserInDB(name: string, email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();
  
  // Check if user exists
  const existingUser = await db.select().from(users).where(eq(users.email, normalizedEmail)).limit(1).then(res => res[0]);
  if (existingUser) {
    throw new Error('Já existe um usuário cadastrado com este e-mail.');
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const uid = `user_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  return await db.transaction(async (tx) => {
    // 1. Insert user
    const newUser = await tx.insert(users).values({
      uid,
      email: normalizedEmail,
      name,
      passwordHash,
    }).returning().then(res => res[0]);

    // 2. Create default Organization
    const orgName = name ? `Empresa de ${name}` : `Empresa de ${normalizedEmail.split('@')[0]}`;
    const org = await tx.insert(organizations).values({ name: orgName }).returning().then(res => res[0]);

    // 3. Add user as owner
    await tx.insert(organizationMembers).values({
      userId: newUser.id,
      organizationId: org.id,
      role: 'owner'
    });

    // 4. Create primary Business
    const business = await tx.insert(businesses).values({
      organizationId: org.id,
      name: `Negócio Principal`,
    }).returning().then(res => res[0]);

    const { passwordHash: _, ...userWithoutPassword } = newUser;
    return { user: userWithoutPassword, business };
  });
}

export async function loginUserInDB(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();
  
  const user = await db.select().from(users).where(eq(users.email, normalizedEmail)).limit(1).then(res => res[0]);
  if (!user || !user.passwordHash) {
    throw new Error('E-mail ou senha incorretos.');
  }

  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
  if (!isPasswordValid) {
    throw new Error('E-mail ou senha incorretos.');
  }

  const { user: syncedUser, business } = await getOrCreateUserAndBusiness(user.uid, user.email);
  const { passwordHash: _, ...userWithoutPassword } = user;

  return { user: userWithoutPassword, business };
}

export async function getUserById(userId: string) {
  const user = await db.select().from(users).where(eq(users.id, userId)).limit(1).then(res => res[0]);
  if (!user) return null;

  const { passwordHash: _, ...userWithoutPassword } = user;
  
  const membership = await db.select()
    .from(organizationMembers)
    .where(eq(organizationMembers.userId, user.id))
    .limit(1)
    .then(res => res[0]);

  let business = null;
  if (membership) {
    business = await db.select()
      .from(businesses)
      .where(eq(businesses.organizationId, membership.organizationId))
      .limit(1)
      .then(res => res[0]);
  }

  return { user: userWithoutPassword, business };
}

export async function getOrCreateUserAndBusiness(uid: string, email: string) {
  return await db.transaction(async (tx) => {
    let user = await tx.select().from(users).where(eq(users.uid, uid)).limit(1).then(res => res[0]);
    if (!user) {
      user = await tx.insert(users).values({ uid, email }).returning().then(res => res[0]);
    } else if (user.email !== email) {
      user = await tx.update(users).set({ email }).where(eq(users.id, user.id)).returning().then(res => res[0]);
    }

    const membership = await tx.select()
      .from(organizationMembers)
      .where(eq(organizationMembers.userId, user.id))
      .limit(1)
      .then(res => res[0]);

    let orgId: string;
    if (!membership) {
      const orgName = `Empresa de ${email.split('@')[0]}`;
      const org = await tx.insert(organizations).values({ name: orgName }).returning().then(res => res[0]);
      orgId = org.id;
      await tx.insert(organizationMembers).values({
        userId: user.id,
        organizationId: org.id,
        role: 'owner'
      });
    } else {
      orgId = membership.organizationId;
    }

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

    const { passwordHash: _, ...userWithoutPassword } = user;
    return { user: userWithoutPassword, business };
  });
}
