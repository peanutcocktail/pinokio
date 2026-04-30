const assert = require('assert')
const {
  buildBrowserLikeUserAgent,
  buildChromiumUserAgent,
  sanitizeUserAgentForRequests
} = require('../user-agent')

const chromeVersion = '142.0.7444.175'
const appVersion = '7.2.8'

const cases = [
  {
    platform: 'darwin',
    arch: 'arm64',
    platformToken: 'Macintosh; Intel Mac OS X 10_15_7'
  },
  {
    platform: 'win32',
    arch: 'x64',
    platformToken: 'Windows NT 10.0; Win64; x64'
  },
  {
    platform: 'linux',
    arch: 'arm64',
    platformToken: 'X11; Linux aarch64'
  }
]

for (const item of cases) {
  const ua = buildBrowserLikeUserAgent({
    appVersion,
    chromeVersion,
    platform: item.platform,
    arch: item.arch
  })
  assert.ok(ua.startsWith(`Mozilla/5.0 (${item.platformToken})`), ua)
  assert.match(ua, /AppleWebKit\/537\.36 \(KHTML, like Gecko\)/)
  assert.match(ua, /Chrome\/142\.0\.7444\.175 Safari\/537\.36/)
  assert.ok(ua.endsWith(`Pinokio/${appVersion}`), ua)
  assert.doesNotMatch(ua, /Electron\//)

  const chromeMatch = ua.match(/(?:Chrome|Chromium|CriOS)\/([0-9.]+)/)
  assert.ok(chromeMatch, `missing Chrome token in ${ua}`)
  assert.strictEqual(parseFloat(chromeMatch[1]), 142)

  const networkUa = sanitizeUserAgentForRequests(`${ua} Electron/39.2.3`)
  assert.match(networkUa, /Chrome\/142\.0\.7444\.175 Safari\/537\.36/)
  assert.doesNotMatch(networkUa, /Pinokio\//)
  assert.doesNotMatch(networkUa, /Electron\//)
}

const baseUa = buildChromiumUserAgent({
  chromeVersion,
  platform: 'darwin',
  arch: 'x64'
})
assert.match(baseUa, /Chrome\/142\.0\.7444\.175 Safari\/537\.36$/)
assert.doesNotMatch(baseUa, /Pinokio\//)

console.log('User agent checks passed')
