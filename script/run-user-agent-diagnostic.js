const { app, BrowserWindow, session } = require('electron')
const http = require('http')
const { configurePinokioUserAgent } = require('../user-agent')

const run = async () => {
  configurePinokioUserAgent({ app, session: session.defaultSession })
  const server = http.createServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
    res.end('<html><body>UA diagnostic</body></html>')
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))

  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      session: session.defaultSession,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  try {
    const { port } = server.address()
    await win.loadURL(`http://127.0.0.1:${port}/`)
    const result = await win.webContents.executeJavaScript(`({
      userAgent: navigator.userAgent,
      userAgentData: navigator.userAgentData ? {
        brands: navigator.userAgentData.brands,
        mobile: navigator.userAgentData.mobile,
        platform: navigator.userAgentData.platform
      } : null,
      vendor: navigator.vendor,
      platform: navigator.platform
    })`)
    console.log(JSON.stringify(result, null, 2))
  } finally {
    win.destroy()
    await new Promise((resolve) => server.close(resolve))
  }
}

app.whenReady()
  .then(run)
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => {
    app.quit()
  })
