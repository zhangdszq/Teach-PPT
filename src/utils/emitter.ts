import mitt, { type Emitter } from 'mitt'

export const enum EmitterEvents {
  RICH_TEXT_COMMAND = 'RICH_TEXT_COMMAND',
  SYNC_RICH_TEXT_ATTRS_TO_STORE = 'SYNC_RICH_TEXT_ATTRS_TO_STORE',
  OPEN_CHART_DATA_EDITOR = 'OPEN_CHART_DATA_EDITOR',
  OPEN_LATEX_EDITOR = 'OPEN_LATEX_EDITOR',
  OPEN_AI_IMAGE_DIALOG = 'OPEN_AI_IMAGE_DIALOG',
}

export interface RichTextAction {
  command: string
  value?: string
}

export interface RichTextCommand {
  target?: string
  action: RichTextAction | RichTextAction[]
}

type Events = {
  [EmitterEvents.RICH_TEXT_COMMAND]: RichTextCommand
  [EmitterEvents.SYNC_RICH_TEXT_ATTRS_TO_STORE]: void
  [EmitterEvents.OPEN_CHART_DATA_EDITOR]: void
  [EmitterEvents.OPEN_LATEX_EDITOR]: void
  [EmitterEvents.OPEN_AI_IMAGE_DIALOG]: void
}

const emitter: Emitter<Events> = mitt<Events>()

export default emitter