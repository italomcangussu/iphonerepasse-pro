# /crm/conversations — pages/crm/ConversationsPage.tsx
Layout/guardas: ProtectedLayout · Rota declarada em: App.tsx

## Árvore de componentes
- ConversationsPage — pages/crm/ConversationsPage.tsx
  - AudioRecorder — components/crm/AudioRecorder.tsx
  - CRMAvatarContent — components/crm/CRMAvatarContent.tsx
  - CRMPageFrame — components/crm/CRMPageFrame.tsx
  - ConversationContextPanel — components/crm/ConversationContextPanel.tsx
    - AICommerceStatePanel — components/crm/AICommerceStatePanel.tsx
    - CRMAvatarContent — components/crm/CRMAvatarContent.tsx
  - ConversationMessagesPanel — components/crm/ConversationMessagesPanel.tsx
    - ConversationWorkspaceState — components/crm/ConversationWorkspaceState.tsx
    - MessageBubble — components/crm/MessageBubble.tsx
    - MessageThreadSkeleton — components/crm/ConversationWorkspaceState.tsx
  - ConversationsListPanel — components/crm/ConversationsListPanel.tsx
    - ConversationListItem — components/crm/ConversationListItem.tsx
      - CRMAvatarContent — components/crm/CRMAvatarContent.tsx
    - ConversationListSkeleton — components/crm/ConversationWorkspaceState.tsx
    - ConversationWorkspaceState — components/crm/ConversationWorkspaceState.tsx
  - MediaViewer — pages/crm/ConversationsPage.tsx
  - Modal (ui)
  - PermissionRequest — components/pwa/PermissionRequest.tsx

## Hooks
- useConversationDrafts — components/crm/useConversationDrafts.ts → —
- useIsMobile — components/ui/Modal.tsx → —
- useFeedback — components/ui/ToastProvider.tsx → —
- useToast — components/ui/ToastProvider.tsx → —
- useAuth — contexts/AuthContext.tsx → —
- usePageHeader — contexts/PageHeaderContext.tsx → —
- useDesktopContextMenu — hooks/useDesktopContextMenu.tsx → —
- useDialogA11y — hooks/useDialogA11y.ts → —
- useDisclosure — hooks/useDisclosure.ts → —
- useMessagesPagination — hooks/useMessagesPagination.ts → crm_messages(s) · realtime crm_messages
- usePermissionState — hooks/usePermissionState.ts → —
- useTranscriber — hooks/useTranscriber.ts → edge crm-audio-transcribe

## Dados alcançados
| Recurso | Operações | Onde |
|---|---|---|
| bucket crm-media | upload, getPublicUrl | pages/crm/ConversationsPage.tsx:1087, pages/crm/ConversationsPage.tsx:1091, pages/crm/ConversationsPage.tsx:845, pages/crm/ConversationsPage.tsx:847 |
| edge crm-audio-transcribe | — | hooks/useTranscriber.ts:41 |
| edge crm-conversation-handoff | — | pages/crm/ConversationsPage.tsx:1638 |
| edge crm-delete-conversation | — | pages/crm/ConversationsPage.tsx:711 |
| edge crm-send-message | — | pages/crm/ConversationsPage.tsx:1017, pages/crm/ConversationsPage.tsx:1095, pages/crm/ConversationsPage.tsx:1241, pages/crm/ConversationsPage.tsx:962, pages/crm/ConversationsPage.tsx:973 |
| edge crm-uaz-media-download | — | components/crm/AudioMessage.tsx:78, components/crm/MessageBubble.tsx:410, components/crm/MessageBubble.tsx:646 |
| edge crm-uaz-message-action | — | pages/crm/ConversationsPage.tsx:1141, pages/crm/ConversationsPage.tsx:593, pages/crm/ConversationsPage.tsx:628 |
| realtime crm_conversations | — | pages/crm/ConversationsPage.tsx:1397 |
| realtime crm_leads | — | pages/crm/ConversationsPage.tsx:1397 |
| realtime crm_messages | — | hooks/useMessagesPagination.ts:204, pages/crm/ConversationsPage.tsx:1397 |
| rpc crm_apply_channel_to_conversation | — | pages/crm/ConversationsPage.tsx:1296 |
| rpc search_crm_messages | — | pages/crm/ConversationsPage.tsx:1432 |
| rpc upsert_crm_lead | — | pages/crm/ConversationsPage.tsx:1279 |
| tabela ai_turn_events | select | pages/crm/ConversationsPage.tsx:649 |
| tabela crm_channels | select | pages/crm/ConversationsPage.tsx:459, pages/crm/ConversationsPage.tsx:514 |
| tabela crm_conversations | select, update, insert | pages/crm/ConversationsPage.tsx:1287, pages/crm/ConversationsPage.tsx:1291, pages/crm/ConversationsPage.tsx:1607, pages/crm/ConversationsPage.tsx:514, pages/crm/ConversationsPage.tsx:583 |
| tabela crm_filter_views | select, insert, delete | pages/crm/ConversationsPage.tsx:738, pages/crm/ConversationsPage.tsx:758, pages/crm/ConversationsPage.tsx:773 |
| tabela crm_leads | select, update | pages/crm/ConversationsPage.tsx:1611, pages/crm/ConversationsPage.tsx:514 |
| tabela crm_messages | select, update | hooks/useMessagesPagination.ts:111, hooks/useMessagesPagination.ts:146, hooks/useMessagesPagination.ts:77, pages/crm/ConversationsPage.tsx:1181, pages/crm/ConversationsPage.tsx:1206, pages/crm/ConversationsPage.tsx:530 +2 |
| tabela lead_state | select | pages/crm/ConversationsPage.tsx:644 |
| tabela user_access_roles | select | pages/crm/ConversationsPage.tsx:478 |
