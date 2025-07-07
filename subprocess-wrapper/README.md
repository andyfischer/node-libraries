
# subprocess-wrapper #

Helpful layer on a Node subprocess.

Includes:

 - Parses stdout and stderr as lines.
 - Allows the caller to add `onStdout` and `onStderr` callbacks.
 - Catches errors.
 - Provides promises to wait on.
