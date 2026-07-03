import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import App from "./App.svelte";

describe("App", () => {
  it("renders the app name", () => {
    render(App);
    expect(screen.getByRole("heading", { name: "やることだけ" })).toBeInTheDocument();
  });
});
