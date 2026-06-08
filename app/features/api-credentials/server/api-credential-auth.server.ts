import { createHash } from "node:crypto";

import { eq } from "drizzle-orm";

import { database } from "../../../../database/context";
import { apiCredentials } from "../../../../database/schema";
import { getApiCredentialEnvironment } from "../../../server/env.server";
import { getRequestContext } from "../../auth/server/request-context.server";
import { writeAuditLog } from "../../auth/server/audit.server";

import { throwPublicApiError } from "./public-api-errors.server";

type ApiCredentialRecord = {
  id: string;
  ownerUserId: number;
  label: string;
  secretHash: string;
  status: string;
  expiresAt: Date | null;
  lastUsedAt: Date | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
};

export type AuthenticatedApiCredential = {
  id: string;
  ownerUserId: number;
  label: string;
  metadata: Record<string, unknown>;
};

export const apiCredentialTestHooks = {
  getCredentialByIdImpl: getCredentialById,
  updateCredentialLastUsedAtImpl: updateCredentialLastUsedAt,
  writeAuditLogImpl: writeAuditLog,
};

export function setApiCredentialTestHooks(
  hooks: Partial<typeof apiCredentialTestHooks>,
) {
  apiCredentialTestHooks.getCredentialByIdImpl =
    hooks.getCredentialByIdImpl ?? getCredentialById;
  apiCredentialTestHooks.updateCredentialLastUsedAtImpl =
    hooks.updateCredentialLastUsedAtImpl ?? updateCredentialLastUsedAt;
  apiCredentialTestHooks.writeAuditLogImpl =
    hooks.writeAuditLogImpl ?? writeAuditLog;
}

export function hashApiCredentialSecret(id: string, secret: string) {
  return createHash("sha256")
    .update(`${id}.${secret}.${getApiCredentialEnvironment().credentialPepper}`)
    .digest("hex");
}

async function getCredentialById(
  credentialId: string,
): Promise<ApiCredentialRecord | null> {
  const db = database();
  const [record] = await db
    .select({
      id: apiCredentials.id,
      ownerUserId: apiCredentials.ownerUserId,
      label: apiCredentials.label,
      secretHash: apiCredentials.secretHash,
      status: apiCredentials.status,
      expiresAt: apiCredentials.expiresAt,
      lastUsedAt: apiCredentials.lastUsedAt,
      metadata: apiCredentials.metadata,
      createdAt: apiCredentials.createdAt,
      updatedAt: apiCredentials.updatedAt,
    })
    .from(apiCredentials)
    .where(eq(apiCredentials.id, credentialId))
    .limit(1);

  return (record as ApiCredentialRecord | undefined) ?? null;
}

async function updateCredentialLastUsedAt(credentialId: string, usedAt: Date) {
  const db = database();

  await db
    .update(apiCredentials)
    .set({
      lastUsedAt: usedAt,
      updatedAt: usedAt,
    })
    .where(eq(apiCredentials.id, credentialId));
}

function parseBearerCredential(request: Request) {
  const authorization = request.headers.get("authorization");

  if (!authorization) {
    return null;
  }

  const [scheme, rawToken] = authorization.split(/\s+/, 2);

  if (scheme !== "Bearer" || !rawToken) {
    return "malformed" as const;
  }

  const separatorIndex = rawToken.indexOf(".");

  if (separatorIndex <= 0 || separatorIndex === rawToken.length - 1) {
    return "malformed" as const;
  }

  return {
    credentialId: rawToken.slice(0, separatorIndex),
    secret: rawToken.slice(separatorIndex + 1),
  };
}

async function auditCredentialEvent(args: {
  credentialId: string;
  ownerUserId?: number | null;
  eventType: string;
  outcome: string;
  detail?: Record<string, unknown>;
}) {
  await apiCredentialTestHooks.writeAuditLogImpl({
    actorUserId: args.ownerUserId ?? null,
    eventType: args.eventType,
    resourceType: "api_credential",
    resourceId: args.credentialId,
    outcome: args.outcome,
    detail: args.detail,
  });
}

export async function authenticateApiCredential(
  request: Request,
): Promise<AuthenticatedApiCredential> {
  const parsed = parseBearerCredential(request);

  if (parsed == null) {
    await auditCredentialEvent({
      credentialId: "missing",
      eventType: "api_credential.authentication_failed",
      outcome: "missing",
    });
    throwPublicApiError(
      "API_CREDENTIAL_MISSING",
      "API credential is required.",
      { status: 401 },
    );
  }

  if (parsed === "malformed") {
    await auditCredentialEvent({
      credentialId: "malformed",
      eventType: "api_credential.authentication_failed",
      outcome: "invalid",
    });
    throwPublicApiError(
      "API_CREDENTIAL_INVALID",
      "API credential is invalid.",
      { status: 401 },
    );
  }

  const credential = await apiCredentialTestHooks.getCredentialByIdImpl(
    parsed.credentialId,
  );

  if (!credential) {
    await auditCredentialEvent({
      credentialId: parsed.credentialId,
      eventType: "api_credential.authentication_failed",
      outcome: "invalid",
    });
    throwPublicApiError(
      "API_CREDENTIAL_INVALID",
      "API credential is invalid.",
      { status: 401 },
    );
  }

  if (credential.status === "revoked") {
    await auditCredentialEvent({
      credentialId: credential.id,
      ownerUserId: credential.ownerUserId,
      eventType: "api_credential.authentication_failed",
      outcome: "revoked",
    });
    throwPublicApiError(
      "API_CREDENTIAL_REVOKED",
      "API credential has been revoked.",
      { status: 403 },
    );
  }

  if (credential.expiresAt && credential.expiresAt.getTime() <= Date.now()) {
    await auditCredentialEvent({
      credentialId: credential.id,
      ownerUserId: credential.ownerUserId,
      eventType: "api_credential.authentication_failed",
      outcome: "expired",
    });
    throwPublicApiError(
      "API_CREDENTIAL_EXPIRED",
      "API credential has expired.",
      { status: 403 },
    );
  }

  const expectedHash = hashApiCredentialSecret(credential.id, parsed.secret);

  if (credential.secretHash !== expectedHash) {
    await auditCredentialEvent({
      credentialId: credential.id,
      ownerUserId: credential.ownerUserId,
      eventType: "api_credential.authentication_failed",
      outcome: "invalid",
    });
    throwPublicApiError(
      "API_CREDENTIAL_INVALID",
      "API credential is invalid.",
      { status: 401 },
    );
  }

  const now = new Date();
  await apiCredentialTestHooks.updateCredentialLastUsedAtImpl(
    credential.id,
    now,
  );
  await auditCredentialEvent({
    credentialId: credential.id,
    ownerUserId: credential.ownerUserId,
    eventType: "api_credential.authenticated",
    outcome: "success",
    detail: {
      request_id: getRequestContext().requestId,
    },
  });

  return {
    id: credential.id,
    ownerUserId: credential.ownerUserId,
    label: credential.label,
    metadata: credential.metadata,
  };
}
