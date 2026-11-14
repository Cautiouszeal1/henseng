import type { NextRequest } from "next/server";
import { preflight } from "@/lib/v1/http";
import { dispatch } from "@/lib/v1/router";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ path: string[] }> };

export const GET = async (req: NextRequest, ctx: Ctx) => dispatch("GET", req, (await ctx.params).path);
export const POST = async (req: NextRequest, ctx: Ctx) => dispatch("POST", req, (await ctx.params).path);
export const PATCH = async (req: NextRequest, ctx: Ctx) => dispatch("PATCH", req, (await ctx.params).path);
export const DELETE = async (req: NextRequest, ctx: Ctx) => dispatch("DELETE", req, (await ctx.params).path);
export const OPTIONS = async () => preflight();
