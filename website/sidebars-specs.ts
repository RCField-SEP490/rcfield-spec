import type { SidebarsConfig } from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  specsSidebar: [
    {
      type: 'category',
      label: '001 · User Login',
      collapsed: true,
      items: [
        'user-login/spec',
        'user-login/plan',
        'user-login/data-model',
        'user-login/research',
        'user-login/quickstart',
        'user-login/tasks',
        'user-login/contracts/auth',
      ],
    },
    {
      type: 'category',
      label: '002 · Branch AI Chat RAG',
      collapsed: true,
      items: [
        'branch-ai-chat-rag/spec',
        'branch-ai-chat-rag/plan',
        'branch-ai-chat-rag/data-model',
        'branch-ai-chat-rag/research',
        'branch-ai-chat-rag/quickstart',
        'branch-ai-chat-rag/tasks',
        'branch-ai-chat-rag/contracts/api',
      ],
    },
    {
      type: 'category',
      label: '003 · FB Messenger Channel',
      collapsed: true,
      items: [
        'fb-messenger-channel/spec',
        'fb-messenger-channel/plan',
        'fb-messenger-channel/data-model',
        'fb-messenger-channel/research',
        'fb-messenger-channel/quickstart',
        'fb-messenger-channel/tasks',
        'fb-messenger-channel/contracts/api',
      ],
    },
    {
      type: 'category',
      label: '004 · Provider Subscription',
      collapsed: true,
      items: [
        'provider-subscription/spec',
        'provider-subscription/plan',
        'provider-subscription/data-model',
        'provider-subscription/research',
        'provider-subscription/quickstart',
        'provider-subscription/tasks',
        'provider-subscription/contracts/api',
      ],
    },
  ],
};

export default sidebars;
