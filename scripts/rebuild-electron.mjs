import { execSync } from 'child_process'

// Rebuild better-sqlite3 from source for Electron's Node.js ABI
execSync('npm rebuild better-sqlite3 --build-from-source', {
  stdio: 'inherit',
  env: {
    ...process.env,
    npm_config_target: '33.4.11',
    npm_config_runtime: 'electron',
    npm_config_disturl: 'https://electronjs.org/headers',
    npm_config_build_from_source: 'true'
  }
})
