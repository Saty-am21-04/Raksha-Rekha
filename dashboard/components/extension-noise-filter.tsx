"use client";

import { useEffect } from "react";

/**
 * Marks errors thrown entirely inside browser extensions as handled.
 *
 * Extension content scripts run in the page's JS context, so when one throws —
 * for example the "Cannot read properties of undefined (reading 'M_ID')"
 * rejection from executors/200.js in eppiocemhmnlbhjplcgkofciiegomcon — the
 * browser attributes it to this page. It reaches window.onerror /
 * unhandledrejection, the dev overlay treats it as an application fault, and in
 * production it would pollute error reporting with a third-party defect nobody
 * here can fix.
 *
 * The test is deliberately strict, because a filter that hides real bugs is far
 * worse than the noise it removes: an event is suppressed only when its stack
 * contains at least one URL and *every* URL in it belongs to an extension
 * origin. A single frame from our own bundle, or a stack with no URLs at all, is
 * left completely alone.
 *
 * Limitation worth knowing: this marks the event handled, which silences the
 * browser console and keeps it out of error reporting. Next's dev overlay
 * registers its own listeners and may still display the error depending on
 * listener order, so it is not guaranteed to disappear from the overlay in dev.
 * The only complete remedy is disabling the extension or using a clean profile.
 */

const EXTENSION_SCHEMES = [
  "chrome-extension://",
  "moz-extension://",
  "safari-web-extension://",
  "safari-extension://",
  "ms-browser-extension://",
];

/** Every URL-looking token in a stack trace. */
const URL_PATTERN =
  /(?:[a-z-]+):\/\/[^\s)'"]+/gi;

function isExtensionOnlyStack(stack: unknown): boolean {
  if (typeof stack !== "string" || stack.length === 0) return false;

  const urls = stack.match(URL_PATTERN);
  // No URLs means we cannot attribute it — leave it alone.
  if (!urls || urls.length === 0) return false;

  return urls.every((url) =>
    EXTENSION_SCHEMES.some((scheme) => url.toLowerCase().startsWith(scheme)),
  );
}

function stackOf(value: unknown): unknown {
  if (value instanceof Error) return value.stack;
  if (value && typeof value === "object" && "stack" in value) {
    return (value as { stack?: unknown }).stack;
  }
  return undefined;
}

export function ExtensionNoiseFilter() {
  useEffect(() => {
    const seen = new Set<string>();

    /** Log each distinct extension fault once, so it is visible but not spam. */
    const noteOnce = (label: string, detail: unknown) => {
      if (seen.has(label)) return;
      seen.add(label);
      console.debug(
        `[extension-noise] suppressed an error thrown entirely inside a browser extension. Not an application fault.`,
        { label, detail },
      );
    };

    const onRejection = (event: PromiseRejectionEvent) => {
      const stack = stackOf(event.reason);
      if (!isExtensionOnlyStack(stack)) return;

      event.preventDefault();
      event.stopImmediatePropagation();
      noteOnce(
        event.reason instanceof Error ? event.reason.message : "rejection",
        stack,
      );
    };

    const onError = (event: ErrorEvent) => {
      // filename is the most reliable attribution for a classic error event.
      const fromExtension =
        EXTENSION_SCHEMES.some((scheme) =>
          (event.filename ?? "").toLowerCase().startsWith(scheme),
        ) || isExtensionOnlyStack(stackOf(event.error));

      if (!fromExtension) return;

      event.preventDefault();
      event.stopImmediatePropagation();
      noteOnce(event.message || "error", event.filename);
    };

    // Capture phase, so this runs as early as the platform allows.
    window.addEventListener("unhandledrejection", onRejection, true);
    window.addEventListener("error", onError, true);

    return () => {
      window.removeEventListener("unhandledrejection", onRejection, true);
      window.removeEventListener("error", onError, true);
    };
  }, []);

  return null;
}
