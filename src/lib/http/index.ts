type RequestOptions = Omit<RequestInit, "method" | "body">;

export class HttpError extends Error {
  constructor(public status: number, public statusText: string) {
    super(`${status} ${statusText}`);
  }
}

async function request(url: string, method: string, body?: BodyInit | null, options?: RequestOptions): Promise<Response> {
  const resp = await fetch(url, {...options, method, body});
  if (!resp.ok) throw new HttpError(resp.status, resp.statusText);
  return resp;
}

export function get(url: string, options?: RequestOptions) {
  return request(url, "GET", null, options);
}

export function post(url: string, body?: BodyInit | null, options?: RequestOptions) {
  return request(url, "POST", body, options);
}

export function put(url: string, body?: BodyInit | null, options?: RequestOptions) {
  return request(url, "PUT", body, options);
}

export function patch(url: string, body?: BodyInit | null, options?: RequestOptions) {
  return request(url, "PATCH", body, options);
}

export function del(url: string, options?: RequestOptions) {
  return request(url, "DELETE", null, options);
}
