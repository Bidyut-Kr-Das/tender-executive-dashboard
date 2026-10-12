"use client";

import { useActionState, useEffect, useState } from "react";
import { authenticate } from "@/actions/auth";
import { Button } from "@/components/v2/ui/button";
import { Field, Input } from "@/components/v2/ui/field";
import { FormError, PasswordInput } from "./auth-frame";

export function LoginForm({ callbackUrl }: { callbackUrl: string }) {
  // The action returns the URL to open, or one of two error strings.
  const [state, formAction, pending] = useActionState(authenticate, undefined);
  // Controlled, so a failed attempt does not clear it when the form resets.
  const [email, setEmail] = useState("");

  const wrongCredentials = state?.startsWith("Invalid");
  const failed = wrongCredentials || state?.startsWith("Something");
  const signedIn = !!state && !failed;

  useEffect(() => {
    // A document load: the session cookie is new and the target may be a v1 page.
    if (signedIn) window.location.href = state;
  }, [signedIn, state]);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="redirectTo" value={callbackUrl} />
      <Field label="Email">
        <Input
          name="email"
          type="email"
          autoComplete="email"
          autoFocus
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-9"
        />
      </Field>
      <Field label="Password">
        <PasswordInput name="password" autoComplete="current-password" required />
      </Field>

      {failed && (
        <FormError>
          {wrongCredentials
            ? "Email or password is wrong."
            : "Could not sign in. Try again."}
        </FormError>
      )}

      <Button
        type="submit"
        variant="primary"
        loading={pending || signedIn}
        className="mt-1 h-9 w-full"
      >
        Sign in
      </Button>

      <p className="mt-3 text-ink-3">
        No account? Ask an admin to create one for you.
      </p>
    </form>
  );
}
