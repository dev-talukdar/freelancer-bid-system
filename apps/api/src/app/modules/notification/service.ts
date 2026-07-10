// Notification delivery is intentionally pull-based: Chrome extension polls detected projects.
export interface NotificationDeliveryDesign { strategy: 'extension-pull'; backendCallsChromeApis: false }
export const notificationDeliveryDesign: NotificationDeliveryDesign = { strategy: 'extension-pull', backendCallsChromeApis: false };
