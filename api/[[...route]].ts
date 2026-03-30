export const config = { runtime: "edge" };

import { handle } from "hono/vercel";
import app from "../src/app.js";

export default handle(app);
