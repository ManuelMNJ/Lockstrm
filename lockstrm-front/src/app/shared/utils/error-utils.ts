interface HttpErrorBody {
  error?:   string;
  mensaje?: string;
}

interface HttpErrorResponse {
  error?: HttpErrorBody;
}

export function extractHttpErrorMessage(err: unknown, defaultMsg: string): string {
  const body = (err as HttpErrorResponse)?.error;
  return body?.error ?? body?.mensaje ?? defaultMsg;
}
