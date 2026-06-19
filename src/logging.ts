const styleString = (color: string) => `color: ${color}; font-weight: bold`
const headerLog = '%c[@kesha-antonov/react-native-chat]'

export const warning = (...args: unknown[]) =>
  console.log(headerLog, styleString('orange'), ...args)

export const error = (...args: unknown[]) =>
  console.log(headerLog, styleString('red'), ...args)
