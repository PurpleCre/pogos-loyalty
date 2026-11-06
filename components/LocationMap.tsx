// Metro selects LocationMap.web.tsx for browsers. Native map components must
// never be evaluated in the browser's shared route bundle.
import NativeMap, { type MapViewProps } from 'react-native-maps';
export { Marker } from 'react-native-maps';
export default function LocationMap({ disabled, ...props }: MapViewProps & { disabled?: boolean }) {
  return <NativeMap {...props} scrollEnabled={disabled ? false : props.scrollEnabled} zoomEnabled={disabled ? false : props.zoomEnabled} />;
}
