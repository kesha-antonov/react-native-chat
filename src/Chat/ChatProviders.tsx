import React from 'react'
import { ChatOverlayProvider } from '../components/ChatOverlay'
import { ComposerPanelsContext, ComposerPanelsStore } from '../components/composerPanels'
import { MediaPlaybackContext, MediaPlaybackController } from '../components/mediaPlayback'
import { MediaTransferContext } from '../components/mediaTransfer'
import { MediaGalleryContext } from '../components/mediaViewer/gallery'
import { MessageHighlightContext, MessageHighlightStore } from '../components/messageHighlight'
import { MessageSelectionContext, MessageSelectionStore } from '../components/messageSelection'

/** The per-chat stores and controllers, handed to everything under the chat by context. */
export function ChatProviders ({
  mediaController,
  mediaTransferController,
  highlightStore,
  selectionStore,
  composerPanels,
  mediaGallery,
  children,
}: {
  mediaController: MediaPlaybackController
  mediaTransferController: React.ContextType<typeof MediaTransferContext>
  highlightStore: MessageHighlightStore
  selectionStore: MessageSelectionStore
  composerPanels: ComposerPanelsStore
  mediaGallery: React.ContextType<typeof MediaGalleryContext>
  children: React.ReactNode
}) {
  return (
    <MediaPlaybackContext.Provider value={mediaController}>
      <MediaTransferContext.Provider value={mediaTransferController}>
        <MessageHighlightContext.Provider value={highlightStore}>
          <MessageSelectionContext.Provider value={selectionStore}>
            <ComposerPanelsContext.Provider value={composerPanels}>
              <MediaGalleryContext.Provider value={mediaGallery}>
                <ChatOverlayProvider>
                  {children}
                </ChatOverlayProvider>
              </MediaGalleryContext.Provider>
            </ComposerPanelsContext.Provider>
          </MessageSelectionContext.Provider>
        </MessageHighlightContext.Provider>
      </MediaTransferContext.Provider>
    </MediaPlaybackContext.Provider>
  )
}
