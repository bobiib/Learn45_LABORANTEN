import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist/**'] },
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{tsx,jsx}'],
    ignores: ['src/components/ui/button.tsx'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "JSXOpeningElement[name.name='button']",
          message: 'Use the shared Button from src/components/ui/Button.tsx.',
        },
      ],
    },
  },
)
