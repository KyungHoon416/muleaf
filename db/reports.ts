import { env } from "cloudflare:workers";
export function reportDb() {
 if (!env.DB) throw new Error("Report storage unavailable");
 return env.DB;
}
