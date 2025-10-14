#!/usr/bin/env node
import fs from 'fs/promises'
import path from 'path'

async function main(){
  const root = path.resolve(process.cwd())
  const src = path.join(root, 'src', 'content.css')
  const destDir = path.join(root, 'dist', 'src')
  const dest = path.join(destDir, 'content.css')

  try {
    await fs.mkdir(destDir, { recursive: true })
    const data = await fs.readFile(src)
    await fs.writeFile(dest, data)
    console.log(`Copied ${src} -> ${dest}`)
  } catch (err) {
    console.error('Failed to copy content.css:', err)
    process.exit(1)
  }
}

main()
