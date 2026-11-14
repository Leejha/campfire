import type { ReactElement, ReactNode } from "react";
import { generateThemingScript } from "@seed-design/css/theming";
import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLocation,
} from "react-router";

import {
  CampfireNavigation,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  QueryProvider,
} from "~/components";
import type { Route } from "./+types/root";
import "./app.css";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: Readonly<LayoutProps>): ReactElement {
  const location = useLocation();
  const isDisplayRoute = location.pathname === "/display";

  return (
    <html lang="ko" data-seed-color-mode="light-only">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="color-scheme" content="light" />
        <script
          dangerouslySetInnerHTML={{
            __html: generateThemingScript({ mode: "light-only" }),
          }}
        />
        <Meta />
        <Links />
      </head>
      <body>
        <a
          className="sr-only focus:not-sr-only focus:flex focus:min-h-11 focus:items-center focus:justify-center focus:bg-bg-brand-solid focus:px-x4 focus:py-x3 focus:t4-bold focus:text-fg-neutral-inverted focus:outline-none focus:ring-2 focus:ring-stroke-focus-ring focus:ring-offset-2 focus:ring-offset-bg-layer-default"
          href="#main-content"
        >
          본문으로 건너뛰기
        </a>
        {isDisplayRoute ? null : <CampfireNavigation />}
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App(): ReactElement {
  return (
    <QueryProvider>
      <Outlet />
    </QueryProvider>
  );
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
      className="mx-auto flex min-h-svh w-full max-w-3xl items-center px-x4 py-x8 sm:px-x6"
    >
      <Card className="w-full">
        <CardHeader>
          <CardTitle>
            <h1 className="t9-bold tracking-tight sm:t10-bold">
              {message}
            </h1>
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-x4">
          <p className="t5-regular text-fg-neutral-muted">{details}</p>
          {stack && (
            <pre className="overflow-x-auto rounded-r2 border border-stroke-neutral-subtle bg-bg-neutral-weak p-x4 t4-regular">
              <code>{stack}</code>
            </pre>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
