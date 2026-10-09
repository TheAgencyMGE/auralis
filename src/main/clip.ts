// Electron 44's clipboard is asynchronous and modelled on the W3C API.
import { clipboard, ClipboardItem } from 'electron'
import { logger } from './log'

const log = logger('clipboard')

export function copyText(text: string): void {
  clipboard.writeText(text).catch((err) => log.warn('writeText', err))
}

export function copyPng(png: Buffer): void {
  const blob = new Blob([new Uint8Array(png)], { type: 'image/png' })
  clipboard.write([new ClipboardItem({ 'image/png': blob })]).catch((err) => log.warn('write image', err))
}
