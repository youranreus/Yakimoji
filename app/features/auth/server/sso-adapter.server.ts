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

function readObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function getRestfulPayloadRoot(payload: unknown) {
  const record = readObject(payload);
  const nestedData = readObject(record?.data);

  return nestedData ?? record ?? {};
}

function normalizeTokenResult(payload: unknown): SsoTokenResult {
  const record = getRestfulPayloadRoot(payload);
  const accessToken = record?.accessToken ?? record?.access_token;

  if (typeof accessToken !== "string" || accessToken.length === 0) {
    throw new Error("SSO token response did not include an access token");
  }

  const refreshToken =
    typeof record?.refreshToken === "string"
      ? record.refreshToken
      : typeof record?.refresh_token === "string"
        ? record.refresh_token
        : undefined;
  const expiresCandidate = record?.expiresIn ?? record?.expires_in;
  const expiresIn =
    typeof expiresCandidate === "number"
      ? expiresCandidate
      : typeof expiresCandidate === "string" && expiresCandidate.length > 0
        ? Number(expiresCandidate)
        : undefined;

  return {
    accessToken,
    refreshToken,
    expiresIn: Number.isFinite(expiresIn) ? expiresIn : undefined,
  };
}

function getUserPayloadRoot(payload: unknown) {
  const record = getRestfulPayloadRoot(payload);
  const nestedUser = readObject(record?.user);

  return nestedUser ?? record;
}

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
  authorizeBaseUrl: string;
  apiBaseUrl: string;
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
  const authorizeUrl = new URL("/oauth/authorize", environment.authorizeBaseUrl);

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
  const endpoint = new URL("/oauth/token", environment.apiBaseUrl);
  endpoint.searchParams.set("client_id", environment.clientId);
  endpoint.searchParams.set("client_secret", environment.clientSecret);
  endpoint.searchParams.set("code", code);
  endpoint.searchParams.set("redirect_uri", environment.callbackUrl);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const responseText = await response.text();

    throw new Error(
      `SSO token exchange failed with status ${response.status}${responseText ? `: ${responseText}` : ""}`,
    );
  }

  return normalizeTokenResult(await response.json());
}

export async function fetchSsoUser(
  environment: SsoEnvironment,
  accessToken: string,
): Promise<SsoUser> {
  const endpoint = new URL("/oauth/user", environment.apiBaseUrl);
  const response = await fetch(endpoint, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const responseText = await response.text();

    throw new Error(
      `SSO user fetch failed with status ${response.status}${responseText ? `: ${responseText}` : ""}`,
    );
  }

  const payload = getUserPayloadRoot(await response.json());

  return {
    providerUserId: String(payload.id ?? payload.user_id ?? payload.sub),
    email: String(payload.email ?? ""),
    displayName: String(
      payload.nickname ?? payload.display_name ?? payload.name ?? payload.email ?? "Yakimoji User",
    ),
    providerRole:
      payload.role === undefined || payload.role === null ? undefined : String(payload.role),
    profile: payload,
  };
}
