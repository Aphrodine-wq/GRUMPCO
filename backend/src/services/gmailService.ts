import logger from "../middleware/logger.js";
import {
  getAccessToken,
  isTokenExpired,
  refreshOAuthTokens,
} from "./integrationService.js";

// TODO: These should probably come from a central place
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GMAIL_API_BASE_URL = "https://www.googleapis.com/gmail/v1";

export class GmailService {
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
  }

  static async processWebhook(notification: {
    emailAddress?: string;
    historyId?: string;
  }) {
    // Implementation will go here
    logger.info(notification, "Processing Gmail webhook");
  }

  private async getAccessToken(): Promise<string | null> {
    const isExpired = await isTokenExpired(this.userId, "gmail");
    if (isExpired) {
      const refreshed = await refreshOAuthTokens(this.userId, "gmail");
      if (!refreshed) {
        logger.error({ userId: this.userId }, "Failed to refresh Gmail token");
        return null;
      }
    }

    return getAccessToken(this.userId, "gmail");
  }

  async getNewEmails(historyId: string): Promise<any[]> {
    const accessToken = await this.getAccessToken();
    if (!accessToken) {
      throw new Error("No access token available for Gmail");
    }

    const response = await fetch(
      `${GMAIL_API_BASE_URL}/users/me/history?startHistoryId=${historyId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      logger.error(
        { userId: this.userId, error: errorText, status: response.status },
        "Failed to fetch Gmail history",
      );
      return [];
    }

    const data = await response.json();
    return data.history || [];
  }

  async getMessage(messageId: string): Promise<any> {
    const accessToken = await this.getAccessToken();
    if (!accessToken) {
      throw new Error("No access token available for Gmail");
    }

    const response = await fetch(
      `${GMAIL_API_BASE_URL}/users/me/messages/${messageId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      logger.error(
        {
          userId: this.userId,
          messageId,
          error: errorText,
          status: response.status,
        },
        "Failed to fetch Gmail message",
      );
      return null;
    }

    return response.json();
  }
}
