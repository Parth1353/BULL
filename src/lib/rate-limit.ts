type Entry = { count: number; resetAt: number };

const requests = new Map<string, Entry>();
const windowMs = 10 * 60 * 1000;
const requestLimit = 10;

export function allowReportRequest(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const key = forwardedFor || "local";
  const now = Date.now();
  const entry = requests.get(key);
  if (!entry || entry.resetAt <= now) {
    requests.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }
  entry.count += 1;
  return { allowed: entry.count <= requestLimit, retryAfterSeconds: Math.ceil((entry.resetAt - now) / 1000) };
}
