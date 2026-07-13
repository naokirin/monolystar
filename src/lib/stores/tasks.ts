import { persisted } from "./persist";
import { isTaskArray } from "../logic/validate";
import type { Task } from "../types";

export const tasks = persisted<Task[]>("tasks-v1", [], isTaskArray);
