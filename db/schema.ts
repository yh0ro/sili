import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
export const agents = sqliteTable('silicon_agents', {
 id:text('id').primaryKey(), owner:text('owner').unique(), data:text('data').notNull(), createdAt:integer('created_at').notNull(), lastAwake:integer('last_awake').notNull().default(0),
}, table => [index('silicon_agents_awake').on(table.lastAwake)]);
export const sessions = sqliteTable('silicon_sessions', {hash:text('hash').primaryKey(),lastSeen:integer('last_seen').notNull(),createdAt:integer('created_at').notNull()});
export const rateLimits = sqliteTable('silicon_rate_limits', {
 key:text('key').primaryKey(),count:integer('count').notNull(),expiresAt:integer('expires_at').notNull(),
},table=>[index('silicon_rate_limits_expiry').on(table.expiresAt)]);
export const world = sqliteTable('silicon_world', {id:integer('id').primaryKey(),lease:text('lease'),leaseUntil:integer('lease_until').notNull().default(0),lastTick:integer('last_tick').notNull().default(0)});
export const encounters = sqliteTable('silicon_encounters', {id:text('id').primaryKey(),data:text('data').notNull(),createdAt:integer('created_at').notNull()},table=>[index('silicon_encounters_recent').on(table.createdAt)]);
export const events = sqliteTable('silicon_events', {id:text('id').primaryKey(),data:text('data').notNull(),createdAt:integer('created_at').notNull()},table=>[index('silicon_events_recent').on(table.createdAt)]);
export const xLinks = sqliteTable('silicon_x_links', {
 agentId:text('agent_id').primaryKey().references(()=>agents.id,{onDelete:'cascade'}),
 xId:text('x_id').notNull().unique(),username:text('username').notNull(),name:text('name').notNull(),linkedAt:text('linked_at').notNull(),
});
export const xStates = sqliteTable('silicon_x_states', {
 hash:text('hash').primaryKey(),owner:text('owner').notNull(),agentId:text('agent_id').notNull().unique().references(()=>agents.id,{onDelete:'cascade'}),
 verifier:text('verifier').notNull(),expiresAt:integer('expires_at').notNull(),consumedAt:integer('consumed_at'),
},table=>[index('silicon_x_states_expiry').on(table.expiresAt)]);
