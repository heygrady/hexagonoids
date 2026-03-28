export interface RuntimeScoringHooksConfig {
  reward?: string | undefined
  fitness?: string | undefined
}

export type RuntimeHookAnnotationValue =
  | string
  | number
  | boolean
  | null

export type RuntimeHookAnnotations = Record<
  string,
  RuntimeHookAnnotationValue
>
