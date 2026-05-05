import type * as Preset from "@docusaurus/preset-classic";
import type { Config } from "@docusaurus/types";
import { themes as prismThemes } from "prism-react-renderer";

const config: Config = {
  title: "Conduit",
  tagline:
    "TypeScript command/event operation bus with pluggable transports, schema tooling, and framework integrations.",
  favicon: "img/favicon.svg",

  url: "https://github.com",
  baseUrl: "/",

  organizationName: "DiyorUmarkulov",
  projectName: "conduit",

  onBrokenLinks: "warn",

  markdown: {
    mermaid: true,
    hooks: {
      onBrokenMarkdownLinks: "warn"
    }
  },

  themes: ["@docusaurus/theme-mermaid"],

  i18n: {
    defaultLocale: "en",
    locales: ["en"]
  },

  presets: [
    [
      "@docusaurus/preset-classic",
      {
        docs: {
          path: "../docs",
          routeBasePath: "docs",
          sidebarPath: "./sidebars.ts",
          editUrl: "https://github.com/DiyorUmarkulov/conduit/edit/main/",
          exclude: ["README.md"]
        },
        blog: false,
        theme: {
          customCss: "./src/css/custom.css"
        }
      } satisfies Preset.Options
    ]
  ],

  themeConfig: {
    navbar: {
      title: "Conduit",
      logo: {
        alt: "Conduit",
        src: "img/logo.svg"
      },
      items: [
        {
          type: "docSidebar",
          sidebarId: "main",
          position: "left",
          label: "Docs"
        },
        {
          href: "https://github.com/DiyorUmarkulov/conduit",
          label: "GitHub",
          position: "right"
        }
      ]
    },
    footer: {
      style: "dark",
      links: [
        {
          title: "Documentation",
          items: [
            {
              label: "How it works",
              to: "/docs/guides/how-conduit-works"
            },
            {
              label: "Getting started",
              to: "/docs/guides/getting-started"
            },
            {
              label: "Overview",
              to: "/docs/packages/"
            },
            {
              label: "Choosing a provider",
              to: "/docs/guides/choosing-provider"
            },
            {
              label: "Architecture decisions",
              to: "/docs/architecture/decisions/monorepo-structure"
            }
          ]
        },
        {
          title: "Repository",
          items: [
            {
              label: "GitHub",
              href: "https://github.com/DiyorUmarkulov/conduit"
            },
            {
              label: "Issues",
              href: "https://github.com/DiyorUmarkulov/conduit/issues"
            }
          ]
        }
      ],
      copyright: `MIT License · Conduit documentation`
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ["bash", "diff", "json", "sql", "typescript"]
    },
    mermaid: {
      theme: { light: "neutral", dark: "dark" }
    }
  } satisfies Preset.ThemeConfig
};

export default config;
