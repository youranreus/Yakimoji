import { data, redirect } from "react-router";

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

function authenticationFailure(
  message: string,
  status = 401,
  detail?: Record<string, unknown>,
) {
  const requestId = getRequestContext().requestId;

  throw data(
    {
      code: "authentication_failed",
      message,
      request_id: requestId,
      detail: detail ?? null,
    },
    {
      status,
      headers: {
        "X-Request-Id": requestId,
      },
    },
  );
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
  try {
    const url = new URL(request.url);
    const codeParam = url.searchParams.get("code");
    const stateParam = url.searchParams.get("state");

    if (!codeParam || !stateParam) {
      authenticationFailure("SSO 回调缺少 code 或 state。");
    }

    const code = codeParam!;
    const state = stateParam!;

    try {
      decodeSsoState(state);
    } catch {
      authenticationFailure("SSO state 无法解析。");
    }

    const stateCookie = await authFlowTestHooks.readSsoStateCookieImpl(request);

    if (!stateCookie || stateCookie.state !== state) {
      authenticationFailure("SSO state 校验失败。");
    }

    const verifiedStateCookie = stateCookie!;

    const token = await exchangeAuthorizationCode(
      getSsoEnvironment(),
      code,
      verifiedStateCookie.verifier,
    );
    const ssoUser = await fetchSsoUser(getSsoEnvironment(), token.accessToken);
    const loginResult = await authFlowTestHooks.completeLoginFromSsoImpl(ssoUser);
    const clearCookieHeader = await authFlowTestHooks.clearSsoStateCookieImpl();
    const headers = new Headers({
      "X-Request-Id": getRequestContext().requestId,
    });

    headers.append("Set-Cookie", loginResult.setCookieHeader);
    headers.append("Set-Cookie", clearCookieHeader);

    throw redirect("/workspace", {
      headers,
    });
  } catch (error) {
    if (error instanceof Response || error?.constructor?.name === "DataWithResponseInit") {
      throw error;
    }

    authenticationFailure("SSO 登录流程失败。", 502, {
      cause: error instanceof Error ? error.message : "unknown",
    });
  }
}
