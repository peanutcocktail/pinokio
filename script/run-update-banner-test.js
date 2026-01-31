const { spawn } = require('child_process')

const cmd = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const child = spawn(cmd, ['run', 'start'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    PINOKIO_TEST_UPDATE_BANNER: '1'
  }
})

child.on('exit', (code) => {
  process.exit(code || 0)
})
