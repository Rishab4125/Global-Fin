import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  callbacks: {
    authorized({ auth, request }) {
      const path = request.nextUrl.pathname;
      if (path === "/login") return true;
      return !!auth?.user;
    },
    // Auth.js generates a fresh random user id on every sign-in when no database adapter is used,
    // so the stable Google account id (providerAccountId) is what identifies a person.
    jwt({ token, account }) {
      if (account?.providerAccountId) token.uid = account.providerAccountId;
      return token;
    },
    session({ session, token }) {
      // Sessions from before the stable id existed get an empty id, which sends the user back to sign in.
      session.user.id = token.uid ?? "";
      return session;
    },
  },
});
