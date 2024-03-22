import { NbtTag, StringReader } from 'deepslate'
import { collectComponents } from './components'
import './main.css'

const INPUT_STORE_KEY = 'misode_nbt2components_input'
const MODE_STORE_KEY = 'misode_nbt2components_mode'

const EXAMPLES = [
  '{Enchantments:[{id:"minecraft:efficiency",lvl:4}]}',
  '"{CustomModelData:372001,display:{Name:\\"Bob\\"}}"',
  'CanPlaceOn:[\\"stone\\",\\"minecraft:grass_block\\"]',
  '{BlockEntityTag:{Patterns:[{Color:2,Pattern:"cs"}]}}',
  '\'{display:{color:2459768},HideFlags:64}\'',
]
const example = EXAMPLES[Math.floor(EXAMPLES.length * Math.random())]

const inputField = document.getElementById('input') as HTMLTextAreaElement
const outputField = document.getElementById('output') as HTMLTextAreaElement
const modeTabs = document.querySelectorAll('.tab') as NodeListOf<HTMLElement>
const clearButton = document.querySelector('.input-clear') as HTMLElement
const copyButton = document.querySelector('.output-copy') as HTMLElement

function nbtToJson(tag: NbtTag): any {
  if (tag.isNumber()) return tag.getAsNumber()
  if (tag.isString()) return tag.getAsString()
  if (tag.isListOrArray()) return tag.map(nbtToJson)
  if (tag.isCompound()) return tag.map((key, value) => [key, nbtToJson(value)])
  throw new Error(`Cannot write ${tag} to JSON`)
}

function getOutput(input: string) {
  const safeRead = (source: string) => {
    const reader = new StringReader(source)
    tag = NbtTag.fromString(reader)
    if (reader.canRead()) {
      throw reader.createError('Found trailing data')
    }
    return tag
  }
  let tag: NbtTag
  try {
    tag = safeRead(input)
  } catch (e) {
    if (e instanceof Error && e.message.includes('Expected value at')) {
      try {
        tag = safeRead(safeRead(`"${input}"`).getAsString())
      } catch (e2) {
        throw e
      }
    } else if (!input.startsWith('{')) {
      try {
        tag = safeRead(`{${input}}`)
      } catch (e2) {
        if (e2 instanceof Error && e2.message.includes('Expected value at')) {
          tag = safeRead(safeRead(`"{${input}}"`).getAsString())
        } else {
          throw e
        }
      }
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
  const mode = document.querySelector('.tab.selected')?.textContent ?? 'JSON'
  if (mode === 'Command') {
    const pairs: string[] = []
    components.forEach((key, value) => pairs.push(key.replace(/^minecraft:/, '') + '=' + value.toString()))
    return `[${pairs.join(',')}]`
  } else {
    return JSON.stringify(nbtToJson(components), null, 2)
  }
}

function update() {
  inputField.placeholder = example
  try {
    outputField.placeholder = getOutput(example)
  } catch (e) {
    console.error('Error while getting example output', e)
  }

  outputField.classList.remove('error')
  if (inputField.value.length === 0) {
    outputField.value = ''
    return
  }
  try {
    outputField.value = getOutput(inputField.value)
  } catch (e) {
    outputField.value = (e instanceof Error) ? e.message : `${e}`
    outputField.classList.add('error')
  }
}

const storedInput = localStorage.getItem(INPUT_STORE_KEY)
if (storedInput !== null) {
  inputField.value = storedInput
}

const storedMode = localStorage.getItem(MODE_STORE_KEY)
if (storedMode !== null) {
  modeTabs.forEach(tab => {
    tab.classList.toggle('selected', tab.textContent === storedMode)
  })
}

update()

inputField.addEventListener('input', () => {
  localStorage.setItem(INPUT_STORE_KEY, inputField.value)
  update()
})

modeTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    modeTabs.forEach(t => t.classList.toggle('selected', tab === t))
    localStorage.setItem(MODE_STORE_KEY, tab.textContent!)
    update()
  })
})

clearButton.addEventListener('click', () => {
  if (inputField.value.length > 0) {
    inputField.value = ''
    localStorage.setItem(INPUT_STORE_KEY, inputField.value)
    update()
    clearButton.classList.add('pressed')
    setTimeout(() => clearButton.classList.remove('pressed'), 200)
  }
})

copyButton.addEventListener('click', () => {
  if (outputField.value.length > 0) {
    navigator.clipboard.writeText(outputField.value)
    copyButton.classList.add('pressed')
    setTimeout(() => copyButton.classList.remove('pressed'), 200)
  }
})
