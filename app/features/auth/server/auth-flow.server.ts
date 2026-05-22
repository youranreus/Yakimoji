import { redirect } from "react-router";

import { getRequestContext } from "./request-context.server";
import {
  createSsoAuthorizationRequest,
  decodeSsoState,
  exchangeAuthorizationCode,
  fetchSsoUser,
} from "./sso-adapter.server";
import {
  clearSsoStateCookie,
  completeLoginFromSso,
  createSsoStateCookie,
  readSsoStateCookie,
} from "./session.server";
import { getAuthEnvironment } from "../../../server/env.server";

export const authFlowTestHooks = {
  readSsoStateCookieImpl: readSsoStateCookie,
  completeLoginFromSsoImpl: completeLoginFromSso,
  clearSsoStateCookieImpl: clearSsoStateCookie,
};

export function setAuthFlowTestHooks(
  hooks: Partial<typeof authFlowTestHooks>,
) {
  Object.assign(authFlowTestHooks, hooks);
}

function getSsoEnvironment() {
  const environment = getAuthEnvironment();

  return {
    providerName: environment.ssoProviderName,
    baseUrl: environment.ssoBaseUrl,
    clientId: environment.ssoClientId,
    clientSecret: environment.ssoClientSecret,
    callbackUrl: environment.ssoCallbackUrl,
  };
}

export async function beginSsoLogin() {
  const authRequest = createSsoAuthorizationRequest(getSsoEnvironment());

  throw redirect(authRequest.authorizeUrl, {
    headers: {
      "Set-Cookie": await createSsoStateCookie({
        state: authRequest.state,
        verifier: authRequest.verifier,
      }),
    },
  });
}

export async function handleSsoCallback(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (!code || !state) {
    throw new Error("SSO callback missing code or state");
  }

  decodeSsoState(state);
  const stateCookie = await authFlowTestHooks.readSsoStateCookieImpl(request);

  if (!stateCookie || stateCookie.state !== state) {
    throw new Error("SSO state mismatch");
  }

  const token = await exchangeAuthorizationCode(
    getSsoEnvironment(),
    code,
    stateCookie.verifier,
  );
  const ssoUser = await fetchSsoUser(getSsoEnvironment(), token.accessToken);
  const loginResult = await authFlowTestHooks.completeLoginFromSsoImpl(ssoUser);
  const clearCookieHeader = await authFlowTestHooks.clearSsoStateCookieImpl();

  throw redirect("/workspace", {
    headers: {
      "Set-Cookie": `${loginResult.setCookieHeader}, ${clearCookieHeader}`,
      "X-Request-Id": getRequestContext().requestId,
    },
  });
}
