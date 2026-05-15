import { existsSync } from 'node:fs'
import { mkdir, rm } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'

const root = process.cwd()
const distDir = join(root, 'dist')
const releaseDir = join(root, 'release')
const zipPath = join(releaseDir, 'plot-chrome-extension.zip')

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: 'inherit',
    shell: false,
    ...options,
  })

  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

await rm(distDir, { recursive: true, force: true })
await mkdir(releaseDir, { recursive: true })

if (existsSync(zipPath)) {
  await rm(zipPath)
}

run('npm', ['run', 'build'])
run('zip', ['-r', zipPath, '.'], { cwd: distDir })

console.log(`\nRelease package ready: ${zipPath}`)
