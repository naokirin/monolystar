import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { deliverNotification } from "./deliverNotification";

describe("deliverNotification", () => {
  const originalNotification = (globalThis as { Notification?: unknown }).Notification;
  const originalServiceWorker = (navigator as { serviceWorker?: unknown }).serviceWorker;

  afterEach(() => {
    (globalThis as { Notification?: unknown }).Notification = originalNotification;
    Object.defineProperty(navigator, "serviceWorker", {
      value: originalServiceWorker,
      configurable: true,
    });
    vi.restoreAllMocks();
  });

  function stubNotification(permission: NotificationPermission) {
    const constructorSpy = vi.fn();
    (globalThis as { Notification?: unknown }).Notification = Object.assign(
      constructorSpy,
      { permission },
    );
    return constructorSpy;
  }

  it("does nothing when permission is not granted", async () => {
    const constructorSpy = stubNotification("default");
    Object.defineProperty(navigator, "serviceWorker", { value: undefined, configurable: true });

    await deliverNotification("title", "body");

    expect(constructorSpy).not.toHaveBeenCalled();
  });

  it("uses the Service Worker registration's showNotification when available", async () => {
    stubNotification("granted");
    const showNotification = vi.fn().mockResolvedValue(undefined);
    const getRegistration = vi.fn().mockResolvedValue({ showNotification });
    Object.defineProperty(navigator, "serviceWorker", {
      value: { getRegistration },
      configurable: true,
    });

    await deliverNotification("title", "body");

    expect(getRegistration).toHaveBeenCalled();
    expect(showNotification).toHaveBeenCalledWith("title", { body: "body" });
  });

  it("falls back to the Notification constructor when there is no registration", async () => {
    const constructorSpy = stubNotification("granted");
    const getRegistration = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "serviceWorker", {
      value: { getRegistration },
      configurable: true,
    });

    await deliverNotification("title", "body");

    expect(constructorSpy).toHaveBeenCalledWith("title", { body: "body" });
  });

  it("falls back to the Notification constructor when serviceWorker is unsupported", async () => {
    const constructorSpy = stubNotification("granted");
    Object.defineProperty(navigator, "serviceWorker", { value: undefined, configurable: true });

    await deliverNotification("title", "body");

    expect(constructorSpy).toHaveBeenCalledWith("title", { body: "body" });
  });
});
