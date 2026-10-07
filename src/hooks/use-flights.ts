"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";

import type { DestinationsResult } from "@/lib/api/destinations";
import type { RouteInfo } from "@/lib/api/route-info";
import type { Direction } from "@/lib/store";
import type { Cabin, FlightSearchResult } from "@/lib/types";

async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.issues?.[0]?.message ?? body?.error ?? `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export function useDestinations(origin: string, direction: Direction, cabin: Cabin, date: string) {
  return useQuery({
    queryKey: ["destinations", origin, direction, cabin, date],
    queryFn: () =>
      getJson<DestinationsResult>(
        `/api/flights/destinations?${new URLSearchParams({ origin, direction, cabin, date })}`,
      ),
    placeholderData: keepPreviousData,
  });
}

export function useFlightSearch(from: string, to: string, date: string, cabin: Cabin) {
  return useQuery({
    queryKey: ["flights", from, to, date, cabin],
    queryFn: () =>
      getJson<FlightSearchResult>(`/api/flights/search?${new URLSearchParams({ from, to, date, cabin })}`),
  });
}

export function useRouteInfo(from: string, to: string, date: string) {
  return useQuery({
    queryKey: ["route-info", from, to, date],
    queryFn: () => getJson<RouteInfo>(`/api/flights/route-info?${new URLSearchParams({ from, to, date })}`),
  });
}

export { getJson };
