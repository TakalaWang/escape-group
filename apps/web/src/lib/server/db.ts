import { createDb } from "@escape-group/db";
import { env } from "$env/dynamic/private";

export const db = createDb(env.DATABASE_URL!);
