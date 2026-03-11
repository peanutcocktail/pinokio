const { app } = require('electron')
const Pinokiod = require("pinokiod")
const config = require('./config')
const pinokiod = new Pinokiod(config)

if (process.platform === 'linux') {
  console.log('[PINOKIO DEBUG] Linux startup')
  console.log('[PINOKIO DEBUG] DISPLAY:', process.env.DISPLAY || '<unset>')
  console.log('[PINOKIO DEBUG] WAYLAND_DISPLAY:', process.env.WAYLAND_DISPLAY || '<unset>')
  console.log('[PINOKIO DEBUG] PINOKIO_DISABLE_GPU:', process.env.PINOKIO_DISABLE_GPU || '<unset>')
  console.log('[PINOKIO DEBUG] PINOKIO_USE_VULKAN:', process.env.PINOKIO_USE_VULKAN || '<unset>')
  console.log('[PINOKIO DEBUG] argv:', process.argv.join(' '))
  if (process.env.PINOKIO_DISABLE_GPU === '1') {
    app.disableHardwareAcceleration()
  }
}

let mode = pinokiod.kernel.store.get("mode") || "full"
//iprocess.env.PINOKIO_MODE = process.env.PINOKIO_MODE || 'desktop';
if (mode === 'minimal' || mode === 'background') {
  require('./minimal');
} else {
  require('./full');
}
