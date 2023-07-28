import { Color3, type Scene, StandardMaterial } from '@babylonjs/core'
import QuickLRU from 'quick-lru'
import { createUniqueId } from 'solid-js'

import { CELL_CACHE_SIZE } from '../constants'

export interface CommonMaterialOptions {
  alpha: number
  ambientColor: Color3
  diffuseColor: Color3
  emissiveColor: Color3
  specularColor: Color3
}

export const materialCache = new QuickLRU<string, StandardMaterial>({
  maxSize: CELL_CACHE_SIZE,
  onEviction: (key, value) => {
    console.log('evicting material', key)
  },
})

export const COMMON_MATERIAL_KEY_PREFIX = 'commonMaterial'

export const getMaterialKey = (
  options?: Partial<CommonMaterialOptions>
): string => {
  let suffix = ''

  if (options != null) {
    if (options.alpha != null) {
      suffix += `_alpha_${Math.floor(options.alpha * 1000)}`
    }
    if (options.ambientColor != null) {
      suffix += `_ambient_${options.ambientColor.toHexString()}`
    }
    if (options.diffuseColor != null) {
      suffix += `_diffuse_${options.diffuseColor.toHexString()}`
    }
    if (options.emissiveColor != null) {
      suffix += `_emissive_${options.emissiveColor.toHexString()}`
    }
    if (options.specularColor != null) {
      suffix += `_specular_${options.specularColor.toHexString()}`
    }
  }

  return `${COMMON_MATERIAL_KEY_PREFIX}${suffix}`
}

export const getCommonMaterial = (
  scene: Scene,
  options?: Partial<CommonMaterialOptions>
): StandardMaterial => {
  const key = getMaterialKey(options)
  if (materialCache.has(key)) {
    return materialCache.get(key) as StandardMaterial
  }

  const id = createUniqueId()

  // get the no-options material
  const commonMaterial = materialCache.get(COMMON_MATERIAL_KEY_PREFIX)

  // clone it or create if we must
  const material =
    commonMaterial != null
      ? commonMaterial.clone(`commonMaterial_${id}_${key}`)
      : new StandardMaterial(`commonMaterial_${id}_${key}`, scene)

  if (!materialCache.has(COMMON_MATERIAL_KEY_PREFIX)) {
    materialCache.set(
      COMMON_MATERIAL_KEY_PREFIX,
      material.clone(`commonMaterial_${id}_${COMMON_MATERIAL_KEY_PREFIX}`)
    )
  }

  if (options?.alpha != null) {
    material.alpha = options.alpha
  }

  if (options?.ambientColor != null) {
    material.ambientColor = options.ambientColor
  }

  material.diffuseColor = options?.diffuseColor ?? Color3.White()
  material.specularColor = options?.specularColor ?? Color3.Black()
  material.emissiveColor = options?.emissiveColor ?? Color3.Black()

  materialCache.set(key, material)

  material.onDisposeObservable.addOnce(() => {
    materialCache.delete(key)
  })

  console.log('materialCache.size', materialCache.size)

  return material
}
