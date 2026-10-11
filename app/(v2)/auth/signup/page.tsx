import Link from "next/link";
import { auth } from "@/auth";
import { ADMIN_ROLES } from "@/lib/dal";
import { AuthFrame } from "@/components/v2/auth/auth-frame";
import { SignupForm } from "@/components/v2/auth/signup-form";

const LINK = "font-medium text-accent-ink hover:underline";

export default async function SignupPage() {
  const session = await auth();
  const isAdmin = (ADMIN_ROLES as readonly string[]).includes(
    session?.user?.role ?? "",
  );

  // The signup API only accepts admins, so do not offer a form that will fail.
  if (!isAdmin) {
    return (
      <AuthFrame
        title="Only admins can create accounts"
        hint="Ask an admin to create an account for you or your teammate."
      >
        {session?.user ? (
          <Link href="/v2/tenders" className={LINK}>
            Back to tenders
          </Link>
        ) : (
          <Link href="/auth/login?callbackUrl=/auth/signup" className={LINK}>
            Sign in as an admin
          </Link>
        )}
      </AuthFrame>
    );
  }

  return (
    <AuthFrame
      title="Create an account"
      hint="The new person signs in with this email and password."
    >
      <SignupForm />
      <Link href="/v2/tenders" className={`mt-4 inline-block ${LINK}`}>
        Back to tenders
      </Link>
    </AuthFrame>
  );
}
