interface HttpErrorBody {
  error?:   string;
  mensaje?: string;
  message?: string;   // Spring usa 'message'; algunos endpoints nuestros también
}

interface HttpErrorResponse {
  error?: HttpErrorBody;
}

function isHttpErrorResponse(err: unknown): err is HttpErrorResponse {
  return typeof err === 'object' && err !== null && 'error' in err;
}

export function extractHttpErrorMessage(err: unknown, defaultMsg: string): string {
  if (!isHttpErrorResponse(err)) return defaultMsg;
  const body = err.error;
  return body?.error ?? body?.mensaje ?? body?.message ?? defaultMsg;
}
