const DEFAULT_CHROME_VERSION = '140.0.0.0'
const PRODUCT_NAME = 'Pinokio'

const getPackageVersion = () => {
  try {
    return require('./package.json').version || ''
  } catch (_) {
    return ''
  }
}

const normalizeVersionToken = (value, fallback = '') => {
  const token = String(value || '').trim()
  if (!token) {
    return fallback
  }
  return token.replace(/\s+/g, '.')
}

const getDefaultChromeVersion = () => {
  try {
    return process.versions && process.versions.chrome
      ? process.versions.chrome
      : DEFAULT_CHROME_VERSION
  } catch (_) {
    return DEFAULT_CHROME_VERSION
  }
}

const buildChromiumUserAgent = ({
  chromeVersion = getDefaultChromeVersion(),
  platform = process.platform,
  arch = process.arch
} = {}) => {
  const resolvedChromeVersion = normalizeVersionToken(chromeVersion, DEFAULT_CHROME_VERSION)
  if (platform === 'darwin') {
    return `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${resolvedChromeVersion} Safari/537.36`
  }
  if (platform === 'win32') {
    const windowsArch = arch === 'arm64' ? 'ARM64' : 'x64'
    return `Mozilla/5.0 (Windows NT 10.0; Win64; ${windowsArch}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${resolvedChromeVersion} Safari/537.36`
  }
  const linuxArch = arch === 'arm64' ? 'aarch64' : 'x86_64'
  return `Mozilla/5.0 (X11; Linux ${linuxArch}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${resolvedChromeVersion} Safari/537.36`
}

const buildBrowserLikeUserAgent = ({
  appVersion = getPackageVersion(),
  chromeVersion,
  platform,
  arch
} = {}) => {
  const base = buildChromiumUserAgent({ chromeVersion, platform, arch })
  const productVersion = normalizeVersionToken(appVersion)
  if (!productVersion) {
    return base
  }
  return `${base} ${PRODUCT_NAME}/${productVersion}`
}

const resolveSession = (targetSession) => {
  if (!targetSession) {
    return null
  }
  return targetSession.defaultSession || targetSession
}

const configurePinokioUserAgent = ({
  app,
  session,
  acceptLanguages,
  appVersion,
  chromeVersion,
  platform,
  arch
} = {}) => {
  const userAgent = buildBrowserLikeUserAgent({
    appVersion,
    chromeVersion,
    platform,
    arch
  })
  if (app) {
    app.userAgentFallback = userAgent
  }
  const targetSession = resolveSession(session)
  if (targetSession && typeof targetSession.setUserAgent === 'function') {
    if (acceptLanguages) {
      targetSession.setUserAgent(userAgent, acceptLanguages)
    } else {
      targetSession.setUserAgent(userAgent)
    }
  }
  return userAgent
}

const sanitizeUserAgentForRequests = (userAgent, options = {}) => {
  if (typeof userAgent !== 'string' || !userAgent) {
    return userAgent
  }
  const preservePinokio = options && options.preservePinokio === true
  const sanitized = preservePinokio
    ? userAgent
    : userAgent.replace(/\s+Pinokio\/[^\s]+/ig, '')
  return sanitized
    .replace(/\s+Electron\/[^\s]+/ig, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

module.exports = {
  buildBrowserLikeUserAgent,
  buildChromiumUserAgent,
  configurePinokioUserAgent,
  sanitizeUserAgentForRequests
}
