import { NextResponse } from "next/server";

export const json = (data: unknown, status = 200) => NextResponse.json(data, { status });
export const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });
export const baseUrl = () =>
  process.env.NEXT_PUBLIC_BASE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");
