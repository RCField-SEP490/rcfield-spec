import type { SidebarsConfig } from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  mainSidebar: [
    {
      type: 'category',
      label: 'Business Spec',
      collapsible: false,
      items: [
        'spec/overview',
        'spec/domain-model',
        'spec/state-machine',
        'spec/payment-engine',
        'spec/inspection-flow',
        'spec/api-contracts',
        'spec/database',
        {
          type: 'category',
          label: 'Business Rules',
          collapsed: true,
          items: [
            'spec/business-rules/BR-booking',
            'spec/business-rules/BR-payment',
            'spec/business-rules/BR-inspection',
            'spec/business-rules/BR-extension',
            'spec/business-rules/BR-fleet',
            'spec/business-rules/BR-fnb',
            'spec/business-rules/BR-dispute',
            'spec/business-rules/BR-promotions',
          ],
        },
      ],
    },
    {
      type: 'category',
      label: 'Architecture',
      collapsed: false,
      items: [
        'architecture/system-overview',
        'architecture/booking-session',
        'architecture/ai-chat-rag',
        'architecture/RCField_ArchitectureOverview',
        'architecture/AI-Chat-RAG-ArchitectureOverview',
        {
          type: 'category',
          label: 'Diagrams',
          collapsed: true,
          items: [
            'architecture/diagrams/booking-data-flow',
            'architecture/diagrams/booking-lifecycle-flow',
          ],
        },
      ],
    },
    {
      type: 'category',
      label: 'Sequence Diagrams',
      collapsed: false,
      items: [
        'diagrams/sequence/sequence-flow-booking-lifecycle',
        'diagrams/sequence/sequence-flow-provider-onboarding-subscription',
        'diagrams/sequence/sequence-flow-rag-chat',
        'diagrams/sequence/sequence-flow-redis-usage',
      ],
    },
    {
      type: 'category',
      label: 'Developer Guides',
      collapsed: false,
      items: ['developer/provider-subscription-enforcement'],
    },
    {
      type: 'category',
      label: 'ADR',
      collapsed: true,
      items: [
        'adr/tenant-ui-model',
        'adr/backend-framework-express',
      ],
    },
  ],
};

export default sidebars;
