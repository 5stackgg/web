const AUTH_ERROR_MESSAGES = [
  "Unauthorized",
  "webhook authentication request",
  "Invalid response from authorization hook",
];

export function isAuthErrorMessage(message: string): boolean {
  return AUTH_ERROR_MESSAGES.includes(message);
}

export function isAuthError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const { graphQLErrors, networkError } = error as {
    graphQLErrors?: Array<{ message: string }>;
    networkError?: { statusCode?: number };
  };

  if (graphQLErrors?.some(({ message }) => isAuthErrorMessage(message))) {
    return true;
  }

  return networkError?.statusCode === 401;
}
