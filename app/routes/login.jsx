import * as React from "react";
import { BrandLockup } from "@/components/brand/brand-lockup";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
export default function Login() {
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState("");
  const [pending, setPending] = React.useState(false);
  async function submit(event) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Could not sign in.");
      }
      window.location.assign("/");
    } catch (e) {
      setError(e.message);
      setPending(false);
    }
  }
  return (
    <main className="mx-auto flex min-h-dvh max-w-xs flex-col justify-center gap-8 px-6">
      <BrandLockup className="justify-center" />
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoFocus
          />
        </div>
        {error && (
          <p role="alert" className="text-body-sm text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" disabled={pending || !password}>
          {pending ? "Signing in…" : "Continue"}
        </Button>
      </form>
    </main>
  );
}
