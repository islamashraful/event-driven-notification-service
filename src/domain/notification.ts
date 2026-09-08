/**
 * What actually gets shown to the user, plus whatever data the client app
 * needs alongside it (e.g. to navigate somewhere when tapped).
 */
export type NotificationContent = {
  title: string;
  body: string;
  data: Record<string, unknown>;
};
