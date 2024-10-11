export const errorMap = {
    ENOTFOUND: 'The server could not be found.',
    ETIMEDOUT: 'The request timed out..',
    ECONNREFUSED: 'Connection was refused. ',
    EHOSTUNREACH: 'The server is unreachable.',
    // Add this new mapping
    FETCH_FAILED: 'The request to the server failed.',
    // Add more mappings as needed
  };
  
  export function getUserFriendlyMessage(error) {
    // Check for nested errors (like in the 'cause' property)
    if (error.cause && error.cause.code && errorMap[error.cause.code]) {
      return errorMap[error.cause.code];
    }
    // Check for direct error codes
    if (error.code && errorMap[error.code]) {
      return errorMap[error.code];
    }
    // Check for specific error messages
    if (error.message === 'fetch failed') {
      return errorMap.FETCH_FAILED;
    }
    // If no specific error is found, return a generic message
    return `An unexpected error occurred: ${error.message}`;
  }

  // New function to log detailed errors
export function logDetailedError(error, context = '') {
    const errorDetails = {
      name: error.name,
      message: error.message,
      stack: error.stack,
      code: error.code || (error.cause && error.cause.code) || null,
      syscall: error.syscall || (error.cause && error.cause.syscall) || null,
      hostname: error.hostname || (error.cause && error.cause.hostname) || null,
      // Add more properties as needed
    };
    //console.error(`Detailed Error${context ? ` [${context}]` : ''}:`, JSON.stringify(errorDetails, null, 2));
  }