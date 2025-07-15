import { it, expect, vi } from 'vitest'
import { 
    captureError, 
    toException, 
    ErrorWithDetails, 
    recordUnhandledError, 
    startGlobalErrorListener,
    errorAsStreamEvent
} from '../Errors'
import { c_log_error, c_item } from '../EventType'

it('captureError handles Error instances', () => {
    const error = new Error('Test error');
    const result = captureError(error);
    
    expect(result.errorMessage).toBe('Test error');
    expect(result.errorType).toBe('unhandled_exception');
    expect(result.stack).toBe(error.stack);
    expect(result.errorId).toBeDefined();
});

it('captureError handles string errors', () => {
    const result = captureError('String error');
    
    expect(result.errorMessage).toBe('String error');
    expect(result.errorType).toBe('generic_error');
    expect(result.errorId).toBeDefined();
});

it('captureError handles null/undefined', () => {
    const result = captureError(null);
    
    expect(result.errorMessage).toBe('Unknown error');
    expect(result.errorType).toBe('unknown_error');
    expect(result.errorId).toBeTruthy();
});

it('captureError handles ErrorWithDetails instances', () => {
    const originalError = { 
        errorMessage: 'Original error',
        errorType: 'custom_error',
        errorId: 'existing-id'
    };
    const errorWithDetails = new ErrorWithDetails(originalError);
    
    const result = captureError(errorWithDetails);
    
    expect(result.errorMessage).toBe('Original error');
    expect(result.errorType).toBe('custom_error');
    expect(result.errorId).toBe('existing-id');
});

it('captureError handles error-like objects', () => {
    const errorLike = {
        message: 'Error like object',
        stack: 'fake stack',
        errorType: 'custom'
    };
    
    const result = captureError(errorLike as any);
    
    expect(result.errorMessage).toBe('Error like object');
    expect(result.errorType).toBe('custom');
    expect(result.stack).toBe('fake stack');
});

it('captureError adds related information', () => {
    const related = [{ key: 'value' }];
    const result = captureError('Test error', related);
    
    expect(result.related).toEqual(related);
});

it('captureError detects not found errors', () => {
    const error = new Error('Not found: missing item');
    const result = captureError(error);
    
    expect(result.errorType).toBe('not_found');
});

it('toException converts ErrorDetails to ErrorWithDetails', () => {
    const errorDetails = {
        errorMessage: 'Test error',
        errorType: 'test_error',
        errorId: 'test-id'
    };
    
    const exception = toException(errorDetails);
    
    expect(exception).toBeInstanceOf(ErrorWithDetails);
    expect(exception.message).toBe('Test error');
    expect(exception.errorItem).toBe(errorDetails);
});

it('ErrorWithDetails toString formats properly', () => {
    const errorDetails = {
        errorMessage: 'Test error',
        errorType: 'test_error',
        errorId: 'test-id',
        stack: 'test stack'
    };
    
    const exception = new ErrorWithDetails(errorDetails);
    const str = exception.toString();
    
    expect(str).toContain('error (test_error): Test error');
    expect(str).toContain('Stack trace: test stack');
});

it('errorAsStreamEvent creates log error event', () => {
    const errorDetails = {
        errorMessage: 'Test error',
        errorType: 'test_error'
    };
    
    const event = errorAsStreamEvent(errorDetails);
    
    expect(event.t).toBe(c_log_error);
    expect(event.error).toBe(errorDetails);
});

it('recordUnhandledError sends to global listeners', () => {
    const listener = startGlobalErrorListener();
    const error = new Error('Unhandled error');
    
    recordUnhandledError(error);
    
    const backlogItems = listener.takeBacklogItems();
    expect(backlogItems.length).toBe(1);
    expect(backlogItems[0].errorMessage).toBe('Unhandled error');
});

it('startGlobalErrorListener returns stream', () => {
    const listener = startGlobalErrorListener();
    
    expect(listener).toBeDefined();
    expect(typeof listener.pipe).toBe('function');
});

it('handles cause chains in ErrorWithDetails', () => {
    const cause = {
        errorMessage: 'Root cause',
        errorType: 'root_error'
    };
    
    const errorWithCause = new ErrorWithDetails({
        errorMessage: 'Wrapper error',
        errorType: 'wrapper_error',
        cause
    });
    
    const result = captureError(errorWithCause);
    
    expect(result.cause).toBe(cause);
});