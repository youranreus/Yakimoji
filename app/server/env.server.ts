type RuntimeEnvironment = {
  nodeEnv: string;
  databaseUrl?: string;
};

export type AuthEnvironment = {
  ssoBaseUrl: string;
  ssoApiBaseUrl: string;
  ssoClientId: string;
  ssoClientSecret: string;
  ssoCallbackUrl: string;
  ssoProviderName: string;
};

export type SessionEnvironment = {
  sessionSecret: string;
  cookieSecure: boolean;
};

export type ApiCredentialEnvironment = {
  credentialPepper: string;
};

function getRequiredEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is required`);
  }

  return value;
}

export function getRuntimeEnvironment(): RuntimeEnvironment {
  return {
    nodeEnv: process.env.NODE_ENV || "development",
    databaseUrl: process.env.DATABASE_URL,
  };
}

export function getDatabaseUrl() {
  return getRequiredEnv("DATABASE_URL");
}

export function getAuthEnvironment(): AuthEnvironment {
  const ssoBaseUrl = getRequiredEnv("SSO_BASE_URL");

  return {
    ssoBaseUrl,
    ssoApiBaseUrl: process.env.SSO_API_BASE_URL || ssoBaseUrl,
    ssoClientId: getRequiredEnv("SSO_CLIENT_ID"),
    ssoClientSecret: getRequiredEnv("SSO_CLIENT_SECRET"),
    ssoCallbackUrl: getRequiredEnv("SSO_CALLBACK_URL"),
    ssoProviderName: process.env.SSO_PROVIDER_NAME || "yakimoji-sso",
  };
}

export function getSessionEnvironment(): SessionEnvironment {
  const nodeEnv = process.env.NODE_ENV || "development";

  return {
    sessionSecret: getRequiredEnv("SESSION_SECRET"),
    cookieSecure: nodeEnv === "production",
  };
}

export function getApiCredentialEnvironment(): ApiCredentialEnvironment {
  return {
    credentialPepper: getRequiredEnv("API_CREDENTIAL_PEPPER"),
  };
}
