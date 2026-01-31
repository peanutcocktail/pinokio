const { autoUpdater } = require("electron-updater");
const ProgressBar = require('electron-progressbar');
const { dialog } = require('electron');

class Updater {
  constructor(handlers = {}) {
    this.handlers = handlers || {};
    this.mainWindow = null;
    this.progressBar = null;
  }

  setHandlers(handlers = {}) {
    this.handlers = handlers || {};
  }

  run(mainWindow, handlers = null) {
    if (handlers) {
      this.setHandlers(handlers);
    }
    this.mainWindow = mainWindow || null;
    autoUpdater.autoDownload = false;

    autoUpdater.on('checking-for-update', () => {
      console.log('Checking for update...');
    });

    autoUpdater.on('update-available', (info) => {
      console.log('Update available:', info.version);
      if (this.handlers && typeof this.handlers.onUpdateAvailable === 'function') {
        this.handlers.onUpdateAvailable(info);
        return;
      }
      this.showDefaultUpdatePrompt(info);
    });

    autoUpdater.on('update-not-available', () => {
      console.log('No update available.');
      if (this.handlers && typeof this.handlers.onUpdateNotAvailable === 'function') {
        this.handlers.onUpdateNotAvailable();
      }
    });

    autoUpdater.on("download-progress", (progress) => {
      console.log(`Downloaded ${Math.round(progress.percent)}%`);
      if (this.handlers && typeof this.handlers.onDownloadProgress === 'function') {
        this.handlers.onDownloadProgress(progress);
        return;
      }
      this.updateDefaultProgress(progress);
    });

    autoUpdater.on("update-downloaded", (info) => {
      console.log("Update downloaded:", info.version);
      if (this.handlers && typeof this.handlers.onUpdateDownloaded === 'function') {
        this.handlers.onUpdateDownloaded(info);
        return;
      }
      this.showDefaultRestartPrompt(info);
    });

    autoUpdater.on("error", (err) => {
      console.error("Update error:", err);
      if (this.handlers && typeof this.handlers.onError === 'function') {
        this.handlers.onError(err);
        return;
      }
      this.closeProgressBar();
    });

    autoUpdater.checkForUpdates().catch((err) => {
      // The updater promise rejects on recoverable network errors; log and continue.
      console.error('Failed to check for updates:', err)
    });
  }

  downloadUpdate() {
    return autoUpdater.downloadUpdate();
  }

  quitAndInstall() {
    autoUpdater.quitAndInstall();
  }

  showDefaultUpdatePrompt(info) {
    const targetWindow = this.mainWindow;
    dialog.showMessageBox(targetWindow, {
      type: 'question',
      buttons: ['Yes', 'No'],
      defaultId: 0,
      cancelId: 1,
      title: 'Update Available',
      message: `Version ${info.version} is available. Do you want to download it now?`
    }).then(result => {
      if (result.response === 0) {
        this.startDefaultDownload();
      }
    });
  }

  startDefaultDownload() {
    if (this.progressBar) {
      this.progressBar.close();
      this.progressBar = null;
    }
    this.progressBar = new ProgressBar({
      indeterminate: false,
      text: "Downloading update...",
      detail: "Please wait...",
      browserWindow: {
        parent: this.mainWindow,
        modal: true,
        closable: false,
        minimizable: false,
        maximizable: false,
        width: 400,
        height: 120
      }
    });
    autoUpdater.downloadUpdate();
  }

  updateDefaultProgress(progress) {
    if (this.progressBar && !this.progressBar.isCompleted()) {
      this.progressBar.value = Math.floor(progress.percent);
      this.progressBar.detail = `Downloaded ${Math.round(progress.percent)}% (${(progress.transferred / 1024 / 1024).toFixed(2)} MB of ${(progress.total / 1024 / 1024).toFixed(2)} MB)`;
    }
  }

  showDefaultRestartPrompt(info) {
    if (this.progressBar && !this.progressBar.isCompleted()) {
      this.progressBar.setCompleted();
      this.progressBar = null;
    }
    dialog.showMessageBox(this.mainWindow, {
      type: "info",
      buttons: ["Restart Now", "Later"],
      title: "Update Ready",
      message: "A new version has been downloaded. Restart the application to apply the updates?"
    }).then((result) => {
      if (result.response === 0) {
        autoUpdater.quitAndInstall();
      }
    });
  }

  closeProgressBar() {
    if (this.progressBar && !this.progressBar.isCompleted()) {
      this.progressBar.close();
      this.progressBar = null;
    }
  }
}

module.exports = Updater;
