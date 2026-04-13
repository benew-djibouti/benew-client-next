import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import prettier from "eslint-config-prettier/flat";
import jsxA11y from "eslint-plugin-jsx-a11y";

// ============================================================================
// ESLINT CONFIG - NEXT.JS 16.1.1 CLIENT E-COMMERCE (500 users/jour)
// ============================================================================
// Application: BENEW Client (Public)
// Date: Janvier 2026
// Niveau de sécurité: ÉLEVÉ (app publique e-commerce)
// Performance: CRITIQUE (500 users/jour)
// ============================================================================

const eslintConfig = defineConfig([
  // ===== 1. CONFIGURATION NEXT.JS COMPLÈTE =====
  // Inclut : React, React Hooks, Next.js rules, Core Web Vitals
  ...nextVitals,

  // ===== 2. ACCESSIBILITY (CRITIQUE POUR E-COMMERCE) =====
  {
    plugins: {
      "jsx-a11y": jsxA11y,
    },
    rules: {
      // Accessibilité renforcée (SEO + UX + Légal)
      "jsx-a11y/alt-text": "error", // Images doivent avoir alt (SEO)
      "jsx-a11y/anchor-has-content": "error",
      "jsx-a11y/anchor-is-valid": "off", // Next.js Link gère ça
      "jsx-a11y/aria-props": "error",
      "jsx-a11y/aria-proptypes": "error",
      "jsx-a11y/aria-unsupported-elements": "error",
      "jsx-a11y/click-events-have-key-events": "warn",
      "jsx-a11y/heading-has-content": "error",
      "jsx-a11y/html-has-lang": "error",
      "jsx-a11y/img-redundant-alt": "warn",
      "jsx-a11y/interactive-supports-focus": "warn",
      "jsx-a11y/label-has-associated-control": "error",
      "jsx-a11y/no-autofocus": "warn",
      "jsx-a11y/no-distracting-elements": "error",
      "jsx-a11y/no-redundant-roles": "warn",
      "jsx-a11y/role-has-required-aria-props": "error",
      "jsx-a11y/role-supports-aria-props": "error",
    },
  },

  // ===== 3. PRETTIER (dernier pour éviter conflits) =====
  prettier,

  // ===== 4. RÈGLES PERSONNALISÉES =====
  {
    rules: {
      // ===== REACT =====
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
      "react/jsx-props-no-spreading": "off",
      "react/jsx-filename-extension": [1, { extensions: [".js", ".jsx"] }],
      "react/forbid-dom-props": ["warn", { forbid: ["style"] }],

      // ===== PRODUCTION MODE - STRICT =====
      "no-console":
        process.env.NODE_ENV === "production"
          ? ["error", { allow: ["warn", "error"] }] // Bloquer console.log
          : "off",
      "no-debugger": process.env.NODE_ENV === "production" ? "error" : "warn",
      "no-unused-vars":
        process.env.NODE_ENV === "production" ? "error" : "warn",
      "no-alert": process.env.NODE_ENV === "production" ? "error" : "warn", // Pas d'alert() en prod

      // ===== SÉCURITÉ E-COMMERCE =====
      "no-eval": "error",
      "no-implied-eval": "error",
      "no-new-func": "error",

      // ===== REACT HOOKS (ROBUSTESSE) =====
      "react-hooks/exhaustive-deps": "error", // Évite bugs useEffect critiques
      "react-hooks/rules-of-hooks": "error",

      // ===== IMPORTS (SI PLUGIN ACTIVÉ) =====
      // 'import/no-unresolved': 'error',
      // 'import/order': [
      //   'error',
      //   {
      //     'groups': [
      //       'builtin',
      //       'external',
      //       'internal',
      //       'parent',
      //       'sibling',
      //       'index'
      //     ],
      //     'newlines-between': 'always',
      //     'alphabetize': { order: 'asc', caseInsensitive: true }
      //   }
      // ],

      // ===== PRETTIER =====
      "prettier/prettier": [
        "warn",
        {
          endOfLine: "auto", // Évite problèmes Windows/Mac/Linux
        },
      ],
    },

    settings: {
      react: {
        version: "detect",
      },
      // Import resolver (si plugin import activé)
      // 'import/resolver': {
      //   node: {
      //     extensions: ['.js', '.jsx', '.json']
      //   }
      // }
    },
  },

  // ===== 5. FICHIERS À IGNORER =====
  globalIgnores([
    // Build outputs
    ".next/**",
    "out/**",
    "build/**",
    "dist/**",

    // Dependencies
    "node_modules/**",

    // Config files
    "next-env.d.ts",
    "*.config.js",
    "*.config.mjs",
    "*.config.ts",

    // Sentry
    ".sentry-build-info/**",
    "sentry.client.config.ts",
    "sentry.server.config.ts",
    "sentry.edge.config.ts",
    "instrumentation.js",

    // Cache & Build
    ".turbo/**",
    ".cache/**",
    ".vercel/**",
    ".env*.local",

    // Logs
    "*.log",
    "npm-debug.log*",
    "yarn-debug.log*",
    "pnpm-debug.log*",

    // Public (fichiers minifiés)
    "public/**/*.min.js",
    "public/**/*.min.css",
  ]),
]);

export default eslintConfig;
