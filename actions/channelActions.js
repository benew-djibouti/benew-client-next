'use server';

import { getClient } from '@/backend/dbConnect';
import {
  checkServerActionRateLimit,
  getClientIPFromAction,
} from '@/backend/rateLimiter';
import { captureException, captureMessage } from '../sentry.server.config';
// Importé dans les deux fichiers
import { formatVideo } from '../lib/channelUtils';
import { withTimeout } from '@/utils/asyncUtils';

// =============================
// UTILITAIRES
// =============================

/**
 * Sanitize une chaîne de recherche
 * - Trim + limite de longueur
 * - Supprime les caractères dangereux pour ILIKE
 */
function sanitizeSearchQuery(query) {
  if (!query || typeof query !== 'string') return '';

  return query
    .trim()
    .substring(0, 100)
    .replace(/[<>"'%;()&+\\]/g, '')
    .replace(/\s+/g, ' ');
}

// =============================
// RECHERCHE — appelé côté client via useTransition
// =============================

/**
 * Recherche des vidéos par titre, description ou tags
 * Rate limitée : 20 requêtes/minute par IP
 *
 * @param {string} query - Terme de recherche
 * @returns {Promise<{ videos: Array, success: boolean, total: number, error?: string }>}
 */
export async function searchVideos(query) {
  let client = null;
  const startTime = Date.now();

  try {
    // ===== RATE LIMITING =====
    const identifier = await getClientIPFromAction();
    const rateLimitResult = await checkServerActionRateLimit(
      `channel_search:${identifier}`,
      'api',
    );

    if (!rateLimitResult.success) {
      const waitSeconds = rateLimitResult.reset;
      return {
        videos: [],
        success: false,
        total: 0,
        code: rateLimitResult.code || 'RATE_LIMITED',
        message: `Trop de recherches. Réessayez dans ${waitSeconds} seconde${waitSeconds > 1 ? 's' : ''}.`,
      };
    }

    // ===== SANITIZATION =====
    const cleanQuery = sanitizeSearchQuery(query);

    // Requête vide → retourner toutes les vidéos
    if (!cleanQuery || cleanQuery.length === 0) {
      client = await getClient();

      const result = await withTimeout(
        client.query(`
          SELECT
            video_id, video_title, video_description, video_category,
            video_duration_seconds, created_at,
            video_cloudinary_id, video_thumbnail_id
          FROM catalog.channel_videos
          WHERE is_active = true
          ORDER BY created_at DESC
          LIMIT 20
        `),
        5000,
        'Get all videos timeout',
      );

      const queryDuration = Date.now() - startTime;
      if (queryDuration > 2000) {
        captureMessage('Slow channel all-videos query', {
          level: 'warning',
          tags: { component: 'channel_actions', operation: 'get_all_videos' },
          extra: { queryDuration, rowCount: result.rows.length },
        });
      }

      return {
        videos: result.rows.map(formatVideo),
        success: true,
        total: result.rows.length,
      };
    }

    // Minimum 2 caractères pour une vraie recherche
    if (cleanQuery.length < 2) {
      return {
        videos: [],
        success: true,
        total: 0,
        message: 'Saisissez au moins 2 caractères.',
      };
    }

    // ===== REQUÊTE DB =====
    client = await getClient();

    const searchPattern = `%${cleanQuery}%`;

    const result = await withTimeout(
      client.query(
        `
        SELECT
          video_id,
          video_title,
          video_description,
          video_category,
          video_duration_seconds,
          created_at,
          video_cloudinary_id,
          video_thumbnail_id
        FROM catalog.channel_videos
        WHERE is_active = true
          AND (
            video_title ILIKE $1
            OR video_description ILIKE $1
            OR array_to_string(video_tags, ' ') ILIKE $1
          )
        ORDER BY
          CASE WHEN video_title ILIKE $1 THEN 0 ELSE 1 END,
          created_at DESC
        LIMIT 100
        `,
        [searchPattern],
      ),
      5000,
      'Search videos timeout',
    );

    const queryDuration = Date.now() - startTime;

    if (queryDuration > 2000) {
      captureMessage('Slow channel search query', {
        level: 'warning',
        tags: { component: 'channel_actions', operation: 'search_videos' },
        extra: {
          queryDuration,
          query: cleanQuery,
          rowCount: result.rows.length,
        },
      });
    }

    return {
      videos: result.rows.map(formatVideo),
      success: true,
      total: result.rows.length,
      query: cleanQuery,
    };
  } catch (error) {
    captureException(error, {
      tags: { component: 'channel_actions', operation: 'search_videos' },
      extra: {
        query: query?.substring(0, 50),
        durationMs: Date.now() - startTime,
        errorCode: error.code,
      },
    });

    return {
      videos: [],
      success: false,
      total: 0,
      error:
        process.env.NODE_ENV === 'production'
          ? 'Erreur lors de la recherche.'
          : error.message,
    };
  } finally {
    if (client) {
      try {
        client.release();
      } catch (releaseError) {
        captureException(releaseError, {
          tags: {
            component: 'channel_actions',
            operation: 'client_release',
          },
        });
      }
    }
  }
}
