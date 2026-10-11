export function dynamicProductUiEnabled(): boolean {
  const v = (process.env.EXPO_PUBLIC_DYNAMIC_PRODUCT_UI ?? 'true').toLowerCase();
  return v === '1' || v === 'true' || v === 'on' || v === 'yes';
}
