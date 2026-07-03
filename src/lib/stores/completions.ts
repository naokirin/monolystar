import { persisted } from "./persist";
import type { Completions } from "../types";

export const completions = persisted<Completions>("completions-v1", {});
