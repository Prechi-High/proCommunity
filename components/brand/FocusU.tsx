import Svg, { Path } from 'react-native-svg';

/** B Precision Focus U — square-ended corners per Unmask brand kit. */
export function FocusU({ size = 48, color = '#161616' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 128 128" fill={color}>
      <Path d="M32 40h16v34a16 16 0 0 0 32 0V40h16v34a32 32 0 0 1-64 0Z" />
      <Path d="M16 16h24v8H24v16h-8Zm72 0h24v24h-8V24H88ZM16 88h8v16h16v8H16Zm88 0h8v24H88v-8h16Z" />
    </Svg>
  );
}
