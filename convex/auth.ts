import { convexAuth } from "@convex-dev/auth/server";
import GitHub from "@auth/core/providers/github";
import { ResendOTP } from "./otp/ResendOTP";
import { AUTH_GITHUB_ID, AUTH_GITHUB_SECRET } from "@cvx/env";

export const { auth, signIn, signOut, store } = convexAuth({
  providers: [
    ResendOTP,
    GitHub({
      clientId: AUTH_GITHUB_ID,
      clientSecret: AUTH_GITHUB_SECRET,
      authorization: {
        params: { scope: "user:email" },
      },
    }),
  ],
});
