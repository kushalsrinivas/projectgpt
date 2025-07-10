import { relations, sql } from "drizzle-orm";
import { index, pgTableCreator, primaryKey } from "drizzle-orm/pg-core";
import type { AdapterAccount } from "next-auth/adapters";

/**
 * This is an example of how to use the multi-project schema feature of Drizzle ORM. Use the same
 * database instance for multiple projects.
 *
 * @see https://orm.drizzle.team/docs/goodies#multi-project-schema
 */
export const createTable = pgTableCreator((name) => `projectgpt_${name}`);

export const posts = createTable(
	"post",
	(d) => ({
		id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
		name: d.varchar({ length: 256 }),
		createdById: d
			.varchar({ length: 255 })
			.notNull()
			.references(() => users.id),
		createdAt: d
			.timestamp({ withTimezone: true })
			.default(sql`CURRENT_TIMESTAMP`)
			.notNull(),
		updatedAt: d.timestamp({ withTimezone: true }).$onUpdate(() => new Date()),
	}),
	(t) => [
		index("created_by_idx").on(t.createdById),
		index("name_idx").on(t.name),
	],
);

export const users = createTable("user", (d) => ({
	id: d
		.varchar({ length: 255 })
		.notNull()
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	name: d.varchar({ length: 255 }),
	email: d.varchar({ length: 255 }).notNull(),
	emailVerified: d
		.timestamp({
			mode: "date",
			withTimezone: true,
		})
		.default(sql`CURRENT_TIMESTAMP`),
	image: d.varchar({ length: 255 }),
	tier: d.varchar({ length: 20 }).default("free").notNull(), // 'free' or 'pro'
	createdAt: d
		.timestamp({ withTimezone: true })
		.default(sql`CURRENT_TIMESTAMP`)
		.notNull(),
}));

export const userQuotas = createTable("user_quota", (d) => ({
	id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
	userId: d
		.varchar({ length: 255 })
		.notNull()
		.references(() => users.id),
	requestsUsed: d.integer().default(0).notNull(),
	tokensUsed: d.integer().default(0).notNull(),
	lastReset: d
		.timestamp({ withTimezone: true })
		.default(sql`CURRENT_TIMESTAMP`)
		.notNull(),
	createdAt: d
		.timestamp({ withTimezone: true })
		.default(sql`CURRENT_TIMESTAMP`)
		.notNull(),
	updatedAt: d.timestamp({ withTimezone: true }).$onUpdate(() => new Date()),
}), (t) => [
	index("user_quota_user_id_idx").on(t.userId),
]);

export const chatMessages = createTable("chat_message", (d) => ({
	id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
	userId: d
		.varchar({ length: 255 })
		.references(() => users.id), // Made nullable for guest messages
	conversationId: d.varchar({ length: 255 }).notNull(),
	guestSessionId: d.varchar({ length: 255 }), // For guest message tracking
	role: d.varchar({ length: 20 }).notNull(), // 'user' or 'assistant'
	content: d.text().notNull(),
	model: d.varchar({ length: 100 }),
	tokensUsed: d.integer().default(0).notNull(),
	createdAt: d
		.timestamp({ withTimezone: true })
		.default(sql`CURRENT_TIMESTAMP`)
		.notNull(),
}), (t) => [
	index("chat_message_user_id_idx").on(t.userId),
	index("chat_message_conversation_id_idx").on(t.conversationId),
	index("chat_message_guest_session_id_idx").on(t.guestSessionId),
]);

export const usersRelations = relations(users, ({ many, one }) => ({
	accounts: many(accounts),
	quota: one(userQuotas, { fields: [users.id], references: [userQuotas.userId] }),
	chatMessages: many(chatMessages),
}));

export const userQuotasRelations = relations(userQuotas, ({ one }) => ({
	user: one(users, { fields: [userQuotas.userId], references: [users.id] }),
}));

export const chatMessagesRelations = relations(chatMessages, ({ one }) => ({
	user: one(users, { fields: [chatMessages.userId], references: [users.id] }),
}));

export const accounts = createTable(
	"account",
	(d) => ({
		userId: d
			.varchar({ length: 255 })
			.notNull()
			.references(() => users.id),
		type: d.varchar({ length: 255 }).$type<AdapterAccount["type"]>().notNull(),
		provider: d.varchar({ length: 255 }).notNull(),
		providerAccountId: d.varchar({ length: 255 }).notNull(),
		refresh_token: d.text(),
		access_token: d.text(),
		expires_at: d.integer(),
		token_type: d.varchar({ length: 255 }),
		scope: d.varchar({ length: 255 }),
		id_token: d.text(),
		session_state: d.varchar({ length: 255 }),
	}),
	(t) => [
		primaryKey({ columns: [t.provider, t.providerAccountId] }),
		index("account_user_id_idx").on(t.userId),
	],
);

export const accountsRelations = relations(accounts, ({ one }) => ({
	user: one(users, { fields: [accounts.userId], references: [users.id] }),
}));

export const sessions = createTable(
	"session",
	(d) => ({
		sessionToken: d.varchar({ length: 255 }).notNull().primaryKey(),
		userId: d
			.varchar({ length: 255 })
			.notNull()
			.references(() => users.id),
		expires: d.timestamp({ mode: "date", withTimezone: true }).notNull(),
	}),
	(t) => [index("t_user_id_idx").on(t.userId)],
);

export const sessionsRelations = relations(sessions, ({ one }) => ({
	user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const verificationTokens = createTable(
	"verification_token",
	(d) => ({
		identifier: d.varchar({ length: 255 }).notNull(),
		token: d.varchar({ length: 255 }).notNull(),
		expires: d.timestamp({ mode: "date", withTimezone: true }).notNull(),
	}),
	(t) => [primaryKey({ columns: [t.identifier, t.token] })],
);
