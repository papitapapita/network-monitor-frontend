/** `GET /api/push/public-key`. `enabled: false`: the server has no VAPID keys, so the feature is hidden. */
export interface PushPublicKeyDTO {
  enabled: boolean;
  /** base64url — `pushManager.subscribe` wants it as a `Uint8Array`. */
  publicKey: string | null;
}

/** `PushSubscription.toJSON()` as the browser gives it; the backend ignores extra fields. */
export interface PushSubscriptionBody {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export interface PushSubscriptionDTO {
  endpoint: string;
  userAgent: string | null;
  createdAt: string;
}

export interface PushTestResultDTO {
  delivered: number;
}
