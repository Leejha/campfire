import type { ReactElement, ReactNode } from "react";
import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";

import {
  CampfireNavigation,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "~/components";
import type { Route } from "./+types/root";
import "./app.css";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: Readonly<LayoutProps>): ReactElement {
  return (
    <html lang="ko">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        <a
          className="sr-only focus:not-sr-only focus:flex focus:min-h-11 focus:items-center focus:justify-center focus:bg-primary focus:px-4 focus:py-3 focus:text-sm focus:font-semibold focus:text-primary-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
          href="#main-content"
        >
          본문으로 건너뛰기
        </a>
        <CampfireNavigation />
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App(): ReactElement {
  return <Outlet />;
}

export function ErrorBoundary({
  error,
}: Route.ErrorBoundaryProps): ReactElement {
  let message = "문제가 생겼어요.";
  let details = "잠시 후 다시 시도해 주세요.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    if (error.status === 404) {
      message = "페이지를 찾을 수 없어요.";
      details = "주소를 다시 확인해 주세요.";
    }
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto flex min-h-svh w-full max-w-3xl items-center px-4 py-8 sm:px-6"
    >
      <Card className="w-full">
        <CardHeader>
          <CardTitle>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              {message}
            </h1>
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <p className="leading-7 text-muted-foreground">{details}</p>
          {stack && (
            <pre className="overflow-x-auto rounded-md border border-border bg-muted p-4 text-sm">
              <code>{stack}</code>
            </pre>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
