import type { Context } from "hono";
import type { Logger } from "./utils/logger";

export interface AppVariables {
  logger: Logger;
}

export type AppContext = Context<{ Bindings: Env; Variables: AppVariables }>;
