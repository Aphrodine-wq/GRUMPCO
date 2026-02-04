module.exports = {
  verbose: true,
  plugins: [
    '@semantic-release/commit-analyzer',
    '@semantic-release/release-notes-generator',
    '@semantic-release/changelog',
    '@semantic-release/npm',
    '@semantic-release/github',
    [
      '@semantic-release/git',
      {
        assets: ['CHANGELOG.md', 'package.json', 'package-lock.json'],
        message: 'chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}',
      },
    ],
  ],
  branches: [
    'main',
    { name: 'beta', prerelease: true },
    { name: 'alpha', prerelease: true },
  ],
  preset: 'conventionalcommits',
  presetConfig: {
    types: [
      { type: 'feat', section: 'Features' },
      { type: 'fix', section: 'Bug Fixes' },
      { type: 'perf', section: 'Performance Improvements' },
      { type: 'revert', section: 'Reverts' },
      { type: 'docs', section: 'Documentation', hidden: false },
      { type: 'style', section: 'Styles', hidden: true },
      { type: 'chore', section: 'Miscellaneous Chores', hidden: false },
      { type: 'refactor', section: 'Code Refactoring', hidden: false },
      { type: 'test', section: 'Tests', hidden: false },
      { type: 'build', section: 'Build System', hidden: false },
      { type: 'ci', section: 'Continuous Integration', hidden: false },
      { type: 'security', section: 'Security', hidden: false },
    ],
  },
};
