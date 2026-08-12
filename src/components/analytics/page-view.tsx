"use client";

import { useEffect } from "react";

import { recordBrowserProductEvent, type BrowserProductEvent } from "./product-event";

export function ProductPageView({ event }: { event: BrowserProductEvent }) {
  useEffect(() => recordBrowserProductEvent(event), [event]);
  return null;
}
