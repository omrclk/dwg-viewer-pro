import type { TextRun } from '../drawingTypes'
import { aciColor, rgbCss } from './geometry'

type Style = {
  heightScale: number
  widthFactor: number
  absoluteHeight?: number
  color?: string
  oblique?: number
}

const COMMANDS = new Set(['f', 'F', 'h', 'H', 'c', 'C', 'w', 'W', 'q', 'Q', 'a', 'A', 't', 'T', 'l', 'L', 'o', 'O', 'p'])

function trueColorCss(value: number) {
  const rgb = value >>> 0
  const red = (rgb >> 16) & 255
  const green = (rgb >> 8) & 255
  const blue = rgb & 255
  return rgbCss(red, green, blue)
}

function pushRun(line: TextRun[], text: string, style: Style) {
  if (!text) return
  line.push({
    text,
    heightScale: style.heightScale,
    widthFactor: style.widthFactor,
    absoluteHeight: style.absoluteHeight,
    color: style.color,
    oblique: style.oblique,
  })
}

/** Parse TEXT/MTEXT control codes into lines of styled runs. Glyphs are never stretched to a box. */
export function parseMText(value: string): TextRun[][] {
  const source = value ?? ''
  const lines: TextRun[][] = [[]]
  const stack: Style[] = []
  let style: Style = { heightScale: 1, widthFactor: 1 }
  let buffer = ''

  const flush = () => {
    pushRun(lines[lines.length - 1], buffer, style)
    buffer = ''
  }

  for (let index = 0; index < source.length; index += 1) {
    const current = source[index]

    if (current === '%' && source[index + 1] === '%') {
      const code = source[index + 2]
      if (!code) break
      if (code === 'c' || code === 'C') buffer += 'Ø'
      else if (code === 'd' || code === 'D') buffer += '°'
      else if (code === 'p' || code === 'P') buffer += '±'
      else if (code === '%') buffer += '%'
      else if (code === 'u' || code === 'U' || code === 'o' || code === 'O') {
        index += 2
        continue
      } else {
        buffer += current
        continue
      }
      index += 2
      continue
    }

    if (current === '{') {
      flush()
      stack.push({ ...style })
      continue
    }

    if (current === '}') {
      flush()
      style = stack.pop() ?? { heightScale: 1, widthFactor: 1 }
      continue
    }

    if (current === '\\' && index + 1 < source.length) {
      const next = source[index + 1]
      if (next === '\\' || next === '{' || next === '}') {
        buffer += next
        index += 1
        continue
      }
      if (next === '~') {
        buffer += ' '
        index += 1
        continue
      }
      if (next === 'P') {
        flush()
        lines.push([])
        index += 1
        continue
      }
      if (next === 'n') {
        flush()
        lines.push([])
        index += 1
        continue
      }
      if (next === 'U' && source.slice(index + 1, index + 3) === 'U+') {
        const hex = /^[0-9A-Fa-f]{4}/.exec(source.slice(index + 3))
        if (hex) {
          const codePoint = Number.parseInt(hex[0], 16)
          if (codePoint >= 0 && codePoint <= 0x10ffff) buffer += String.fromCodePoint(codePoint)
          index += 2 + hex[0].length
          continue
        }
      }
      if (next === 'S' || next === 's') {
        const end = source.indexOf(';', index)
        const body = source.slice(index + 2, end === -1 ? source.length : end)
        buffer += body.replace(/[\^#]/g, '/')
        index = end === -1 ? source.length : end
        continue
      }
      if (COMMANDS.has(next)) {
        const end = source.indexOf(';', index)
        if (end === -1) {
          index += 1
          continue
        }
        const body = source.slice(index + 2, end).trim()
        flush()
        if (next === 'H' || next === 'h') {
          const relative = /x$/i.test(body)
          const amount = Number.parseFloat(body)
          if (Number.isFinite(amount) && amount > 0) {
            style = relative
              ? { ...style, heightScale: style.heightScale * amount, absoluteHeight: undefined }
              : { ...style, absoluteHeight: amount }
          }
        } else if (next === 'W' || next === 'w') {
          const relative = /x$/i.test(body)
          const amount = Number.parseFloat(body)
          if (Number.isFinite(amount) && amount > 0) {
            style = { ...style, widthFactor: relative ? style.widthFactor * amount : amount }
          }
        } else if (next === 'Q' || next === 'q') {
          const amount = Number.parseFloat(body)
          if (Number.isFinite(amount)) style = { ...style, oblique: amount }
        } else if (next === 'C') {
          const amount = Number.parseInt(body, 10)
          if (Number.isFinite(amount)) style = { ...style, color: aciColor(amount) }
        } else if (next === 'c') {
          const amount = Number.parseInt(body, 10)
          if (Number.isFinite(amount)) style = { ...style, color: trueColorCss(amount) }
        }
        index = end
        continue
      }
    }

    buffer += current
  }

  flush()
  while (lines.length > 1 && lines[lines.length - 1].length === 0) lines.pop()
  return lines.length ? lines : [[]]
}

export function plainMText(value: string) {
  return parseMText(value)
    .map((line) => line.map((run) => run.text).join(''))
    .join('\n')
    .trim()
}

/** Cap height in CSS pixels. Text under 2 screen pixels is omitted so fit-to-screen labels do not turn into bars. */
export function screenTextSize(worldHeight: number, pixelsPerUnit: number) {
  if (!Number.isFinite(worldHeight) || !Number.isFinite(pixelsPerUnit)) return 0
  if (worldHeight <= 0 || pixelsPerUnit <= 0) return 0
  const size = worldHeight * pixelsPerUnit
  return size < 2 ? 0 : size
}
