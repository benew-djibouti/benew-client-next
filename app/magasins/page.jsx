import { getClient } from '@/backend/dbConnect';
import { captureException } from '../../sentry.server.config';
import MagasinsList from '@/components/magasins/MagasinsList';

async function getAllApplications() {
  let client = null;

  try {
    client = await getClient();

    const result = await client.query(`
      SELECT
        application_id,
        application_name,
        application_level,
        application_category,
        application_fee,
        application_rent,
        application_images,
        application_template_id
      FROM catalog.applications
      WHERE is_active = true
      ORDER BY created_at ASC
    `);

    return {
      applications: result.rows,
      success: true,
    };
  } catch (error) {
    captureException(error, {
      tags: { component: 'magasins_page', operation: 'get_all_applications' },
    });

    return {
      applications: [],
      success: false,
      error:
        process.env.NODE_ENV === 'production'
          ? 'Erreur lors du chargement des magasins.'
          : error.message,
    };
  } finally {
    if (client) {
      try {
        client.release();
      } catch (releaseError) {
        captureException(releaseError, {
          tags: { component: 'magasins_page', operation: 'client_release' },
        });
      }
    }
  }
}

export const metadata = {
  title: 'Magasins - Benew | Toutes nos applications',
  description:
    'Découvrez toutes nos applications web et mobile disponibles sur Benew.',
};

export default async function MagasinsPage() {
  const { applications, success, error } = await getAllApplications();

  return (
    <MagasinsList
      initialApplications={applications}
      success={success}
      error={error || null}
    />
  );
}
