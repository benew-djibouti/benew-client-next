// backend/dbConnect.js
// Connection PostgreSQL optimisée pour petites applications (500 visiteurs/jour)
// Next.js 15 + PostgreSQL + Sentry - Version pragmatique

import { promises as fs } from 'fs';
import { Pool } from 'pg';
import { captureException, captureMessage } from '../sentry.server.config';
import path from 'path';

// Configuration simple et adaptée
const isProduction = process.env.NODE_ENV === 'production';
const isDevelopment = process.env.NODE_ENV === 'development';

// Variable pour le certificat (chargé en lazy loading)
let cachedCertificate = null;
let certificateLoadAttempted = false;

// Fonction pour charger le certificat (appelée seulement au runtime)
async function loadCertificate() {
  // Ne charger qu'une fois
  if (certificateLoadAttempted) return cachedCertificate;
  certificateLoadAttempted = true;

  // Skip le chargement pendant le build
  if (process.env.CI || process.env.GITHUB_ACTIONS) {
    console.log('Skipping certificate load during CI/build');
    return null;
  }

  const workingDir = process.cwd();

  // Chemins possibles pour le certificat
  const certPaths = [
    // Production: chemin absolu direct
    '/var/www/benew/certs/ca-certificate.crt',
    // Production: depuis standalone
    workingDir.includes('.next/standalone')
      ? path.join(workingDir, '..', '..', 'certs', 'ca-certificate.crt')
      : null,
    // Dev local (si vous avez le certificat localement)
    path.join(workingDir, 'certs', 'ca-certificate.crt'),
  ].filter(Boolean);

  console.log('🔍 Attempting to load certificate from paths:', certPaths);

  for (const certPath of certPaths) {
    try {
      const content = await fs.readFile(certPath, 'utf8');
      console.log(`✅ Certificate loaded from: ${certPath}`);
      cachedCertificate = content;
      return content;
    } catch (error) {
      // Silencieux, on essaie le suivant
    }
  }

  console.log('⚠️ No certificate found, using SSL without CA verification');
  return null;
}

const CONFIG = {
  // Pool adapté pour 500 visiteurs/jour
  pool: {
    max: 20, // Largement suffisant pour le trafic
    min: 2, // Une connexion minimum
    idleTimeoutMillis: 30000, // 30 secondes
    connectionTimeoutMillis: 5000,
  },

  // Monitoring simple
  monitoring: {
    healthCheckInterval: isProduction ? 60 * 60 * 1000 : 5 * 60 * 1000, // 60min prod
    enableMetrics: isDevelopment, // Métriques seulement en dev
  },

  // Retry basique
  retry: {
    maxAttempts: 3,
    delay: 2000,
  },

  // Logging conditionnel
  logging: {
    enabled: isDevelopment || process.env.DB_DETAILED_LOGS === 'true',
    healthChecks: isDevelopment,
  },
};

// Variables globales
let pool;
let healthCheckInterval;

// 🔥 NOUVELLE VARIABLE : Promise d'initialisation
let initializationPromise = null;

// Utilitaires
const getTimestamp = () => new Date().toISOString();

// =============================================
// CONFIGURATION BASE DE DONNÉES SIMPLIFIÉE
// =============================================

async function getDatabaseConfig() {
  // Charger le certificat en lazy loading (seulement en production)
  let certificate = null;
  if (process.env.NODE_ENV === 'production') {
    certificate = await loadCertificate();
  }

  const config = {
    host: process.env.DB_HOST_NAME || process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME,
    user: process.env.DB_USER_NAME || process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl:
      process.env.NODE_ENV === 'production'
        ? certificate
          ? {
              rejectUnauthorized: true, // ← vérification activée si on a le CA
              ca: certificate,
            }
          : {
              rejectUnauthorized: false, // ← fallback sans CA — accepté mais loggé
            }
        : false,
  };

  if (!certificate) {
    // ← warning visible dans les logs Vercel/PM2
    console.warn(
      '[DB] ⚠️ Certificat CA non trouvé — connexion SSL sans vérification. ' +
        'Risque MITM si la DB est sur un réseau non sécurisé.',
    );
    captureMessage('SSL connection without certificate verification', {
      level: 'warning',
      tags: { component: 'database_pool', security: 'ssl_no_verify' },
    });
  }

  if (CONFIG.logging.enabled) {
    console.log(`[${getTimestamp()}] ✅ Configuration base de données chargée`);
  }

  return config;
}

// =============================================
// CRÉATION DU POOL SIMPLIFIÉ
// =============================================

async function createPool() {
  const config = await getDatabaseConfig(); // Ajouter await

  const poolConfig = {
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    password: config.password,
    ssl: config.ssl,

    // Configuration optimisée pour petite application
    max: CONFIG.pool.max,
    min: CONFIG.pool.min,
    idleTimeoutMillis: CONFIG.pool.idleTimeoutMillis,
    connectionTimeoutMillis: CONFIG.pool.connectionTimeoutMillis,
  };

  const newPool = new Pool(poolConfig);

  if (CONFIG.logging.enabled) {
    console.log(
      `[${getTimestamp()}] 🔧 Pool créé avec ${CONFIG.pool.max} connexions max`,
    );
  }

  // statement_timeout : PostgreSQL annule toute requête dépassant 10s
  // Protège le pool contre les requêtes bloquées (deadlocks, table locks)
  // Complémentaire aux withTimeout() Node.js des pages — agit côté PostgreSQL
  newPool.on('connect', async (client) => {
    await client.query('SET statement_timeout = 10000');
  });

  // Gestion d'erreurs critiques uniquement
  newPool.on('error', (err, client) => {
    console.error(
      `[${getTimestamp()}] 🚨 Erreur critique du pool:`,
      err.message,
    );

    captureException(err, {
      tags: {
        component: 'database_pool',
        error_type: 'pool_error',
      },
      extra: {
        poolInfo: {
          totalCount: newPool.totalCount,
          idleCount: newPool.idleCount,
          waitingCount: newPool.waitingCount,
        },
      },
    });
  });

  // Events basiques en développement seulement
  if (CONFIG.logging.enabled) {
    newPool.on('connect', (client) => {
      console.log(
        `[${getTimestamp()}] 🔗 Nouvelle connexion (Total: ${newPool.totalCount})`,
      );
    });

    newPool.on('remove', (client) => {
      console.log(
        `[${getTimestamp()}] 🗑️ Connexion supprimée (Total: ${newPool.totalCount})`,
      );
    });
  }

  return newPool;
}

// =============================================
// HEALTH CHECK SIMPLE
// =============================================

async function performHealthCheck() {
  if (!pool) return { status: 'no_pool' };

  const startTime = Date.now();

  try {
    const client = await pool.connect();
    const result = await client.query(
      'SELECT NOW() as current_time, version() as pg_version',
    );
    client.release();

    const responseTime = Date.now() - startTime;
    const pgVersion = result.rows[0].pg_version.split(' ')[0];

    if (CONFIG.logging.healthChecks) {
      console.log(
        `[${getTimestamp()}] 🏥 Health Check OK: ${responseTime}ms, PG ${pgVersion}`,
      );
    }

    return {
      status: 'healthy',
      responseTime,
      pgVersion,
      poolInfo: {
        total: pool.totalCount,
        idle: pool.idleCount,
        waiting: pool.waitingCount,
      },
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error(`[${getTimestamp()}] 🚨 Health Check échoué:`, error.message);

    captureException(error, {
      tags: {
        component: 'database_pool',
        error_type: 'health_check_failed',
      },
      extra: { responseTime: Date.now() - startTime },
    });

    return {
      status: 'unhealthy',
      error: error.message,
      responseTime: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    };
  }
}

// =============================================
// RECONNEXION SIMPLIFIÉE
// =============================================

async function reconnectPool(attempt = 1) {
  console.log(
    `[${getTimestamp()}] 🔄 Reconnexion tentative ${attempt}/${CONFIG.retry.maxAttempts}`,
  );

  // Arrêter le monitoring
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
    healthCheckInterval = null;
  }

  // Fermer l'ancien pool
  try {
    if (pool) await pool.end();
  } catch (err) {
    if (CONFIG.logging.enabled) {
      console.warn(
        `[${getTimestamp()}] ⚠️ Erreur fermeture pool:`,
        err.message,
      );
    }
  }

  try {
    pool = await createPool();

    // Test de connexion
    const client = await pool.connect();
    client.release();

    console.log(
      `[${getTimestamp()}] ✅ Reconnexion réussie (tentative ${attempt})`,
    );

    captureMessage(`Pool reconnecté avec succès (tentative ${attempt})`, {
      level: 'info',
      tags: { component: 'database_pool', operation: 'reconnection_success' },
      extra: { attempt, maxAttempts: CONFIG.retry.maxAttempts },
    });

    // Redémarrer le monitoring
    startHealthCheckMonitoring();
  } catch (error) {
    console.error(
      `[${getTimestamp()}] ❌ Reconnexion tentative ${attempt} échouée:`,
      error.message,
    );

    if (attempt < CONFIG.retry.maxAttempts) {
      setTimeout(() => reconnectPool(attempt + 1), CONFIG.retry.delay);
    } else {
      console.error(
        `[${getTimestamp()}] 🚨 Échec final après ${CONFIG.retry.maxAttempts} tentatives`,
      );

      // Réinitialiser la promise pour permettre une nouvelle tentative
      // au prochain appel getClient() si PostgreSQL revient
      initializationPromise = null;

      captureMessage('Reconnexion finale échouée', {
        level: 'error',
        tags: { component: 'database_pool', error_type: 'reconnection_failed' },
        extra: {
          maxAttempts: CONFIG.retry.maxAttempts,
          lastError: error.message,
        },
      });
    }
  }
}

// =============================================
// MONITORING BASIQUE
// =============================================

function startHealthCheckMonitoring() {
  if (!CONFIG.monitoring.healthCheckInterval) return;

  healthCheckInterval = setInterval(async () => {
    const health = await performHealthCheck();

    // Alerte seulement si problème critique
    if (health.status === 'unhealthy') {
      console.error(`[${getTimestamp()}] 🚨 Base de données non disponible`);

      captureMessage('Database health check failed', {
        level: 'error',
        tags: { component: 'database_pool', issue_type: 'health_critical' },
        extra: health,
      });
    }
  }, CONFIG.monitoring.healthCheckInterval);

  if (CONFIG.logging.enabled) {
    console.log(
      `[${getTimestamp()}] 📊 Health check démarré (${CONFIG.monitoring.healthCheckInterval / 1000}s)`,
    );
  }
}

// =============================================
// 🔥 FONCTION D'INITIALISATION REFACTORISÉE
// =============================================

async function initializePool() {
  try {
    if (CONFIG.logging.enabled) {
      console.log(
        `[${getTimestamp()}] 🚀 Initialisation du pool PostgreSQL...`,
      );
    }

    pool = await createPool();

    // Test initial
    const client = await pool.connect();
    const testResult = await client.query(
      'SELECT NOW() as startup_time, version() as pg_version',
    );
    client.release();

    console.log(`[${getTimestamp()}] ✅ Connexion PostgreSQL établie`);
    if (CONFIG.logging.enabled) {
      console.log(
        `[${getTimestamp()}] 🐘 ${testResult.rows[0].pg_version.split(' ')[0]}`,
      );
    }

    captureMessage('Database pool initialized successfully', {
      level: 'info',
      tags: { component: 'database_pool', operation: 'initialization' },
      extra: {
        pgVersion: testResult.rows[0].pg_version.split(' ')[0],
        maxConnections: CONFIG.pool.max,
        environment: process.env.NODE_ENV,
      },
    });

    // Démarrer le monitoring
    setTimeout(() => {
      startHealthCheckMonitoring();
      if (CONFIG.logging.enabled) {
        console.log(`[${getTimestamp()}] ✅ Pool prêt avec monitoring`);
      }
    }, 1000);

    return pool;
  } catch (error) {
    console.error(
      `[${getTimestamp()}] ❌ Échec initialisation:`,
      error.message,
    );

    captureException(error, {
      tags: { component: 'database_pool', error_type: 'initialization_failed' },
      extra: { retryAction: 'attempting_reconnection' },
    });

    // Tentative de reconnexion
    setTimeout(() => reconnectPool(), 2000);
    throw error;
  }
}

// =============================================
// 🔥 CLIENT MANAGEMENT AVEC ATTENTE
// =============================================

export const getClient = async () => {
  // 🔥 ATTENDRE QUE L'INITIALISATION SOIT TERMINÉE
  if (!initializationPromise) {
    initializationPromise = initializePool();
  }

  await initializationPromise;

  // Maintenant on est sûr que pool existe
  if (!pool) {
    throw new Error('Pool non initialisé après attente');
  }

  const startTime = Date.now();

  try {
    const client = await pool.connect();
    const acquisitionTime = Date.now() - startTime;

    // Log seulement si lent (>500ms) ou en dev
    if (acquisitionTime > 500 || CONFIG.logging.enabled) {
      console.log(
        `[${getTimestamp()}] ✅ Client acquis en ${acquisitionTime}ms`,
      );
    }

    // Alerte si très lent (>2s)
    if (acquisitionTime > 2000) {
      captureMessage(`Acquisition client lente: ${acquisitionTime}ms`, {
        level: 'warning',
        tags: { component: 'database_pool', issue_type: 'slow_acquisition' },
        extra: {
          acquisitionTime,
          poolInfo: {
            total: pool.totalCount,
            idle: pool.idleCount,
            waiting: pool.waitingCount,
          },
        },
      });
    }

    return client;
  } catch (error) {
    const acquisitionTime = Date.now() - startTime;
    console.error(
      `[${getTimestamp()}] ❌ Erreur acquisition client (${acquisitionTime}ms):`,
      error.message,
    );

    captureException(error, {
      tags: {
        component: 'database_pool',
        error_type: 'client_acquisition_failed',
      },
      extra: { acquisitionTime },
    });

    throw new Error('Erreur de connexion base de données');
  }
};

// =============================================
// GRACEFUL SHUTDOWN
// =============================================

async function shutdown() {
  console.log(`[${getTimestamp()}] 🛑 Arrêt du pool...`);

  // Arrêter le monitoring
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
  }

  try {
    if (pool) {
      await pool.end();
      console.log(`[${getTimestamp()}] ✅ Pool fermé proprement`);

      captureMessage('Database pool shutdown completed', {
        level: 'info',
        tags: { component: 'database_pool', operation: 'shutdown' },
      });
    }
  } catch (error) {
    console.error(
      `[${getTimestamp()}] ❌ Erreur fermeture pool:`,
      error.message,
    );
    captureException(error, {
      tags: { component: 'database_pool', error_type: 'shutdown_error' },
    });
  }
}

// Handlers de signaux
process.on('SIGINT', () => {
  console.log(`[${getTimestamp()}] 🛑 SIGINT reçu`);
  shutdown().then(() => process.exit(0));
});

process.on('SIGTERM', () => {
  console.log(`[${getTimestamp()}] 🛑 SIGTERM reçu`);
  shutdown().then(() => process.exit(0));
});

// =============================================
// EXPORTS
// =============================================

// API de monitoring simplifiée
export const monitoring = {
  // Informations basiques du pool
  getPoolInfo: () => ({
    total: pool?.totalCount || 0,
    idle: pool?.idleCount || 0,
    waiting: pool?.waitingCount || 0,
    maxConnections: CONFIG.pool.max,
  }),

  // Health check manuel
  performHealthCheck,

  // Configuration actuelle
  getConfig: () => ({
    environment: process.env.NODE_ENV,
    maxConnections: CONFIG.pool.max,
    healthCheckInterval: CONFIG.monitoring.healthCheckInterval,
    loggingEnabled: CONFIG.logging.enabled,
  }),

  // Statistiques simples
  getStats: () => ({
    poolInfo: monitoring.getPoolInfo(),
    config: monitoring.getConfig(),
    timestamp: new Date().toISOString(),
  }),
};
