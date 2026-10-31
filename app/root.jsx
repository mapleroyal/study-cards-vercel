import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLocation,
  useRouteLoaderData,
} from "react-router";
import * as React from "react";

import { BrandLockup } from "@/components/brand/brand-lockup";
import { ThemeSync, THEME_COLORS } from "@/components/theme-sync";
import { Toaster } from "@/components/ui/sonner";
import { RuntimeSync } from "@/components/runtime-sync";
import { Progress } from "@/components/ui/progress";
import {
  APP_DESCRIPTION,
  APP_NAME,
  THEME_STORAGE_KEY,
  formatPageTitle,
} from "@/lib/app-config";
import { registerLuminaServiceWorker } from "@/lib/pwa-service-worker";

import "./globals.css";

export function loader({ request }) {
  return { nonce: request.headers.get("x-lumina-nonce") };
}

// The nonce belongs to this HTML document, including client-side navigation.
export function shouldRevalidate() {
  return false;
}

export function meta() {
  return [{ title: formatPageTitle() }];
}

export function HydrateFallback() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-4xl items-center justify-center p-6">
      <div className="flex w-full max-w-40 flex-col items-center gap-6">
        <BrandLockup className="justify-center" />
        <Progress indeterminate className="w-full" aria-label="Loading" />
      </div>
    </div>
  );
}

export function Layout({ children }) {
  const nonce = useRouteLoaderData("root")?.nonce;
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="application-name" content={APP_NAME} />
        <meta name="apple-mobile-web-app-title" content={APP_NAME} />
        <meta name="description" content={APP_DESCRIPTION} />
        <meta name="color-scheme" content="light dark" />
        <meta name="theme-color" content={THEME_COLORS.light} />
        <meta name="darkreader-lock" />
        <script
          src="/theme-init.js"
          data-theme-storage-key={THEME_STORAGE_KEY}
          data-light-theme-color={THEME_COLORS.light}
          data-dark-theme-color={THEME_COLORS.dark}
        />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <link rel="manifest" href="/site.webmanifest" />
        <Meta />
        <Links />
      </head>
      <body className="min-h-dvh bg-background text-foreground antialiased">
        <ThemeSync />
        {children}
        <ScrollRestoration nonce={nonce} />
        <Scripts nonce={nonce} />
      </body>
    </html>
  );
}

export default function App() {
  const { pathname } = useLocation();
  const isLogin = pathname === "/login";
  React.useEffect(() => {
    const onSignOut = (event) => {
      if (event.key === "lumina:sign-out" && event.newValue) {
        globalThis.location.replace("/login");
      }
    };
    globalThis.addEventListener("storage", onSignOut);
    return () => globalThis.removeEventListener("storage", onSignOut);
  }, []);
  React.useEffect(() => {
    if (import.meta.env.PROD && !isLogin) {
      registerLuminaServiceWorker();
    }
  }, [isLogin, pathname]);

  return (
    <>
      {!isLogin && <RuntimeSync />}
      <Outlet />
      <Toaster />
    </>
  );
}
