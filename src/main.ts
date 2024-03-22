import { NbtTag, StringReader } from 'deepslate'
import { collectComponents } from './components'
import './main.css'

const INPUT_STORE_KEY = 'misode_nbt2components_input'

const inputField = document.getElementById('input') as HTMLTextAreaElement
const outputField = document.getElementById('output') as HTMLTextAreaElement

function nbtToJson(tag: NbtTag): any {
  if (tag.isNumber()) return tag.getAsNumber()
  if (tag.isString()) return tag.getAsString()
  if (tag.isListOrArray()) return tag.map(nbtToJson)
  if (tag.isCompound()) return tag.map((key, value) => [key, nbtToJson(value)])
  throw new Error(`Cannot write ${tag} to JSON`)
}

function update() {
  outputField.classList.remove('error')
  try {
    const safeRead = (input: string) => {
      const reader = new StringReader(input)
      tag = NbtTag.fromString(reader)
      if (reader.canRead()) {
        throw reader.createError('Found trailing data')
      }
      return tag
    }
    let tag: NbtTag
    try {
      tag = safeRead(inputField.value)
    } catch (e) {
      if (e instanceof Error && e.message.includes('Expected value at')) {
        try {
          tag = safeRead(safeRead(`"${inputField.value}"`).getAsString())
        } catch (_) {
          throw e
        }
      } else if (!inputField.value.startsWith('{')) {
        tag = safeRead(`{${inputField.value}}`)
      } else {
        throw e
      }
    }
    if (tag.isString()) {
      tag = safeRead(tag.getAsString())
    }
    if (!tag.isCompound()) {
      throw new Error('Expected compound at position 0: <--[HERE]')
    }
    const components = collectComponents(tag)
    outputField.value = JSON.stringify(nbtToJson(components), null, 2)
  } catch (e) {
    outputField.value = (e instanceof Error) ? e.message : `${e}`
    outputField.classList.add('error')
  }
}

const storedInput = localStorage.getItem(INPUT_STORE_KEY)
if (storedInput !== null) {
  inputField.value = storedInput
  update()
}

inputField.addEventListener('input', () => {
  localStorage.setItem(INPUT_STORE_KEY, inputField.value)
  update()
})
