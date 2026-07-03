import { persisted } from "./persist";
import type { Task } from "../types";

export const tasks = persisted<Task[]>("tasks-v1", []);
