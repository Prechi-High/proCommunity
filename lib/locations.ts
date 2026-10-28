import locationData from "country-region-data/data.json";
/** Published country/subdivision names, bundled locally: no location permissions or network needed. */
export const countries = locationData.map(c => ({name:c.countryName,isoCode:c.countryShortCode}));
export const statesFor = (country: string) => (locationData.find(c=>c.countryShortCode===country)?.regions || []).map(s=>({name:s.name,isoCode:('shortCode' in s && s.shortCode) || s.name}));
