import { NbtByte, NbtCompound, NbtFloat, NbtInt, NbtList, NbtString, NbtTag } from 'deepslate'

export function collectComponents(tag: NbtCompound): NbtCompound {
  const components = new NbtCompound()

  function move(key: string, component: string, updater?: (data: NbtTag) => NbtTag | undefined, root?: NbtCompound) {
    const prev = (root ?? tag).get(key)
    if (prev !== undefined) {
      const next = updater ? updater(prev) : prev
      if (next !== undefined) {
        components.set(`minecraft:${component}`, next)
      }
      (root ?? tag).delete(key)
    }
  }

  move('Damage', 'damage')

  move('RepairCost', 'repair_cost')

  move('Unbreakable', 'unbreakable', data => {
    if (data.isNumber() && data.getAsNumber() === 1) {
      return new NbtCompound()
    }
    return undefined
  })

  function enchantmentUpdater(data: NbtTag) {
    const map = new NbtCompound()
    if (!data.isList()) return map
    data.forEach(e => {
      if (!e.isCompound()) return
      map.set(e.getString("id"), new NbtInt(e.get("lvl")?.getAsNumber() ?? 1))
    })
    return map
  }
  move('Enchantments', 'enchantments', enchantmentUpdater)
  move('StoredEnchantments', 'stored_enchantments', enchantmentUpdater)

  const displayTag = tag.get('display')
  if (displayTag?.isCompound()) {
    move('Name', 'custom_name', undefined, displayTag)
    move('Lore', 'lore', undefined, displayTag)
    move('color', 'dyed_color', undefined, displayTag)
    move('MapColor', 'map_color', undefined, displayTag)
    if (displayTag.size === 0) {
      tag.delete('display')
    }
  }

  function adventureModePredicateUpdater(data: NbtTag) {
    if (!data.isList()) return data
    const predicate = new NbtCompound()
    predicate.set('blocks', data) // TODO: handle block states
    return predicate
  }

  move('CanDestroy', 'can_break', adventureModePredicateUpdater)
  move('CanPlaceOn', 'can_place_one', adventureModePredicateUpdater)

  const attributeOperations = ['add_value', 'add_multiplied_base', 'add_multiplied_total']

  function modifierUpdater(data: NbtTag) {
    if (!data.isCompound()) return data
    const attributeName = data.get('AttributeName')
    const slot = data.get('Slot')
    const uuid = data.get('UUID')
    const name = data.get('Name')
    const amount = data.get('Amount')
    const operation = data.get('Operation')
    const modifier = new NbtCompound()
    if (attributeName) modifier.set('type', attributeName)
    if (slot) modifier.set('slot', slot)
    if (uuid) modifier.set('uuid', uuid)
    if (name) modifier.set('name', name)
    if (amount) modifier.set('amount', amount)
    if (operation) modifier.set('operation', new NbtString(attributeOperations[operation.getAsNumber()]))
    return modifier
  }

  move('AttributeModifiers', 'attribute_modifiers', data => {
    if (!data.isList()) return data
    return new NbtList(data.map(modifierUpdater))
  })

  function itemStackUpdater(data: NbtTag) {
    if (!data.isCompound()) return data
    const id = data.get('id')
    const count = data.get('Count')
    const tag = data.get('tag')
    const item = new NbtCompound()
    if (id) item.set('id', id)
    if (count) item.set('count', count)
    if (tag?.isCompound()) {
      const components = collectComponents(tag)
      if (components.size > 0) item.set('components', components)
    }
    return item
  }

  move('Items', 'bundle_contents', data => {
    if (!data.isList()) return data
    return new NbtList(data.map(itemStackUpdater))
  })

  const decorationTypes = ['player', 'frame', 'red_marker', 'blue_marker', 'target_x', 'target_point', 'player_off_map', 'player_off_limits', 'mansion', 'monument', 'banner_white', 'banner_orange', 'banner_magenta', 'banner_light_blue', 'banner_yellow', 'banner_lime', 'banner_pink', 'banner_gray', 'banner_light_gray', 'banner_cyan', 'banner_purple', 'banner_blue', 'banner_brown', 'banner_green', 'banner_red', 'banner_black', 'red_x', 'village_desert', 'village_plains', 'village_savanna', 'village_snowy', 'village_taiga', 'jungle_temple', 'swamp_hut']

  function decorationUpdater(data: NbtTag) {
    if (!data.isCompound()) return data
    const type = data.get('type')
    const x = data.get('x')
    const z = data.get('z')
    const rot = data.get('rot')
    const decoration = new NbtCompound()
    if (type) decoration.set('type', new NbtString(decorationTypes[type.getAsNumber()]))
    if (x) decoration.set('x', x)
    if (z) decoration.set('z', z)
    if (rot) decoration.set('rotation', new NbtFloat(rot.getAsNumber()))
    return decoration
  }

  move('Decorations', 'map_decorations', data => {
    const map = new NbtCompound()
    if (!data.isList()) return map
    data.forEach((e, i) => {
      map.set(i.toString(), decorationUpdater(e))
    })
    return map
  })

  move('map', 'map')

  move('CustomModelData', 'custom_model_data')

  const potion = tag.get('Potion')
  const customPotionColor = tag.get('CustomPotionColor')
  const customPotionEffects = tag.get('custom_potion_effects')
  if (potion || customPotionColor || customPotionEffects) {
    if (customPotionColor || customPotionEffects) {
      const potionContents = new NbtCompound()
      if (potion) {
        potionContents.set('potion', potion)
      }
      if (customPotionColor) {
        potionContents.set('custom_color', customPotionColor)
      }
      if (customPotionEffects) {
        potionContents.set('custom_effects', customPotionEffects)
      }
      components.set('minecraft:potion_contents', potionContents)
    } else if(potion) {
      components.set('minecraft:potion_contents', potion)
    }
    tag.delete('Potion')
    tag.delete('CustomPotionColor')
    tag.delete('custom_potion_effects')
  }

  const pages = tag.get('pages')
  const filteredPages= tag.get('filtered_pages')
  const title = tag.get('title')
  const filteredTitle = tag.get('filtered_title')
  const author = tag.get('author')
  const generation = tag.get('generation')
  const resolved = tag.get('resolved')
  if (pages || filteredPages || title || filteredTitle || author || generation || resolved) {
    let writable = false
    if (pages && pages.isList() && pages.length > 0) {
      try {
        JSON.parse(pages.getString(0))
      } catch {
        writable = true
      }
    }
    const contents = new NbtCompound()
    if (pages?.isList()) {
      contents.set('pages', filteredPages?.isList()
        ? new NbtList(pages.map((p, i) => new NbtCompound().set('text', p).set('filtered', filteredPages.get(i)!)))
        : pages)
    }
    if (!writable) {
      if (title) {
        contents.set('title', filteredTitle?.isString()
          ? new NbtCompound().set('text', title).set('filtered', filteredTitle)
          : title)
      }
      if (author) contents.set('author', author)
      if (generation) contents.set('generation', generation)
      if (resolved) contents.set('resolved', resolved)
    }
    components.set(writable ? 'minecraft:writable_book_content' : 'minecraft:written_book_contents', contents)
    tag.delete('pages')
    tag.delete('filtered_pages')
    tag.delete('title')
    tag.delete('filtered_title')
    tag.delete('author')
    tag.delete('generation')
    tag.delete('resolved')
  }

  move('Trim', 'trim')

  move('effects', 'suspicious_stew')

  const hideFlags = tag.get('HideFlags')
  if (hideFlags) {
    const setFlag = (key: string, wrap?: string, list?: boolean) => {
      let data = components.get(`minecraft:${key}`)
      let result: NbtCompound
      if (data && wrap && !(data.isCompound() && data.has(wrap))) {
        result = new NbtCompound().set(wrap, list ? new NbtList([data]) : data)
      } else if (data?.isCompound()) {
        result = data
      } else {
        result = new NbtCompound()
      }
      result.set('show_in_tooltip', new NbtByte(0))
      components.set(`minecraft:${key}`, result)
    }
    const flags = hideFlags.getAsNumber()
    if ((flags & 0b0000001) > 0) setFlag('enchantments', 'levels')
    if ((flags & 0b0000010) > 0) setFlag('attribute_modifiers', 'modifiers')
    if ((flags & 0b0000100) > 0) setFlag('unbreakable')
    if ((flags & 0b0001000) > 0) setFlag('can_break', 'predicates', true)
    if ((flags & 0b0010000) > 0) setFlag('can_place_on', 'predicates', true)
    if ((flags & 0b0100000) > 0) {
      setFlag('stored_enchantments', 'levels')
      components.set('minecraft:hide_additional_tooltip', new NbtByte(1))
    }
    if ((flags & 0b1000000) > 0) setFlag('dyed_color', 'rgb')
    tag.delete('HideFlags')
  }

  move('DebugProperty', 'debug_stick_state')

  move('EntityTag', 'entity_data') // TODO: handle bucket_entity_data

  move('instrument', 'instrument')

  move('Recipes', 'recipes')

  const lodestonePos = tag.get('LodestonePos')
  const lodestoneDimension = tag.get('LodestoneDimension')
  const lodestoneTracked  = tag.get('LodestoneTracked')
  if (lodestonePos || lodestoneDimension || lodestoneTracked) {
    const tracker = new NbtCompound()
    if (lodestonePos || lodestoneDimension) {
      const target = new NbtCompound()
      if (lodestonePos) target.set('pos', lodestonePos)
      if (lodestoneDimension) target.set('dimension', lodestoneDimension)
      tracker.set('target', target)
    }
    if (lodestoneTracked) {
      tracker.set('tracked', lodestoneTracked)
    }
    components.set('lodestone_tracker', tracker)
    tag.delete('LodestonePos')
    tag.delete('LodestoneDimension')
    tag.delete('LodestoneTracked')
  }

  const explosionShapes = ['small_ball', 'large_ball', 'star', 'creeper', 'burst']

  function explosionUpdater(data: NbtTag) {
    if (!data.isCompound()) return data
    const type = data.get('Type')
    const colors = data.get('Colors')
    const fadeColors = data.get('FadeColors')
    const trail = data.get('Trail')
    const flicker = data.get('Flicker')
    const explosion = new NbtCompound()
    if (type) explosion.set('shape', new NbtString(explosionShapes[type.getAsNumber()]))
    if (colors) explosion.set('colors', colors)
    if (fadeColors) explosion.set('fade_colors', fadeColors)
    if (trail) explosion.set('has_trail', trail)
    if (flicker) explosion.set('has_twinkle', flicker)
    return explosion
  }

  move('Explosion', 'firework_exlosion', explosionUpdater)

  const explosions = tag.get('Explosions')
  const flight = tag.get('Flight')
  if (explosions || flight) {
    const fireworks = new NbtCompound()
    if (explosions) {
      fireworks.set('explosions', explosions.isList() ? new NbtList(explosions.map(explosionUpdater)) : explosions)
    }
    if (flight) fireworks.set('flight_duration', flight)
    components.set('fireworks', fireworks)
    tag.delete('Explosions')
    tag.delete('Flight')
  }

  function slotUpdater(data: NbtTag) {
    if (!data.isCompound()) return data
    const slot = data.get('Slot')
    const result = new NbtCompound()
    if (slot) {
      result.set('slot', new NbtInt(slot.getAsNumber()))
    }
    const item = itemStackUpdater(data)
    if (!item.isCompound() || item.size > 0) {
      result.set('item', item)
    }
    return result
  }

  const dyeColors = ['white', 'orange', 'magenta', 'light_blue', 'yellow', 'lime', 'pink', 'gray', 'light_gray', 'cyan', 'purple', 'blue', 'brown', 'green', 'red', 'black']

  function patternUpdater(data: NbtTag) {
    if (!data.isCompound()) return data
    return data
  }

  const blockEntityTag = tag.get('BlockEntityTag')
  if (blockEntityTag?.isCompound()) {
    move('note_block_sound', 'note_block_sound', undefined, blockEntityTag)
    move('Base', 'base_color', data => {
      if (!data.isNumber()) return data
      return new NbtString(dyeColors[data.getAsNumber()])
    }, blockEntityTag)
    move('Patterns', 'banner_patterns', data => {
      if (!data.isList()) return data
      return new NbtList(data.map(patternUpdater))
    }, blockEntityTag)
    move('sherds', 'pot_decorations', undefined, blockEntityTag)
    move('Items', 'container', data => {
      if (!data.isList()) return data
      return new NbtList(data.map(slotUpdater))
    }, blockEntityTag)
    move('Bees', 'bees', undefined, blockEntityTag)
    move('Lock', 'lock', undefined, blockEntityTag)
    const lootTable = blockEntityTag.get('LootTable')
    const lootTableSeed = blockEntityTag.get('LootTableSeed')
    if (lootTable || lootTableSeed) {
      const loot = new NbtCompound()
      if (lootTable) loot.set('loot_table', lootTable)
      if (lootTableSeed) loot.set('seed', lootTableSeed)
      components.set('minecraft:container_loot', loot)
    }
    if (blockEntityTag.size > 0) {
      components.set('minecraft:block_entity_data', blockEntityTag)
    }
    tag.delete('BlockEntityTag')
  }

  move('BlockStateTag', 'block_state')

  move('SkullOwner', 'profile', data => {
    if (!data.isCompound()) return data
    const name = data.get('Name')
    const id = data.get('Id')
    const properties = data.get('Properties')
    if (name && !id && !properties) {
      return name
    } else {
      const profile = new NbtCompound()
      if (name) profile.set('name', name)
      if (id) profile.set('id', id)
      if (properties) profile.set('properties', properties)
      return profile
    }
  })

  if (tag.size > 0) {
    components.set('minecraft:custom_data', tag)
  }

  return components
}
