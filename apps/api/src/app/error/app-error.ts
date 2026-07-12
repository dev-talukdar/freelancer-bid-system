export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public errorCode = 'APP_ERROR',
    public details?: unknown,
  ) {
    super(message);
  }
}
export class FreelancerApiError extends AppError {
  constructor(
    statusCode: number,
    message: string,
    public freelancerRequestId?: string,
    errorCode = 'FREELANCER_API_ERROR',
  ) {
    super(statusCode, message, errorCode);
  }
}
export function mapFreelancerError(status: number, body: unknown, requestId?: string) {
  const msg =
    typeof body === 'object' && body && 'message' in body && typeof body.message === 'string'
      ? body.message
      : 'Freelancer API request failed';
  return new FreelancerApiError(
    status,
    msg,
    requestId,
    status === 429 ? 'FREELANCER_RATE_LIMITED' : 'FREELANCER_API_ERROR',
  );
}
