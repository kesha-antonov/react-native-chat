import { StyleProp, ViewStyle } from 'react-native'
import { IMessage } from '@kesha-antonov/react-native-chat'

export interface CustomViewProps {
  currentMessage: IMessage
  containerStyle?: StyleProp<ViewStyle>
  mapViewStyle?: StyleProp<ViewStyle>
}
