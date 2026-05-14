/**
 * Formate les données brutes d'une vidéo pour le client
 * Seules les colonnes demandées sont exposées
 */
export function formatVideo(row) {
  return {
    video_id: row.video_id,
    video_title: row.video_title || '[Sans titre]',
    video_description: row.video_description || null,
    video_category: row.video_category || null,
    video_duration_seconds: row.video_duration_seconds
      ? parseInt(row.video_duration_seconds, 10)
      : null,
    created_at: row.created_at,
    video_cloudinary_id: row.video_cloudinary_id,
    video_thumbnail_id: row.video_thumbnail_id || null,
  };
}
