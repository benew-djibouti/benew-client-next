// app/robots.js
export default function robots() {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/dashboard/', '/api/'],
      },
    ],
    sitemap: 'https://benew-dj.com/sitemap.xml',
    host: 'https://benew-dj.com',
  };
}
