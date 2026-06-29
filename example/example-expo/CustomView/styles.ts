import { StyleSheet } from 'react-native'

export default StyleSheet.create({
  mapView: {
    width: 150,
    height: 100,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    margin: 3,
    backgroundColor: '#3390EC',
  },

  pin: {
    fontSize: 26,
    marginBottom: 2,
  },

  coords: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 12,
  },

  hint: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 10,
    marginTop: 2,
  },

  text: {
    color: 'tomato',
    fontWeight: 'bold',
  },
})
