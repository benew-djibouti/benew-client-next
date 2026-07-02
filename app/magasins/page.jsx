// app/magasins/page.jsx
import { getClient } from '@/backend/dbConnect';
import { captureException, captureMessage } from '../../sentry.server.config';
import { withTimeout } from '@/utils/asyncUtils';
import MagasinsList from '@/components/magasins/MagasinsList';

// =============================
// METADATA
// =============================
export const metadata = {
  title: 'Magasins - Benew | Toutes nos applications',
  description:
    'Découvrez toutes nos applications web et mobile disponibles sur Benew. Templates premium et solutions e-commerce professionnelles.',
  keywords: [
    'magasins',
    'applications web',
    'applications mobile',
    'e-commerce',
    'benew',
    // 'Djibouti',
  ],
  openGraph: {
    title: 'Magasins - Benew | Toutes nos applications',
    description:
      'Découvrez toutes nos applications web et mobile disponibles sur Benew.',
    url: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://benew-dj.com'}/magasins`,
  },
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://benew-dj.com'}/magasins`,
  },
};

// =============================
// QUERY
// =============================
async function getAllApplications() {
  let client = null;
  const startTime = Date.now();

  try {
    client = await getClient();

    const result = await withTimeout(
      client.query(`
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
      `),
      5000,
      'Get all applications timeout',
    );

    const queryDuration = Date.now() - startTime;

    if (queryDuration > 2000) {
      captureMessage('Slow magasins applications query', {
        level: 'warning',
        tags: {
          component: 'magasins_page',
          operation: 'get_all_applications',
        },
        extra: {
          queryDuration,
          rowCount: result.rows.length,
        },
      });
    }

    return {
      applications: result.rows,
      success: true,
    };
  } catch (error) {
    captureException(error, {
      tags: {
        component: 'magasins_page',
        operation: 'get_all_applications',
      },
      extra: {
        durationMs: Date.now() - startTime,
        errorCode: error.code,
      },
    });

    return {
      applications: [],
      success: false,
      error:
        process.env.NODE_ENV === 'production'
          ? 'Erreur lors du chargement des magasins.'
          : error.message,
      errorCode: error.code || null,
    };
  } finally {
    if (client) {
      try {
        client.release();
      } catch (releaseError) {
        captureException(releaseError, {
          tags: {
            component: 'magasins_page',
            operation: 'client_release',
          },
        });
      }
    }
  }
}

// =============================
// PAGE
// =============================
export default async function MagasinsPage() {
  const { applications, success, error, errorCode } =
    await getAllApplications();

  return (
    <MagasinsList
      initialApplications={applications}
      success={success}
      error={error || null}
      errorCode={errorCode || null}
    />
  );
}
