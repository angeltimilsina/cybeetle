import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
export const users = sqliteTable('users', {
 id:text('id').primaryKey(), email:text('email').notNull(), name:text('name').notNull(), createdAt:text('created_at').notNull(), lastSeenAt:text('last_seen_at').notNull(), tasks:text('tasks').notNull().default('[false,false,false]')
});
export const threads = sqliteTable('threads', {
 id:text('id').primaryKey(), userId:text('user_id').notNull().references(()=>users.id,{onDelete:'cascade'}), title:text('title').notNull(), messages:text('messages').notNull().default('[]'), messageCount:integer('message_count').notNull().default(0), createdAt:text('created_at').notNull(), updatedAt:text('updated_at').notNull()
},t=>[index('idx_threads_user_updated').on(t.userId,t.updatedAt),index('idx_threads_updated').on(t.updatedAt)]);
