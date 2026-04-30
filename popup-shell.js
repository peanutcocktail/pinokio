const path = require('path')
const windowStateKeeper = require('electron-window-state')
const { BrowserWindow, WebContentsView, session } = require('electron')
const { buildBrowserLikeUserAgent } = require('./user-agent')

const parseUrl = (value, base) => {
  try {
    return new URL(value, base)
  } catch (_) {
    return null
  }
}

const isHttpUrl = (value) => {
  return Boolean(value && (value.protocol === 'http:' || value.protocol === 'https:'))
}

const getFeatureDimension = (params, key, fallback) => {
  const value = parseInt(params.get(key), 10)
  return Number.isFinite(value) ? value : fallback
}

module.exports = ({
  contentPreloadPath = path.join(__dirname, 'preload.js'),
  toolbarHtmlPath = path.join(__dirname, 'popup-toolbar.html'),
  toolbarHeight = 46,
  installForceDestroyOnClose
} = {}) => {
  let openPinokioHomeWindow = null
  const popupBrowserPartition = 'persist:pinokio-popup-browser'
  const browserLikeUserAgent = buildBrowserLikeUserAgent()
  const getPopupBrowserSession = () => {
    const popupSession = session.fromPartition(popupBrowserPartition)
    if (!popupSession.__pinokioPopupBrowserConfigured) {
      popupSession.__pinokioPopupBrowserConfigured = true
      popupSession.setUserAgent(browserLikeUserAgent, 'en-US,en')
    }
    return popupSession
  }
  const buildAppPopupContentWebPreferences = (overrides = {}) => {
    const next = (overrides && typeof overrides === 'object') ? { ...overrides } : {}
    return {
      ...next,
      session: session.defaultSession,
      webSecurity: false,
      spellcheck: false,
      nativeWindowOpen: true,
      contextIsolation: false,
      nodeIntegrationInSubFrames: true,
      enableRemoteModule: false,
      experimentalFeatures: true,
      preload: contentPreloadPath
    }
  }
  const buildBrowserPopupContentWebPreferences = (overrides = {}) => {
    const next = (overrides && typeof overrides === 'object') ? { ...overrides } : {}
    delete next.session
    delete next.preload
    delete next.partition
    delete next.nodeIntegration
    delete next.nodeIntegrationInSubFrames
    delete next.contextIsolation
    delete next.experimentalFeatures
    delete next.webSecurity
    return {
      ...next,
      partition: popupBrowserPartition,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      nativeWindowOpen: true,
      contextIsolation: true,
      nodeIntegration: false,
      nodeIntegrationInSubFrames: false,
      enableRemoteModule: false,
      experimentalFeatures: false
    }
  }

  const unwrapContainerTarget = (target, rootParsed) => {
    let next = target
    while (next && next.pathname === '/container') {
      const innerUrl = next.searchParams.get('url')
      if (!innerUrl) {
        break
      }
      const unwrapped = parseUrl(innerUrl, rootParsed ? rootParsed.origin : undefined)
      if (!isHttpUrl(unwrapped) || unwrapped.href === next.href) {
        break
      }
      next = unwrapped
    }
    return next
  }

  const isPinokioWindowUrl = (value, rootUrl) => {
    const rootParsed = parseUrl(rootUrl)
    const target = unwrapContainerTarget(
      parseUrl(value, rootParsed ? rootParsed.origin : undefined),
      rootParsed
    )
    if (!rootParsed || !isHttpUrl(target)) {
      return false
    }
    return target.origin === rootParsed.origin
  }

  const resolveTargetUrl = ({ url, openerWebContents, rootUrl } = {}) => {
    const openerUrl = (() => {
      try {
        return openerWebContents && !openerWebContents.isDestroyed()
          ? openerWebContents.getURL()
          : (rootUrl || '')
      } catch (_) {
        return rootUrl || ''
      }
    })()
    const target = parseUrl(url, openerUrl || (rootUrl || undefined))
    return isHttpUrl(target) ? target.href : ''
  }

  const buildRegularWindowOptions = ({ x, y, width, height, overlay } = {}) => {
    const options = {
      x,
      y,
      width: width || 1000,
      height: height || 800,
      minWidth: 190,
      parent: null,
      titleBarStyle: 'hidden',
      webPreferences: buildAppPopupContentWebPreferences()
    }
    if (overlay) {
      options.titleBarOverlay = overlay
    }
    return options
  }

  const createRegularWindow = ({ x, y, width, height, overlay } = {}) => {
    const win = new BrowserWindow(buildRegularWindowOptions({ x, y, width, height, overlay }))
    installForceDestroyOnClose(win)
    return win
  }

  const layoutPopupShell = (shellState) => {
    if (!shellState || !shellState.win || shellState.win.isDestroyed()) {
      return
    }
    const bounds = shellState.win.getContentBounds()
    const width = Math.max(bounds.width || 0, 0)
    const height = Math.max(bounds.height || 0, 0)
    shellState.toolbarView.setBounds({
      x: 0,
      y: 0,
      width,
      height: toolbarHeight
    })
    shellState.contentView.setBounds({
      x: 0,
      y: toolbarHeight,
      width,
      height: Math.max(height - toolbarHeight, 0)
    })
  }

  const buildPopupShellState = (shellState) => {
    const target = shellState && shellState.contentView ? shellState.contentView.webContents : null
    let url = ''
    let title = ''
    try {
      if (target && !target.isDestroyed()) {
        url = target.getURL() || ''
        title = target.getTitle() || ''
      }
    } catch (_) {
    }
    return {
      url,
      title: title || url || 'Pinokio',
      canGoBack: Boolean(target && !target.isDestroyed() && target.canGoBack()),
      canGoForward: Boolean(target && !target.isDestroyed() && target.canGoForward())
    }
  }

  const sendPopupShellState = (shellState) => {
    if (!shellState || !shellState.toolbarView || !shellState.contentView) {
      return
    }
    const toolbarContents = shellState.toolbarView.webContents
    if (!toolbarContents || toolbarContents.isDestroyed()) {
      return
    }
    const state = buildPopupShellState(shellState)
    toolbarContents.send('pinokio:popup-shell-state', state)
    if (shellState.win && !shellState.win.isDestroyed()) {
      shellState.win.setTitle(state.title)
    }
  }

  const createPopupShellWindow = ({
    x,
    y,
    width,
    height,
    adoptedWebContents = null,
    contentWebPreferences = {},
    browserLike = false,
    initialUrl = ''
  } = {}) => {
    const win = new BrowserWindow({
      frame: true,
      x,
      y,
      width: width || 1000,
      height: height || 800,
      minWidth: 190,
      backgroundColor: '#ffffff'
    })
    win.__pinokioPopupShell = true
    win.__pinokioCloseOnFirstDownload = Boolean(browserLike && initialUrl)
    installForceDestroyOnClose(win)

    const toolbarView = new WebContentsView({
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        spellcheck: false,
        backgroundThrottling: false
      }
    })
    const contentView = adoptedWebContents
      ? new WebContentsView({ webContents: adoptedWebContents })
      : new WebContentsView({
          webPreferences: browserLike
            ? buildBrowserPopupContentWebPreferences(contentWebPreferences)
            : buildAppPopupContentWebPreferences(contentWebPreferences)
        })

    const shellState = {
      win,
      toolbarView,
      contentView
    }

    win.contentView.addChildView(contentView)
    win.contentView.addChildView(toolbarView)
    layoutPopupShell(shellState)

    const syncShellState = () => {
      layoutPopupShell(shellState)
      sendPopupShellState(shellState)
    }
    const focusContent = () => {
      if (contentView.webContents && !contentView.webContents.isDestroyed()) {
        contentView.webContents.focus()
      }
    }

    toolbarView.webContents.on('did-finish-load', () => {
      sendPopupShellState(shellState)
    })
    toolbarView.webContents.on('ipc-message', (_event, channel) => {
      const target = contentView.webContents
      if (!target || target.isDestroyed()) {
        return
      }
      if (channel === 'pinokio:popup-shell-back') {
        if (target.canGoBack()) {
          target.goBack()
        }
        return
      }
      if (channel === 'pinokio:popup-shell-forward') {
        if (target.canGoForward()) {
          target.goForward()
        }
        return
      }
      if (channel === 'pinokio:popup-shell-refresh') {
        target.reload()
        return
      }
      if (channel === 'pinokio:popup-shell-open-home') {
        if (typeof openPinokioHomeWindow === 'function') {
          openPinokioHomeWindow()
        }
      }
    })
    if (browserLike && contentView.webContents && !contentView.webContents.isDestroyed()) {
      getPopupBrowserSession()
      contentView.webContents.setUserAgent(browserLikeUserAgent)
    }
    contentView.webContents.on('did-finish-load', () => {
      if (shellState.win && !shellState.win.isDestroyed()) {
        shellState.win.__pinokioCloseOnFirstDownload = false
      }
      syncShellState()
      focusContent()
    })
    contentView.webContents.on('did-navigate', syncShellState)
    contentView.webContents.on('did-navigate-in-page', syncShellState)
    contentView.webContents.on('page-title-updated', (event) => {
      event.preventDefault()
      sendPopupShellState(shellState)
    })
    win.on('focus', focusContent)
    win.on('resize', syncShellState)

    toolbarView.webContents.loadFile(toolbarHtmlPath).catch((error) => {
      console.error('[pinokio][popup-shell] failed to load toolbar', error)
    })
    if (initialUrl) {
      contentView.webContents.loadURL(initialUrl).catch((error) => {
        console.error('[pinokio][popup-shell] failed to load content url', { initialUrl, error })
      })
    }
    return shellState
  }

  const allowPermissions = (targetSession) => {
    if (!targetSession) {
      return
    }
    targetSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
      callback(true)
    })
  }

  const createPopupWindowState = () => {
    if (typeof windowStateKeeper !== 'function') {
      return {
        x: undefined,
        y: undefined,
        width: 1000,
        height: 800,
        manage: () => {}
      }
    }
    return windowStateKeeper({
//    file: "index.json",
      defaultWidth: 1000,
      defaultHeight: 800
    })
  }

  const createPopupResponse = ({ params, width, height, x, y } = {}) => {
    return {
      action: 'allow',
      outlivesOpener: true,
      overrideBrowserWindowOptions: {
        webPreferences: buildBrowserPopupContentWebPreferences()
      },
      createWindow: (options = {}) => {
        const shellState = createPopupShellWindow({
          width: getFeatureDimension(params, 'width', width),
          height: getFeatureDimension(params, 'height', height),
          x: x + 30,
          y: y + 30,
          adoptedWebContents: options.webContents || null,
          contentWebPreferences: options.webPreferences || {},
          browserLike: true
        })
        return shellState.contentView.webContents
      }
    }
  }

  const openExternalWindow = ({ url, windowState } = {}) => {
    const nextWindowState = windowState || createPopupWindowState()
    const shellState = createPopupShellWindow({
      x: nextWindowState.x,
      y: nextWindowState.y,
      width: nextWindowState.width,
      height: nextWindowState.height,
      browserLike: true,
      initialUrl: url
    })
    const win = shellState.win
    allowPermissions(shellState.contentView.webContents.session)
    win.focus()
    nextWindowState.manage(win)
    return win
  }

  return {
    createPopupResponse,
    getPopupBrowserSession,
    isPinokioWindowUrl,
    resolveTargetUrl,
    openExternalWindow,
    setPinokioHomeWindowOpener: (nextOpener) => {
      openPinokioHomeWindow = typeof nextOpener === 'function' ? nextOpener : null
    }
  }
}
