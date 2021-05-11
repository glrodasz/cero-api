// deno-lint-ignore-file no-explicit-any
import { serve, Server } from "../deps.ts";

type Method = "POST" | "GET" | "PUT" | "PATCH" | "DELETE";

type PartialRecord<K extends string | number | symbol, T> = { [P in K]?: T };

interface Request {
  path: string;
  method: Method;
  body: any;
}

interface Response {
  send: (string: string) => void;
  json: (json: any) => void;
}

type Handler = (req: Request, res: Response) => void;

export class App {
  routing: Record<string, PartialRecord<Method, Handler>> = {};
  server!: Server;
  middlewares: Handler[] = [];

  constructor(port: number) {
    this.server = serve(`0.0.0.0:${port}`);
    console.log(`Server started on port ${port}`);
  }

  async listen() {
    for await (const req of this.server) {
      const { url, method } = req as { method: Method; url: string };

      const request = { path: url, method: method, body: req.body };
      const response = {
        send: (str: string) => {
          req.respond({ body: str });
        },
        json: (json: any) => {
          req.respond({ body: JSON.stringify(json) });
        },
      };

      if (!this.pathExists(url)) {
        req.respond({ body: "Not Found" });
        continue;
      }
      if (!this.methodExistsInRoute(url, method)) {
        req.respond({ body: `Cannot ${method} at ${url}` });
        continue;
      }

      for (const middleware of this.middlewares) {
        middleware(request, response);
      }

      this.routing[url][method]!(request, response);
    }
  }

  use(handler: Handler) {
    this.middlewares.push(handler);
  }

  get(path: string, handler: Handler) {
    this.setMethod("GET", path, handler);
  }

  post(path: string, handler: Handler) {
    this.setMethod("POST", path, handler);
  }

  patch(path: string, handler: Handler) {
    this.setMethod("PATCH", path, handler);
  }

  put(path: string, handler: Handler) {
    this.setMethod("PUT", path, handler);
  }

  delete(path: string, handler: Handler) {
    this.setMethod("DELETE", path, handler);
  }

  private setMethod(method: Method, path: string, handler: Handler) {
    if (this.routing[path]) {
      this.routing[path][method] = handler;
    } else {
      this.routing[path] = { [method]: handler };
    }
  }

  private pathExists(path: string) {
    return path in this.routing;
  }

  private methodExistsInRoute(path: string, method: Method) {
    return method in this.routing[path];
  }
}
