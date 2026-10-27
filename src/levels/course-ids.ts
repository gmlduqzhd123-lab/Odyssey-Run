import type {StageId} from './courses';
export const VARIANTS = ['classic', 'remix-a', 'remix-b'] as const;
export type VariantId = (typeof VARIANTS)[number];
export type CourseKey = `${StageId}/${VariantId}`;
export const courseKey = (stage: StageId, variant: VariantId): CourseKey => `${stage}/${variant}`;
export const isVariant = (id: string): id is VariantId => VARIANTS.includes(id as VariantId);
