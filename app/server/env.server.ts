type RuntimeEnvironment = {
  nodeEnv: string;
  databaseUrl?: string;
};

export type AuthEnvironment = {
  sessionSecret: string;
  ssoBaseUrl: string;
  ssoClientId: string;
  ssoClientSecret: string;
  ssoCallbackUrl: string;
  ssoProviderName: string;
  cookieSecure: boolean;
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
  const nodeEnv = process.env.NODE_ENV || "development";

  return {
    sessionSecret: getRequiredEnv("SESSION_SECRET"),
    ssoBaseUrl: getRequiredEnv("SSO_BASE_URL"),
    ssoClientId: getRequiredEnv("SSO_CLIENT_ID"),
    ssoClientSecret: getRequiredEnv("SSO_CLIENT_SECRET"),
    ssoCallbackUrl: getRequiredEnv("SSO_CALLBACK_URL"),
    ssoProviderName: process.env.SSO_PROVIDER_NAME || "yakimoji-sso",
    cookieSecure: nodeEnv === "production",
  };
}
