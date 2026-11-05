import { apiClient } from "@/lib/api-client";

class DemoSessionService {
  // Returns a one-time Clerk sign-in ticket when the email is the demo account's.
  create(email: string) {
    return apiClient.post<{ ticket: string }>("/demo_session", { email });
  }
}

export const demoSessionService = new DemoSessionService();
