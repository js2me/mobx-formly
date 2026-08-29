import { defineConfig } from 'docusite'

export default defineConfig({
  title: 'mobx-formly',
  description: 'Observable, framework-agnostic forms for MobX 6 with Zod validation.',
  base: '/mobx-formly/',
  github: 'https://github.com/js2me/mobx-formly',
  colors: {
    light: '#e46b2e',
    dark: '#ff9b62',
  },
  search: 'local',
  llms: true,
  nav: [
    { text: 'Guide', link: '/guide/getting-started' },
    { text: 'API', link: '/api/form' },
  ],
  sidebar: {
    '/guide/': [
      {
        text: 'Guide',
        items: [
          { text: 'Getting started', link: '/guide/getting-started' },
          { text: 'Validation', link: '/guide/validation' },
          { text: 'MobX reactivity', link: '/guide/reactivity' },
        ],
      },
    ],
    '/api/': [
      {
        text: 'API reference',
        items: [{ text: 'Form', link: '/api/form' }],
      },
    ],
  },
})
