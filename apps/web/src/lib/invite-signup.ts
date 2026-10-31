const INVITEE_KEY = "listygifty-invitee";

type Invitee = { name: string; email: string };

/** Kept in this tab only, so the address never sits in a URL or a server log. */
export function rememberInvitee(invitee: Invitee) {
  try {
    sessionStorage.setItem(INVITEE_KEY, JSON.stringify(invitee));
  } catch {
    // Without storage the form just starts empty.
  }
}

/** What Clerk's sign-up form can fill in, because the invite already knows it. */
export function inviteeSignUpValues() {
  try {
    const stored = sessionStorage.getItem(INVITEE_KEY);
    if (!stored) return undefined;
    const { name, email } = JSON.parse(stored) as Invitee;
    if (name.includes("@")) return { emailAddress: email };

    const [firstName, ...rest] = name.trim().split(/\s+/);
    return { emailAddress: email, firstName, ...(rest.length > 0 && { lastName: rest.join(" ") }) };
  } catch {
    return undefined;
  }
}
