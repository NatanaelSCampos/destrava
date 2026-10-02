const googleUnlinkedKey = "destrava:google-unlinked";

export function rememberGoogleUnlink() {
  try {
    window.localStorage.setItem(googleUnlinkedKey, "1");
  } catch {
    // Private browsing may prevent local storage; unlinking still succeeds.
  }
}

export function shouldRequestGoogleConsent() {
  try {
    return window.localStorage.getItem(googleUnlinkedKey) === "1";
  } catch {
    return false;
  }
}

export function clearGoogleUnlink() {
  try {
    window.localStorage.removeItem(googleUnlinkedKey);
  } catch {
    // A successful OAuth flow needs no further browser state.
  }
}
