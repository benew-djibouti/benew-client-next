// Types d'erreurs (même pattern que templates)
export const ERROR_TYPES = {
  DATABASE_ERROR: 'database_error',
  TIMEOUT: 'timeout',
  CONNECTION_ERROR: 'connection_error',
  PERMISSION_ERROR: 'permission_error',
  NETWORK_ERROR: 'network_error',
  UNKNOWN_ERROR: 'unknown_error',
  IMAGE_LOADING_ERROR: 'image_loading_error',
  NOT_FOUND: 'not_found',
  VALIDATION_ERROR: 'validation_error',
};

export const PG_ERROR_CODES = {
  CONNECTION_FAILURE: '08001',
  CONNECTION_EXCEPTION: '08000',
  QUERY_CANCELED: '57014',
  ADMIN_SHUTDOWN: '57P01',
  CRASH_SHUTDOWN: '57P02',
  CANNOT_CONNECT: '57P03',
  UNDEFINED_TABLE: '42P01',
  INSUFFICIENT_PRIVILEGE: '42501',
  AUTHENTICATION_FAILED: '28000',
  INVALID_PASSWORD: '28P01',
  DATABASE_DROPPED: '57P04',
};

// =============================
// CLASSIFICATION D'ERREURS
// =============================

export function classifyError(error) {
  if (!error) {
    return {
      type: ERROR_TYPES.UNKNOWN_ERROR,
      shouldRetry: false,
      httpStatus: 500,
      userMessage: 'Une erreur inattendue est survenue.',
    };
  }

  const code = error.code;
  const message = (error.message || '').toLowerCase();

  if (
    [
      PG_ERROR_CODES.CONNECTION_FAILURE,
      PG_ERROR_CODES.CONNECTION_EXCEPTION,
      PG_ERROR_CODES.CANNOT_CONNECT,
      PG_ERROR_CODES.ADMIN_SHUTDOWN,
      PG_ERROR_CODES.CRASH_SHUTDOWN,
      PG_ERROR_CODES.DATABASE_DROPPED, // ← ajouter
    ].includes(code)
  ) {
    return {
      type: ERROR_TYPES.CONNECTION_ERROR,
      shouldRetry: true,
      httpStatus: 503,
      userMessage:
        'Service temporairement indisponible. Veuillez réessayer dans quelques instants.',
    };
  }

  if (
    code === PG_ERROR_CODES.QUERY_CANCELED ||
    message.includes('timeout') ||
    error.name === 'TimeoutError'
  ) {
    return {
      type: ERROR_TYPES.TIMEOUT,
      shouldRetry: true,
      httpStatus: 503,
      userMessage:
        'Le chargement a pris trop de temps. Le serveur est peut-être surchargé.',
    };
  }

  if (
    [
      PG_ERROR_CODES.INSUFFICIENT_PRIVILEGE,
      PG_ERROR_CODES.AUTHENTICATION_FAILED,
      PG_ERROR_CODES.INVALID_PASSWORD,
    ].includes(code)
  ) {
    return {
      type: ERROR_TYPES.PERMISSION_ERROR,
      shouldRetry: false,
      httpStatus: 500,
      userMessage: 'Erreur de configuration serveur.',
    };
  }

  if (code === PG_ERROR_CODES.UNDEFINED_TABLE) {
    return {
      type: ERROR_TYPES.DATABASE_ERROR,
      shouldRetry: false,
      httpStatus: 500,
      userMessage: 'Erreur de configuration serveur.',
    };
  }

  if (
    message.includes('network') ||
    message.includes('fetch') ||
    message.includes('econnrefused')
  ) {
    return {
      type: ERROR_TYPES.NETWORK_ERROR,
      shouldRetry: true,
      httpStatus: 503,
      userMessage: 'Problème de connexion réseau.',
    };
  }

  if (message.includes('cloudinary') || message.includes('image')) {
    return {
      type: ERROR_TYPES.IMAGE_LOADING_ERROR,
      shouldRetry: true,
      httpStatus: 503,
      userMessage: 'Problème de chargement des images.',
    };
  }

  return {
    type: ERROR_TYPES.DATABASE_ERROR,
    shouldRetry: false,
    httpStatus: 500,
    userMessage: 'Une erreur inattendue est survenue lors du chargement.',
  };
}
