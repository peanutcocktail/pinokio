const DOWNLOAD_URL = 'https://desktop.pinokio.co/download.html'

async function confirmArchitecture({ app, dialog, shell, platform = process.platform }) {
  if (platform !== 'darwin' || !app.runningUnderARM64Translation) {
    return true
  }

  const { response } = await dialog.showMessageBox({
    type: 'warning',
    title: 'Pinokio for Apple Silicon',
    message: 'Download Pinokio for Apple Silicon',
    detail: "You're running the Intel version of Pinokio on an Apple Silicon Mac. This can cause apps to fail to install or run.\n\nDownload the Apple Silicon version and replace Pinokio in your Applications folder.",
    buttons: ['Download Apple Silicon Version', 'Quit', 'Continue Anyway'],
    defaultId: 0,
    cancelId: 1,
    noLink: true
  })

  if (response === 2) {
    return true
  }
  if (response === 0) {
    try {
      await shell.openExternal(DOWNLOAD_URL)
    } catch (error) {
      dialog.showErrorBox(
        'Could not open the download page',
        `Open ${DOWNLOAD_URL} in your browser and choose Apple Silicon.`
      )
    }
  }
  app.quit()
  return false
}

module.exports = { confirmArchitecture }
