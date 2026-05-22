import { createHash, randomUUID } from "node:crypto";

export type SsoUser = {
  providerUserId: string;
  email: string;
  displayName: string;
  providerRole?: string;
  profile?: Record<string, unknown>;
};

export type SsoTokenResult = {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
};

function encodeState(payload: Record<string, string>) {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function decodeState(payload: string) {
  return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Record<
    string,
    string
  >;
}

function codeChallenge(verifier: string) {
  return createHash("sha256").update(verifier).digest("base64url");
}

export type SsoEnvironment = {
  providerName: string;
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  callbackUrl: string;
};

export function createSsoAuthorizationRequest(environment: SsoEnvironment) {
  const state = encodeState({
    nonce: randomUUID(),
    requestedAt: new Date().toISOString(),
  });
  const verifier = randomUUID().replace(/-/g, "") + randomUUID().replace(/-/g, "");
  const authorizeUrl = new URL("/oauth/authorize", environment.baseUrl);

  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("client_id", environment.clientId);
  authorizeUrl.searchParams.set("redirect_uri", environment.callbackUrl);
  authorizeUrl.searchParams.set("scope", "openid profile email");
  authorizeUrl.searchParams.set("state", state);
  authorizeUrl.searchParams.set("code_challenge", codeChallenge(verifier));
  authorizeUrl.searchParams.set("code_challenge_method", "S256");

  return {
    authorizeUrl: authorizeUrl.toString(),
    state,
    verifier,
  };
}

export function decodeSsoState(state: string) {
  return decodeState(state);
}

export async function exchangeAuthorizationCode(
  environment: SsoEnvironment,
  code: string,
  verifier: string,
): Promise<SsoTokenResult> {
  const endpoint = new URL("/oauth/token", environment.baseUrl);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      grant_type: "authorization_code",
      code,
      client_id: environment.clientId,
      client_secret: environment.clientSecret,
      redirect_uri: environment.callbackUrl,
      code_verifier: verifier,
    }),
  });

  if (!response.ok) {
    throw new Error(`SSO token exchange failed with status ${response.status}`);
  }

  return (await response.json()) as SsoTokenResult;
}

export async function fetchSsoUser(
  environment: SsoEnvironment,
  accessToken: string,
): Promise<SsoUser> {
  const endpoint = new URL("/oauth/user", environment.baseUrl);
  const response = await fetch(endpoint, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`SSO user fetch failed with status ${response.status}`);
  }

  const payload = (await response.json()) as Record<string, unknown>;

  return {
    providerUserId: String(payload.id ?? payload.user_id ?? payload.sub),
    email: String(payload.email ?? ""),
    displayName: String(payload.display_name ?? payload.name ?? payload.email ?? "Yakimoji User"),
    providerRole:
      payload.role === undefined || payload.role === null ? undefined : String(payload.role),
    profile: payload,
  };
}
