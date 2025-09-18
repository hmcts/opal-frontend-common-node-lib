# SSO Stubs

This folder contains stub implementations of the SSO flow for use in **local development** and **testing** environments.  
They simulate the behaviour of the real SSO endpoints without relying on Azure AD.

## Files

- **sso-login.stub.ts**  
  Simulates the SSO login entrypoint. Accepts an `email` query parameter and redirects to the login callback stub.

- **sso-login-callback.stub.ts**  
  Simulates the IdP login callback. Calls the `opal-user-service` testing-support endpoint to mint a token for the supplied email.  
  Stores the token in the session and redirects to `/`.

- **sso-authenticated.stub.ts**  
  Stubbed `/sso/authenticated` endpoint. Checks only for the presence of a valid, non-expired access token in the session.

- **sso-logout.stub.ts**  
  Stubbed `/sso/logout` endpoint. Returns `true` if a valid token exists in the session, `false` otherwise.

- **sso-logout-callback.stub.ts**  
  Stubbed `/sso/logout/callback` endpoint. Destroys the session, clears cookies, and redirects to `/`.

## Notes

- These stubs are for **non-production use only**.  
- They allow frontend apps to integrate against a simulated SSO flow when Azure AD is not available.  
- The access token minted via testing-support can then be used to fetch user state from the `opal-user-service`.