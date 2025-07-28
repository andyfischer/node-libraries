import { getDatabase } from '../database';
import {
  GetLogsForTestSessionRequest,
  GetLogsForTestSessionResponse,
  GetLogsForRequestSessionRequest,
  GetLogsForRequestSessionResponse,
  GetErrorLogsRequest,
  GetErrorLogsResponse,
  GetStackTraceForLogRequest,
  GetStackTraceForLogResponse,
  LogEntry
} from '../schemas';

interface DbStackTraceResult {
  stack_trace_text: string;
}

function buildPaginationQuery(page: number = 1, limit: number = 50, order: 'asc' | 'desc' = 'desc'): { offset: number; limitClause: string; orderClause: string } {
  const offset = (page - 1) * limit;

  if (typeof limit !== 'number' || typeof offset !== 'number' || isNaN(limit) || isNaN(offset)) {
    throw new Error('Pagination parameters "limit" and "offset" must be numbers');
  }

  const limitClause = `LIMIT ${limit} OFFSET ${offset}`;
  const orderClause = order === 'asc' ? 'ASC' : 'DESC';
  
  return { offset, limitClause, orderClause };
}

function createPaginationResponse<T>(data: T[], page: number, limit: number, total: number) {
  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  };
}

export function getLogsForTestSession(request: GetLogsForTestSessionRequest): GetLogsForTestSessionResponse {
  try {
    // Validate input
    if (!request.testSessionId || request.testSessionId <= 0) {
      throw new Error('Invalid testSessionId provided');
    }
    
    if (request.limit && (request.limit <= 0 || request.limit > 1000)) {
      throw new Error('Limit must be between 1 and 1000');
    }
    
    const db = getDatabase();
    const { testSessionId, page = 1, limit = 50, order = 'desc' } = request;
    
    const { limitClause, orderClause } = buildPaginationQuery(page, limit, order);
    
    // Get total count
    const total = db.count('from log_events where test_session_id = ?', [testSessionId]);
    
    // Get logs
    const logs = db.list(`
      SELECT id, user_id, request_session_id, test_session_id, session_inc_id, level, message, created_at
      FROM log_events 
      WHERE test_session_id = ?
      ORDER BY created_at ${orderClause}, session_inc_id ${orderClause}
      ${limitClause}
    `, [testSessionId]) as LogEntry[];
    
    return createPaginationResponse(logs, page, limit, total);
  } catch (error) {
    throw new Error(`Failed to retrieve logs for test session ${request.testSessionId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export function getLogsForRequestSession(request: GetLogsForRequestSessionRequest): GetLogsForRequestSessionResponse {
  try {
    // Validate input
    if (!request.requestSessionId || request.requestSessionId <= 0) {
      throw new Error('Invalid requestSessionId provided');
    }
    
    if (request.limit && (request.limit <= 0 || request.limit > 1000)) {
      throw new Error('Limit must be between 1 and 1000');
    }
    
    const db = getDatabase();
    const { requestSessionId, page = 1, limit = 50, order = 'desc' } = request;
    
    const { limitClause, orderClause } = buildPaginationQuery(page, limit, order);
    
    // Get total count
    const total = db.count('from log_events where request_session_id = ?', [requestSessionId]);
    
    // Get logs
    const logs = db.list(`
      SELECT id, user_id, request_session_id, test_session_id, session_inc_id, level, message, created_at
      FROM log_events 
      WHERE request_session_id = ?
      ORDER BY created_at ${orderClause}, session_inc_id ${orderClause}
      ${limitClause}
    `, [requestSessionId]) as LogEntry[];
    
    return createPaginationResponse(logs, page, limit, total);
  } catch (error) {
    throw new Error(`Failed to retrieve logs for request session ${request.requestSessionId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export function getErrorLogs(request: GetErrorLogsRequest): GetErrorLogsResponse {
  try {
    // Validate input
    if (request.limit && (request.limit <= 0 || request.limit > 1000)) {
      throw new Error('Limit must be between 1 and 1000');
    }
    
    const db = getDatabase();
    const { userId, testSessionId, requestSessionId, page = 1, limit = 50, order = 'desc' } = request;
    
    const { limitClause, orderClause } = buildPaginationQuery(page, limit, order);
    
    // Build parameterized query safely
    const conditions: string[] = ['level = ?'];
    const params: (string | number)[] = ['error'];
    
    if (userId !== undefined) {
      conditions.push('user_id = ?');
      params.push(userId);
    }
    
    if (testSessionId !== undefined) {
      conditions.push('test_session_id = ?');
      params.push(testSessionId);
    }
    
    if (requestSessionId !== undefined) {
      conditions.push('request_session_id = ?');
      params.push(requestSessionId);
    }
    
    const whereClause = conditions.join(' AND ');
    
    // Get total count with parameterized query
    const total = db.count(`from log_events where ${whereClause}`, params);
    
    // Get logs with parameterized query
    const logs = db.list(`
      SELECT id, user_id, request_session_id, test_session_id, session_inc_id, level, message, created_at
      FROM log_events 
      WHERE ${whereClause}
      ORDER BY created_at ${orderClause}
      ${limitClause}
    `, params) as LogEntry[];
    
    return createPaginationResponse(logs, page, limit, total);
  } catch (error) {
    throw new Error(`Failed to retrieve error logs: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export function getStackTraceForLog(request: GetStackTraceForLogRequest): GetStackTraceForLogResponse {
  try {
    // Validate input
    if (!request.logId || request.logId <= 0) {
      throw new Error('Invalid logId provided');
    }
    
    const db = getDatabase();
    const { logId } = request;
    
    const result = db.get(`
      SELECT stack_trace_text
      FROM log_event_stacks 
      WHERE log_event_id = ?
      LIMIT 1
    `, [logId]) as DbStackTraceResult | undefined;
    
    return {
      logId,
      stackTrace: result?.stack_trace_text || null
    };
  } catch (error) {
    throw new Error(`Failed to retrieve stack trace for log ${request.logId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}