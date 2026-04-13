// lib/channelQueries.js — pas de 'use server'
import { getClient } from '@/backend/dbConnect';
import { captureException, captureMessage } from '../sentry.server.config';
// Importé dans les deux fichiers
import { withTimeout, formatVideo } from './channelUtils';

/**
 * Récupère toutes les vidéos actives, triées par date de création DESC
 * Utilisé uniquement côté serveur dans page.jsx — pas de rate limiting nécessaire
 *
 * @returns {Promise<{ videos: Array, success: boolean, error?: string }>}
 */
export async function getVideos() {
  let client = null;
  const startTime = Date.now();

  try {
    client = await getClient();

    await client.query('SET LOCAL statement_timeout = 5000');

    const result = await withTimeout(
      client.query(`
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
      ORDER BY created_at DESC
      LIMIT 20
  `),
      5000,
      'Get videos timeout',
    );

    const queryDuration = Date.now() - startTime;

    if (queryDuration > 2000) {
      captureMessage('Slow channel videos query', {
        level: 'warning',
        tags: { component: 'channel_actions', operation: 'get_videos' },
        extra: { queryDuration, rowCount: result.rows.length },
      });
    }

    return {
      videos: result.rows.map(formatVideo),
      success: true,
    };
  } catch (error) {
    captureException(error, {
      tags: { component: 'channel_actions', operation: 'get_videos' },
      extra: { durationMs: Date.now() - startTime, errorCode: error.code },
    });

    return {
      videos: [],
      success: false,
      error: error.message,
      errorCode: error.code || null, // ← code PG ex: '08001', '57014'
    };
  } finally {
    if (client) {
      try {
        client.release();
      } catch (releaseError) {
        captureException(releaseError, {
          tags: { component: 'channel_actions', operation: 'client_release' },
        });
      }
    }
  }
}
