import Link from "next/link";
import { auth, signIn, signOut } from "@/auth";
import { Button } from "@/components/ui/Button";
import styles from "./SiteHeader.module.css";

export async function SiteHeader() {
  const session = await auth();
  return (
    <header className={`shell ${styles.header}`}>
      <Link href="/" className={styles.logo}>Leap<span className={styles.logoDot}>.</span></Link>
      <nav className={styles.nav}>
        {session?.user ? (
          <>
            <Link href="/dashboard">Dashboard</Link>
            <form action={async () => { "use server"; await signOut({ redirectTo: "/" }); }}>
              <Button variant="outline" type="submit">Sign out</Button>
            </form>
          </>
        ) : (
          <form action={async () => { "use server"; await signIn("github", { redirectTo: "/dashboard" }); }}>
            <Button type="submit" arrow>Sign in with GitHub</Button>
          </form>
        )}
      </nav>
    </header>
  );
}
