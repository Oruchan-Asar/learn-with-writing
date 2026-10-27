import Link from "next/link";
import { SettingsMenu } from "@/components/SettingsMenu";

export function SiteHeader() {
  return (
    <header className="mx-auto flex w-full max-w-4xl items-center justify-between px-4 pt-4">
      <Link href="/" className="text-sm font-semibold tracking-tight hover:text-sky-600 dark:hover:text-sky-400">
        Learn with writing
      </Link>
      <SettingsMenu />
    </header>
  );
}
