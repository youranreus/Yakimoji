type RuntimeEnvironment = {
  nodeEnv: string;
  databaseUrl?: string;
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
