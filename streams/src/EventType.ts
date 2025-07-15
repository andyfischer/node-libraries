import { ErrorDetails } from "./Errors";

export enum EventType {
    /// Core stream events ///

    // 'item' - A response item.
    c_item = 100,

    // 'done' - The request was successful and all data items were sent. The stream is closed.
    c_done = 200,

    // 'fail' - The request failed. Any sent items may have been incomplete. The stream is closed.
    c_fail = 400,

    // 'hint' - Whether to expect a single result or multiple results.
    c_hint = 1000,

    /// Logging events ///

    // 'log_info' - An info-level log message related to the server operation. Should only be used for debugging,
    c_log_info = 701,

    // 'log_warn' - An warning-level log message related to the server operation. Should only be used for debugging,
    c_log_warn = 702,

    // 'log_error' - An error-level log message related to the server operation. Should only be used for debugging,
    c_log_error = 703,

};

export const c_item = EventType.c_item;
export const c_done = EventType.c_done;
export const c_fail = EventType.c_fail;
export const c_hint = EventType.c_hint;
export const c_log_info = EventType.c_log_info;
export const c_log_warn = EventType.c_log_warn;
export const c_log_error = EventType.c_log_error;

export const c_hint_single_item = 1001;
export const c_hint_list = 1002;

export interface StreamItem<ItemType = any> { t: EventType.c_item, item: ItemType }
export interface StreamFail { t: EventType.c_fail, error: ErrorDetails, }
export interface StreamDone { t: EventType.c_done }

export interface StreamHint {
    t: EventType.c_hint,
    result: typeof c_hint_single_item | typeof c_hint_list,
}

export interface StreamLogInfo {
    t: EventType.c_log_info
    message: string
    details?: Record<string, any>
}

export interface StreamLogWarn {
    t: EventType.c_log_warn
    message: string
    details?: Record<string, any>
}

export interface StreamLogError {
    t: EventType.c_log_error
    error: ErrorDetails
}

export type StreamEvent<ItemType = any> =
    | StreamItem<ItemType>
    | StreamFail
    | StreamLogInfo | StreamLogWarn | StreamLogError
    | StreamDone
    | StreamHint;
