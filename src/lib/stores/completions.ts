import { persisted } from "./persist";
import { isCompletions } from "../logic/validate";
import type { Completions } from "../types";

export const completions = persisted<Completions>("completions-v1", {}, isCompletions);
