import { JWT } from "google-auth-library";

export function getGoogleDriveFileId(url: string | null | undefined): string | null {
  if (!url) return null;
  let match = url.match(/id=([a-zA-Z0-9_-]+)/);
  if (match) return match[1];
  match = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (match) return match[1];
  return null;
}

export function getGoogleDriveDownloadUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const fileId = getGoogleDriveFileId(url);
  if (fileId) {
    return `https://docs.google.com/uc?export=download&id=${fileId}`;
  }
  return url;
}

export async function getAccessToken(clientEmail: string, privateKey: string): Promise<string> {
  const { token } = await new JWT({
    email: clientEmail,
    key: privateKey,
    scopes: [
      "https://www.googleapis.com/auth/spreadsheets.readonly",
      "https://www.googleapis.com/auth/drive.readonly",
    ],
  }).getAccessToken();
  if (!token) throw new Error("Google token exchange failed: no access token returned");
  return token;
}

export function getCleanCredentials(): { email: string; key: string } | null {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || process.env.GOOGLE_CLIENT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY;
  if (!email || !key) return null;
  return {
    email: email.trim().replace(/^["']|["']$/g, ""),
    key: key.trim().replace(/^["']|["']$/g, "").replace(/\\n/g, "\n"),
  };
}
