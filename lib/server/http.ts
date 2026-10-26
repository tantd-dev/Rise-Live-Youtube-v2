// Tiện ích route: lỗi có mã HTTP + bọc handler để mọi route trả JSON thống nhất.
import { NextResponse } from "next/server";

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export const bad = (msg: string) => new HttpError(400, msg);
export const forbidden = (msg = "Bạn không có quyền thực hiện thao tác này.") => new HttpError(403, msg);
export const notFound = (msg = "Không tìm thấy.") => new HttpError(404, msg);

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

/** Bọc handler: HttpError → đúng mã; lỗi khác → 500 + ghi log. */
export function route<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.message }, e.status);
      console.error("[route]", e);
      return json({ error: e instanceof Error ? e.message : "Lỗi máy chủ." }, 500);
    }
  };
}

export async function readBody<T = Record<string, unknown>>(req: Request): Promise<T> {
  return (await req.json().catch(() => ({}))) as T;
}

export const str = (v: unknown, max = 300) => String(v ?? "").trim().slice(0, max);
