// Metro selects LocationMap.web.tsx for browsers. Native map components must
// never be evaluated in the browser's shared route bundle.
export { default, Marker } from 'react-native-maps';
