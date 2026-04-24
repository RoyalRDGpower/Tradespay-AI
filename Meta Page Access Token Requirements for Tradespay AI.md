# Meta Page Access Token Requirements for Tradespay AI

For the Tradespay AI autopilot to function correctly across Meta platforms (Instagram and WhatsApp), you generally need **one Long-Lived Page Access Token**.

## Key Points:

*   **Single Token, Multiple Permissions:** A single Long-Lived Page Access Token can grant access to multiple Meta assets (e.g., an Instagram Business Account and a WhatsApp Business Account) if that token is generated from a Facebook Page that owns or manages those assets. The crucial aspect is that this token must have the necessary permissions for all the actions the autopilot needs to perform (e.g., `instagram_basic`, `instagram_manage_messages`, `whatsapp_business_management`, `whatsapp_business_messaging`).

*   **Long-Lived vs. Short-Lived:** Short-lived tokens expire quickly (typically within an hour). For server-side applications like Tradespay AI, a **Long-Lived Page Access Token** is essential as it can last for 60 days and can be refreshed programmatically or manually.

*   **Generation Process:** This token is usually obtained through a user authentication flow where a user (who has admin access to the Facebook Page connected to the Instagram and WhatsApp Business Accounts) grants your Meta App permissions. You would typically exchange a short-lived user access token for a long-lived user access token, and then use that to get a long-lived page access token for the relevant Facebook Page.

*   **Other Meta Credentials:**
    *   `META_APP_ID` and `META_APP_SECRET`: These are static credentials for your Meta App itself. They identify your application to Meta and are used for various API calls, including token generation.
    *   `META_CLIENT_TOKEN`: This is an optional client token for certain client-side operations or for verifying webhook payloads.

**In summary, you need to generate one robust Long-Lived Page Access Token with comprehensive permissions and update the `META_PAGE_ACCESS_TOKEN` variable in your `.env` file with this single token.**
