/**
 * ============================================================================
 * Background Auth Module
 * ============================================================================
 * Manages the user's authentication state, specifically fetching, caching, 
 * and refreshing JWT tokens from the backend. Prevents excessive API calls by 
 * maintaining a 5-minute cache unless forced to refresh due to session changes.
 */
import { API_NUXT_DOMAIN } from './config.js';

let user_token = {
  token_id: null,
  date: null
};

let lastSessionId = null;
let baseRetryDelay = 1000;

async function getUserToken(sessionId = null, forceRefresh = false) {
  const now = new Date();

  if (forceRefresh) {
    console.log('🔄 Forced token refresh requested');
    lastSessionId = sessionId;
    baseRetryDelay = 1000;
  }
  else if (sessionId !== null) {
    if (lastSessionId === sessionId && user_token.date && user_token.status !== "error" && user_token.status !== "expired") {
      console.log("SessionId unchanged, skipping token fetch");
      return;
    }
    if (lastSessionId !== sessionId) {
      console.log(`SessionId changed from ${lastSessionId} to ${sessionId}`);
      lastSessionId = sessionId;
      baseRetryDelay = 1000;
    }
  } else {
    if (user_token.date && user_token.status !== "error" && user_token.status !== "expired") {
      const diff = now - user_token.date;
      const fiveMinutes = 5 * 60 * 1000;

      if (diff < fiveMinutes) {
        console.log("5-minute threshold not met, skipping token fetch");
        return;
      }
    }
  }

  try {
    let getTokenResponse = await fetch(`https://${API_NUXT_DOMAIN}/api/v1/getToken`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      }
    });

    const getTokenData = await getTokenResponse.json();
    console.log("getTokenData", getTokenData);

    if (getTokenData.status === 'error') {
      user_token = {
        status: getTokenData.status,
        message: getTokenData.message,
        token_id: null,
        date: null,
      };
    } else {
      user_token = {
        status: getTokenData.status,
        token_id: getTokenData.token,
        generation_credits: getTokenData.generation_credits,
        generation_credits_limit: getTokenData.generation_credits_limit,
        generation_wait_time_minutes: getTokenData.generation_wait_time_minutes,
        account_status: getTokenData.account,
        date: new Date(),
      };
      console.log('✅ Token refreshed successfully');
    }
  } catch (error) {
    console.error('❌ Token fetch failed:', error);
    user_token = {
      status: 'error',
      message: error.message,
      token_id: null,
      date: null,
    };
  }

  return;
}

function resetUserToken() {
  user_token = {
    token_id: null,
    date: null
  };
}

export { getUserToken, resetUserToken, user_token };
