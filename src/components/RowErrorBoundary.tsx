import React from 'react'

import { error } from '../logging'

interface RowErrorBoundaryProps {
  /** The row's message id, for the log. */
  id: string
  /** The row's message: a new one (an edit, a fix from the server) tries the row again. */
  resetKey: unknown
  children: React.ReactNode
}

interface RowErrorBoundaryState {
  failedKey: unknown
  hasFailed: boolean
}

/**
 * One message that throws while rendering, from data no check foresaw or from an app's own
 * render function, hides its own row instead of taking the whole chat down. Logs the id and
 * the error, never the message's content.
 */
export class RowErrorBoundary extends React.Component<RowErrorBoundaryProps, RowErrorBoundaryState> {
  state: RowErrorBoundaryState = { failedKey: undefined, hasFailed: false }

  static getDerivedStateFromError (): Partial<RowErrorBoundaryState> {
    return { hasFailed: true }
  }

  static getDerivedStateFromProps (props: RowErrorBoundaryProps, state: RowErrorBoundaryState): Partial<RowErrorBoundaryState> | null {
    if (state.hasFailed && state.failedKey !== undefined && state.failedKey !== props.resetKey)
      return { hasFailed: false, failedKey: undefined }
    return null
  }

  componentDidCatch (caught: unknown) {
    this.setState({ failedKey: this.props.resetKey })
    const reason = caught instanceof Error ? `${caught.name}: ${caught.message}` : 'unknown error'
    error(`Message ${this.props.id} failed to render and is hidden. ${reason}`)
  }

  render () {
    return this.state.hasFailed ? null : this.props.children
  }
}
