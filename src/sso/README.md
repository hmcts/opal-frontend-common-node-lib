# SSO Handlers

This folder contains the core server-side handlers and configuration for **Single Sign-On (SSO)** with Azure AD.

## Files

- **sso-configuration.ts**  
  Creates and configures an MSAL `ConfidentialClientApplication` for authenticating against Azure AD.

- **sso-login.ts**  
  Initiates the login flow. Uses MSAL to generate an authorization code URL and redirects the user to Azure AD.

- **sso-login-callback.ts**  
  Handles the login callback. Exchanges the authorization code for an access token, stores it in the session, and redirects to the frontend.

- **sso-authenticated.ts**  
  Provides an endpoint to check whether the session contains a valid, non-expired access token.

- **sso-logout.ts**  
  Redirects the user to the Azure AD logout endpoint, with a post-logout redirect back to the application.

- **sso-logout-callback.ts**  
  Handles the logout callback. Destroys the session, clears the authentication cookie, and redirects to `/`.

## Notes

- These handlers are designed to work together to support an Azure AD SSO flow in Express-based Node apps.
- The session stores **only the access token**; user state is fetched separately from the `opal-user-service`.
- Always ensure `frontendHostname` and callback URIs match those registered in your Azure AD app.