import type { users } from "@escape-group/db/schema";
import type { InferSelectModel } from "drizzle-orm";

declare global {
  namespace App {
    interface Locals {
      user: InferSelectModel<typeof users> | null;
    }
  }
}

export {};
