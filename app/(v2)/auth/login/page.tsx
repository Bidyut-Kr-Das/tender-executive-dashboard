import { AuthFrame } from "@/components/v2/auth/auth-frame";
import { LoginForm } from "@/components/v2/auth/login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string | string[] }>;
}) {
  const { callbackUrl } = await searchParams;

  return (
    <AuthFrame title="Sign in" hint="Use the account an admin created for you.">
      <LoginForm callbackUrl={typeof callbackUrl === "string" ? callbackUrl : "/"} />
    </AuthFrame>
  );
}
