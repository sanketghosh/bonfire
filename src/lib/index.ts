import { createServer, Server, IncomingMessage, ServerResponse } from "http";
import path from "path";
import fs from "fs/promises";

// Core Type Definitions
export interface RequestContext {
  method: string;
  url: string;
  headers: Record<string, string | string[] | undefined> | Headers; // Changed to match IncomingHttpHeaders more closely
  body: any;
  params: Record<string, string>;
}

export interface ResponseContext {
  status: (code: number) => ResponseContext;
  json: (data: any) => void;
  send: (data: string) => void;
  setHeader: (key: string, value: string) => ResponseContext;
  render: (
    templatePath: string,
    data?: Record<string, any>
  ) => Promise<void> | void;
}

export type Handler = (
  req: RequestContext,
  res: ResponseContext
) => void | Promise<void>;

export type Middleware = (
  req: RequestContext & IncomingMessage,
  res: ResponseContext,
  next: () => void
) => void | Promise<void>;

type MatchReturnType = {
  handler: Handler | undefined;
  params: Record<string, string>;
};

// templating engine type
export type TemplateEngine = (
  templatePath: string,
  data: Record<string, any>
) => Promise<string> | string;

// router class
class Router {
  private routes: Map<string, Map<string, Handler>> = new Map();

  constructor() {
    ["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"].forEach(
      (method) => {
        this.routes.set(method, new Map());
      }
    );
  }

  get(path: string, handler: Handler) {
    this.register("GET", path, handler);
  }
  post(path: string, handler: Handler) {
    this.register("POST", path, handler);
  }
  put(path: string, handler: Handler) {
    this.register("PUT", path, handler);
  }
  delete(path: string, handler: Handler) {
    this.register("DELETE", path, handler);
  }
  patch(path: string, handler: Handler) {
    this.register("PATCH", path, handler);
  }
  head(path: string, handler: Handler) {
    this.register("HEAD", path, handler);
  }
  options(path: string, handler: Handler) {
    this.register("OPTIONS", path, handler);
  }

  private register(method: string, path: string, handler: Handler) {
    const methodRoutes = this.routes.get(method);
    if (methodRoutes) {
      methodRoutes.set(path, handler);
    }
  }

  match(method: string, url: string): MatchReturnType {
    const methodRoutes = this.routes.get(method);
    if (!methodRoutes) return { handler: undefined, params: {} };

    for (const [routePath, handler] of methodRoutes) {
      const routeParts = routePath.split("/");
      const urlParts = url.split("/");

      if (routeParts.length !== urlParts.length) continue;

      const params: Record<string, string> = {};
      let match = true;

      for (let i = 0; i < routeParts.length; i++) {
        if (routeParts[i].startsWith(":")) {
          params[routeParts[i].slice(1)] = urlParts[i];
        } else if (routeParts[i] !== urlParts[i]) {
          match = false;
          break;
        }
      }

      if (match) return { handler, params };
    }

    return { handler: undefined, params: {} };
  }
}

export function jsonMiddleware(): Middleware {
  return async (
    req: RequestContext & IncomingMessage,
    res: ResponseContext,
    next: () => void
  ): Promise<void> => {
    if (req.method === "GET" || req.method === "HEAD") {
      next();
      return;
    }

    const contentType = req.headers["content-type"];
    if (contentType?.includes("application/json")) {
      let body = "";
      req.body = null;

      req.on("data", (chunk) => {
        body += chunk;
      });

      await new Promise<void>((resolve) => {
        req.on("end", () => {
          try {
            req.body = body ? JSON.parse(body) : null;
          } catch (e) {
            res.status(400).json({ error: "Invalid JSON" });
            return;
          }
          resolve();
        });
      });
    }
    next();
  };
}

export function staticMiddleware(staticPath: string): Middleware {
  return async (
    req: RequestContext & IncomingMessage,
    res: ResponseContext,
    next: () => void
  ): Promise<void> => {
    const filePath = path.join(staticPath, req.url || "");

    try {
      const stats = await fs.stat(filePath);
      if (stats.isFile()) {
        const content = await fs.readFile(filePath, "utf8");
        const ext = path.extname(filePath).toLowerCase();

        const mimeTypes: Record<string, string> = {
          ".html": "text/html",
          ".js": "application/javascript",
          ".css": "text/css",
          ".png": "image/png",
          ".jpg": "image/jpeg",
          ".gif": "image/gif",
        };

        res.setHeader(
          "Content-Type",
          mimeTypes[ext] || "application/octet-stream"
        );
        res.send(content);
        return;
      }
    } catch (e) {
      // File not found, proceed to next middleware
    }
    next();
  };
}

// main framework class
export class Bonfire {
  private router: Router;
  private middlewares: Middleware[] = [];
  private server: Server;
  private viewsDir: string;
  private templateEngine: TemplateEngine;

  constructor(
    viewsDir: string = path.join(process.cwd(), "views"),
    templateEngine?: TemplateEngine
  ) {
    this.router = new Router();
    this.server = createServer(this.handleRequest.bind(this));
    this.viewsDir = viewsDir;
    this.templateEngine =
      templateEngine || ((templatePath) => fs.readFile(templatePath, "utf-8"));
  }

  use(middleware: Middleware) {
    this.middlewares.push(middleware);
    return this;
  }

  get(path: string, handler: Handler) {
    this.router.get(path, handler);
    return this;
  }
  post(path: string, handler: Handler) {
    this.router.post(path, handler);
    return this;
  }
  put(path: string, handler: Handler) {
    this.router.put(path, handler);
    return this;
  }
  delete(path: string, handler: Handler) {
    this.router.delete(path, handler);
    return this;
  }
  patch(path: string, handler: Handler) {
    this.router.patch(path, handler);
    return this;
  }
  head(path: string, handler: Handler) {
    this.router.head(path, handler);
    return this;
  }
  options(path: string, handler: Handler) {
    this.router.options(path, handler);
    return this;
  }

  private async handleRequest(req: IncomingMessage, res: ServerResponse) {
    const url = req.url || "/";

    // CHANGE: Explicitly type requestContext to preserve intersection type
    const requestContext: RequestContext & IncomingMessage = Object.assign(
      req,
      {
        method: req.method || "GET",
        url,
        headers: req.headers,
        body: null,
        params: {},
        raw: req,
      }
    );

    // Create response context
    let statusCode = 200;
    const headers = new Map<string, string>();
    let responseBody: string | undefined;

    const responseContext: ResponseContext = {
      status: (code) => {
        statusCode = code;
        return responseContext;
      },
      json: (data) => {
        headers.set("Content-Type", "application/json");
        responseBody = JSON.stringify(data);
      },
      send: (data) => {
        responseBody = data;
      },
      setHeader: (key, value) => {
        headers.set(key, value);
        return responseContext;
      },
      render: async (templatePath, data = {}) => {
        try {
          const fullPath = path.join(this.viewsDir, templatePath);
          const rendered = await this.templateEngine(fullPath, data);
          headers.set("Content-Type", "text/html");
          responseBody = rendered;
        } catch (e) {
          headers.set("Content-Type", "text/plain");
          statusCode = 500;
          responseBody = `Error rendering template: ${(e as Error).message}`;
        }
      },
    };

    // CHANGE: Explicitly type the executeMiddleware function to preserve requestContext type
    const executeMiddleware = async (index: number): Promise<void> => {
      if (index >= this.middlewares.length) {
        const { handler, params } = this.router.match(req.method || "GET", url);
        requestContext.params = params;

        if (handler) {
          // Explicitly pass requestContext with correct type
          await handler(
            requestContext as RequestContext & IncomingMessage,
            responseContext
          );
        } else {
          responseContext.status(404).send("Not Found");
        }
        return;
      }

      await this.middlewares[index](
        requestContext as RequestContext & IncomingMessage,
        responseContext,
        () => executeMiddleware(index + 1)
      );
    };

    await executeMiddleware(0);

    // Set response headers
    headers.forEach((value, key) => {
      res.setHeader(key, value);
    });

    res.writeHead(statusCode);
    res.end(responseBody);
  }
  listen(port: number) {
    this.server.listen(port, () => {
      console.log(`Server running on http://localhost:${port}`);
    });
    return this.server;
  }
}

/*  private async handleRequest(req: IncomingMessage, res: ServerResponse) {
    const url = req.url || "/";
    let body = "";

    req.on("data", (chunk) => {
      body += chunk;
    });

    await new Promise<void>((resolve) => {
      req.on("end", () => resolve());
    });

    // Create request context
    const requestContext: RequestContext = {
      method: req.method || "GET",
      url,
      headers: req.headers, // Now compatible with IncomingHttpHeaders
      body: body ? JSON.parse(body) : null,
      params: {},
    };

    // Create response context
    let statusCode = 200;
    const headers = new Map<string, string>(); // Using Map instead of Headers
    let responseBody: string | undefined;

    const responseContext: ResponseContext = {
      status: (code) => {
        statusCode = code;
        return responseContext;
      },
      json: (data) => {
        headers.set("Content-Type", "application/json");
        responseBody = JSON.stringify(data);
      },
      send: (data) => {
        responseBody = data;
      },
      setHeader: (key, value) => {
        headers.set(key, value);
        return responseContext;
      },
      render: async (templatePath, data = {}) => {
        try {
          const fullPath = path.join(this.viewsDir, templatePath);
          const rendered = await this.templateEngine(fullPath, data);
          headers.set("Content-Type", "text/html");
          responseBody = rendered;
        } catch (error) {
          headers.set("Content-Type", "text/plain");
          statusCode = 500;
          responseBody = `Error rendering template: ${
            (error as Error).message
          }`;
        }
      },
    };

    // Middleware chain execution
    const executeMiddleware = async (index: number) => {
      if (index >= this.middlewares.length) {
        const { handler, params } = this.router.match(req.method || "GET", url);
        requestContext.params = params;

        if (handler) {
          await handler(requestContext, responseContext);
        } else {
          responseContext.status(404).send("Not Found");
        }
        return;
      }

      await this.middlewares[index](requestContext, responseContext, () =>
        executeMiddleware(index + 1)
      );
    };

    await executeMiddleware(0);

    // Set response headers
    headers.forEach((value, key) => {
      res.setHeader(key, value);
    });

    res.writeHead(statusCode);
    res.end(responseBody);
  }
 */
