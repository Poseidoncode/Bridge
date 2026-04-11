import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/svelte";
import StatusIndicator from "../../src/lib/StatusIndicator.svelte";

describe("StatusIndicator.svelte", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders with default props", () => {
    const { container } = render(StatusIndicator, { state: "off" });
    const indicator = container.querySelector(".status-indicator");
    expect(indicator).toBeTruthy();
    expect(indicator?.classList.contains("state-off")).toBe(true);
    expect(indicator?.classList.contains("size-medium")).toBe(true);
  });

  it("renders 'on' state with correct styling", () => {
    const { container } = render(StatusIndicator, { state: "on" });
    const indicator = container.querySelector(".status-indicator");
    expect(indicator?.classList.contains("state-on")).toBe(true);
  });

  it("renders 'downloading' state with correct styling", () => {
    const { container } = render(StatusIndicator, { state: "downloading" });
    const indicator = container.querySelector(".status-indicator");
    expect(indicator?.classList.contains("state-downloading")).toBe(true);
  });

  it("renders label when provided", () => {
    const { getByText } = render(StatusIndicator, {
      state: "on",
      label: "Translation Status",
    });
    expect(getByText("Translation Status")).toBeTruthy();
  });

  it("applies size classes correctly", () => {
    const { container } = render(StatusIndicator, {
      state: "on",
      size: "small",
    });
    const indicator = container.querySelector(".status-indicator");
    expect(indicator?.classList.contains("size-small")).toBe(true);

    const { container: containerLarge } = render(StatusIndicator, {
      state: "on",
      size: "large",
    });
    const indicatorLarge = containerLarge.querySelector(".status-indicator");
    expect(indicatorLarge?.classList.contains("size-large")).toBe(true);
  });
});
