import { z } from 'zod';

export const zPaginationParams = z.object({
  page: z.number().optional(),
  limit: z.number().optional(),
  order: z.enum(['asc', 'desc']).optional()
});

export type PaginationParams = z.infer<typeof zPaginationParams>;

export const zLogEntry = z.object({
  id: z.number(),
  user_id: z.number().nullable(),
  request_session_id: z.number().nullable(),
  test_session_id: z.number().nullable(),
  session_inc_id: z.number().nullable(),
  level: z.string(),
  message: z.string().nullable(),
  created_at: z.string()
});

export type LogEntry = z.infer<typeof zLogEntry>;

export const zLogEntryWithStackTrace = zLogEntry.extend({
  stack_trace: z.string().nullable()
});

export type LogEntryWithStackTrace = z.infer<typeof zLogEntryWithStackTrace>;

export const zPaginatedResponse = <T extends z.ZodTypeAny>(itemSchema: T) => z.object({
  data: z.array(itemSchema),
  pagination: z.object({
    page: z.number(),
    limit: z.number(),
    total: z.number(),
    totalPages: z.number()
  })
});

export type PaginatedResponse<T> = {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export const zGetLogsForTestSessionRequest = zPaginationParams.extend({
  testSessionId: z.number()
});

export type GetLogsForTestSessionRequest = z.infer<typeof zGetLogsForTestSessionRequest>;

export const zGetLogsForRequestSessionRequest = zPaginationParams.extend({
  requestSessionId: z.number()
});

export type GetLogsForRequestSessionRequest = z.infer<typeof zGetLogsForRequestSessionRequest>;

export const zGetErrorLogsRequest = zPaginationParams.extend({
  userId: z.number().optional(),
  testSessionId: z.number().optional(),
  requestSessionId: z.number().optional()
});

export type GetErrorLogsRequest = z.infer<typeof zGetErrorLogsRequest>;

export const zGetStackTraceForLogRequest = z.object({
  logId: z.number()
});

export type GetStackTraceForLogRequest = z.infer<typeof zGetStackTraceForLogRequest>;

export const zGetStackTraceForLogResponse = z.object({
  logId: z.number(),
  stackTrace: z.string().nullable()
});

export type GetStackTraceForLogResponse = z.infer<typeof zGetStackTraceForLogResponse>;

export const zGetLogsForTestSessionResponse = zPaginatedResponse(zLogEntry);
export type GetLogsForTestSessionResponse = z.infer<typeof zGetLogsForTestSessionResponse>;

export const zGetLogsForRequestSessionResponse = zPaginatedResponse(zLogEntry);
export type GetLogsForRequestSessionResponse = z.infer<typeof zGetLogsForRequestSessionResponse>;

export const zGetErrorLogsResponse = zPaginatedResponse(zLogEntry);
export type GetErrorLogsResponse = z.infer<typeof zGetErrorLogsResponse>;