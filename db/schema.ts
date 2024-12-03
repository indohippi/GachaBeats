import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  username: text("username").unique().notNull(),
  password: text("password").notNull(),
  lastPull: timestamp("last_pull"),
});

export const sounds = pgTable("sounds", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull(),
  url: text("url").notNull(),
  rarity: text("rarity").notNull(),
});

export const userSounds = pgTable("user_sounds", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  userId: integer("user_id").references(() => users.id),
  soundId: integer("sound_id").references(() => sounds.id),
  obtainedAt: timestamp("obtained_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users);
export const selectUserSchema = createSelectSchema(users);
export const insertSoundSchema = createInsertSchema(sounds);
export const selectSoundSchema = createSelectSchema(sounds);

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = z.infer<typeof selectUserSchema>;
export type Sound = z.infer<typeof selectSoundSchema>;
