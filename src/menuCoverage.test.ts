import { describe, expect, it } from 'vitest'
import { SUB_MENUS } from './fastview/menuConfig'
import { actionIdToDrawTool } from './drawTools'
import { actionIdToEditTool } from './editTools'

const EXPLICIT_ACTIONS = new Set([
  'layer-list',
  'layer-all-on',
  'layer-off',
  'layer-isolate',
  'layer-previous',
  'layer-new',
  'layer-default',
  'measure-distance',
  'measure-continuous',
  'measure-batch',
  'measure-area',
  'measure-facade',
  'measure-point',
  'measure-arc',
  'measure-entity',
  'measure-angle',
  'measure-scale',
  'measure-results',
  'measure-count',
  'measure-precision',
  'dim-linear',
  'dim-aligned',
  'dim-angular',
  'dim-radius',
  'dim-diameter',
  'dim-arclength',
  'dim-3point-arc',
  'ann-text',
  'draw-text',
  'ann-number',
  'ann-audio',
  'ann-video',
  'ann-image',
  'draw-smartpen',
])

function isCovered(actionId: string) {
  return (
    actionIdToDrawTool(actionId) !== null ||
    actionIdToEditTool(actionId) !== null ||
    EXPLICIT_ACTIONS.has(actionId)
  )
}

describe('menu coverage', () => {
  Object.entries(SUB_MENUS).forEach(([category, items]) => {
    items.forEach((item) => {
      it(`${category}/${item.id} (${item.label}) is wired`, () => {
        expect(isCovered(item.id)).toBe(true)
      })
    })
  })
})
