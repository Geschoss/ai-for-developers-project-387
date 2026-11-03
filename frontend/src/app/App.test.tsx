import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { App } from "./App";

describe("landing", () => {
  it("offers registration and login", () => {
    globalThis.history.pushState({}, "", "/");
    render(<App />);

    expect(screen.getByRole("link", { name: "Регистрация" })).toHaveAttribute("href", "/register");
    expect(screen.getByRole("link", { name: "Войти" })).toHaveAttribute("href", "/login");
  });
});
